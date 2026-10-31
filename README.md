# GIS & Data Visualization Portfolio

A static portfolio deployed with GitHub Pages at https://ferdes16.github.io/.
All visitor-facing copy is in English. The original design reference is retained in `portfolio_v7_almeria_ice_soft_glow.html` as an historical source file.

## Local preview

From the repository root:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. HTTP is required to load the JSON data.

## Structure

- `index.html`: home, projects, about, tools, map collection and contact.
- `css/style.css`: layout, responsive styles and typography.
- `js/main.js`: one visible street canvas and cursor highlight.
- `js/gallery.js`: published map cards on the collection page.
- `challenge/index.html`: dedicated #30DayMapChallenge gallery.
- `data/maps.json`: public map catalogue; Day 06 is published as a live example.
- `maps/<edition>/<day-theme>/`: published images and map detail pages.
- `assets/data/almeria-roads.geojson`: local Almería street data.

## Street data

Run `python3 scripts/download_roads.py` with an internet connection to refresh the Almería OSM extract. It downloads small API sectors and subdivides responses exceeding the node limit, then exports EPSG:4326 GeoJSON. The download covers west -2.499, south 36.818, east -2.425, north 36.862. Keep the GeoJSON in Git so visitors load it locally rather than querying a third-party map service. Source downloads are cached locally and excluded from Git. Empty downloads do not replace the existing file.

A QGIS/Geofabrik extract clipped to the same area is an alternative. Keep `highway` or `fclass` attributes for road hierarchy. If the source fails, the page remains usable without inventing a street network.

Data: © OpenStreetMap contributors, ODbL; https://www.openstreetmap.org/copyright. Retain attribution on published pages and data exports.

## Preparing a map privately

1. Finish and approve the map in the private `gis-map-lab` repository.
2. Prepare a release folder there containing the final image, thumbnail, an English detail page and a catalogue-entry JSON file.
3. Include a short description, methodology, tools, data sources, attribution and limitations.
4. Keep processing scripts private by default. A public code link is optional and must point to a reviewed public copy, never a private-repository link.
5. Preview locally. Do not push unreleased assets or metadata to this public repository if they must remain confidential.

## Publishing a map manually

On the intended publication day, copy the approved release folder to `maps/<edition>/<day-theme>/`, append its entry to the array in `data/maps.json`, and set `status` to `published`:

```json
{
  "id": "2026-06-vintage",
  "edition": 2026,
  "day": 6,
  "theme": "Vintage",
  "title": "Almería in pastel red",
  "description": "A vintage-inspired portrait of Almería, tracing its streets, buildings and harbour in pastel red and warm cream.",
  "status": "published",
  "thumbnail": "maps/2026/day-06-vintage/thumbnail.png",
  "url": "maps/2026/day-06-vintage/index.html"
}
```

Commit and push after publication approval; GitHub Pages deploys the changes. Check the page, assets and gallery entry, then record the public URL in the private map README and Issue.

## Visibility and timing

Only entries with `status: "published"` appear in the gallery. `status: "draft"`, missing status or any other value hides a gallery card. This is not privacy: any files pushed to this public repository remain accessible directly and through Git history. Hiding a card does not unpublish its detail page or erase prior releases.

The status field does not schedule a future release. To keep a map truly unreleased, retain the draft in `gis-map-lab` and publish manually on the intended day. Automatic scheduled deployment can be added separately if wanted; no scheduled workflow is currently configured.

PROJECTS contains one #30DayMapChallenge entry linking to `challenge/`. Each published gallery card opens a map detail page. Day 06 is available at `maps/2026/day-06-vintage/`. Contact email is configured; Twitter/X and LinkedIn profile URLs are pending owner input.

## Shared map-detail design

All map detail pages use `css/style.css` with `body.map-detail-page` and the shared portfolio navigation. Start from `templates/map-detail.html`, replace every `{{...}}` token, and save it as `maps/<edition>/<day-theme>/index.html`. Keep the same preview/summary, metadata, downloads and method/source sections for every map. Do not embed a map-specific poster palette as the page theme. The artwork is a bounded thumbnail preview; the full-resolution image and PDF are separate links. Adjust the source attribution and optional download links for the actual map.

The project collection card on the homepage is text-only and links to the gallery. Map thumbnails appear inside the gallery and detail pages.
