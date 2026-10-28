"""Download an OSM street extract once; the website uses the resulting local file."""
import json
from pathlib import Path
import subprocess
import sys

OUTPUT = Path(__file__).resolve().parents[1] / 'assets/data/almeria-roads.geojson'

def fetch_sector(left, bottom, right, top, depth=0):
    url = f'https://api.openstreetmap.org/api/0.6/map.json?bbox={left},{bottom},{right},{top}'
    cache = OUTPUT.parent / '.download-cache'
    cache.mkdir(parents=True, exist_ok=True)
    import hashlib
    path = cache / (hashlib.sha256(url.encode()).hexdigest() + '.json')
    if path.exists():
        return json.loads(path.read_text())['elements']
    result = subprocess.run(['curl', '--silent', '--show-error', '--max-time', '45',
                             '--user-agent', 'AlmeriaGISPortfolio/1.0', url],
                            capture_output=True, text=True, check=True)
    if 'too many nodes' in result.stdout and depth < 4:
        midx, midy = (left+right)/2, (bottom+top)/2
        elements = []
        for bounds in [(left,bottom,midx,midy),(midx,bottom,right,midy),
                       (left,midy,midx,top),(midx,midy,right,top)]:
            elements.extend(fetch_sector(*bounds, depth+1))
        return elements
    data = json.loads(result.stdout)
    if not data.get('elements'):
        raise ValueError('Respuesta sin datos de OSM')
    path.write_text(result.stdout)
    return data['elements']

def main():
    # Four small one-off extracts; no OSM API requests are made by website visitors.
    nodes, ways = {}, {}
    west, south, east, north = -2.499, 36.818, -2.425, 36.862
    for row in range(2):
        for col in range(2):
            left = west + (east-west)*col/2
            bottom = south + (north-south)*row/2
            right = west + (east-west)*(col+1)/2
            top = south + (north-south)*(row+1)/2
            print(f'Descargando sector {row*2+col+1}/4…', flush=True)
            for element in fetch_sector(left, bottom, right, top):
                if element['type'] == 'node':
                    nodes[element['id']] = {'lon': element['lon'], 'lat': element['lat']}
                elif element['type'] == 'way' and element.get('tags', {}).get('highway'):
                    ways[element['id']] = element
    allowed = {'motorway','trunk','primary','secondary','tertiary','residential',
               'living_street','pedestrian','service','unclassified'}
    elements = []
    for way in ways.values():
        if way['tags']['highway'] in allowed and all(n in nodes for n in way['nodes']):
            way['geometry'] = [nodes[n] for n in way['nodes']]
            elements.append(way)
    data = {'elements': elements}
    features = []
    for way in data.get('elements', []):
        coords = [[round(p['lon'], 6), round(p['lat'], 6)] for p in way.get('geometry', [])]
        if way.get('type') == 'way' and len(coords) > 1:
            features.append({'type': 'Feature', 'id': way['id'],
                             'properties': {'highway': way.get('tags', {}).get('highway', '')},
                             'geometry': {'type': 'LineString', 'coordinates': coords}})
    if not features:
        raise RuntimeError('No streets returned; existing data has not been replaced.')
    collection = {'type': 'FeatureCollection',
                  'attribution': '© OpenStreetMap contributors',
                  'license': 'https://www.openstreetmap.org/copyright',
                  'features': features}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(collection, separators=(',', ':')) + '\n')
    print(f'Saved {len(features)} roads to {OUTPUT}')

if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as error:
        print(f'Error de descarga: {error.stderr.strip()}', file=sys.stderr)
        sys.exit(1)
    except (OSError, ValueError, RuntimeError) as error:
        print(f'Error: {error}', file=sys.stderr)
        sys.exit(1)
