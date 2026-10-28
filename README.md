# GIS & Data Visualization Portfolio

Portfolio estático basado en Almería Ice Soft Glow V7. La referencia original se conserva en `portfolio_v7_almeria_ice_soft_glow.html`.

## Vista local

Desde la raíz del proyecto:

```sh
python3 -m http.server 8000
```

Abrir http://localhost:8000. Es necesario servir por HTTP para cargar los JSON.

## Archivos

- `index.html`: portada y secciones.
- `css/style.css`: diseño y adaptación móvil.
- `js/main.js`: canvas, navegación y galería.
- `data/maps.json`: catálogo del 30 Day Map Challenge; inicialmente vacío.
- `maps/<edicion>/<dia-tema>/`: imágenes y páginas de cada mapa.
- `assets/data/almeria-roads.geojson`: calles locales de Almería (extracto OSM incluido).

## Calles de Almería

Ejecutar una vez, con conexión a Internet:

```sh
python3 scripts/download_roads.py
```

El script descarga sectores pequeños desde la API directa de OpenStreetMap, subdivide las áreas que superan el límite de nodos y convierte las vías a GeoJSON en EPSG:4326, conservando solo geometría, identificador y tipo de vía. Área: oeste -2.499, sur 36.818, este -2.425, norte 36.862. Guarda el resultado en el repositorio para que las visitas no consulten servicios externos. Las descargas se guardan en una caché local excluida de Git. No reemplaza el archivo si la respuesta no contiene vías.

Alternativa en QGIS: cargar las carreteras de Geofabrik, recortar al área indicada, exportar líneas como GeoJSON en EPSG:4326 y guardar con el mismo nombre. Conservar `highway` o `fclass` para distinguir vías principales. No es necesario publicar los shapefiles.

Hasta disponer del GeoJSON se muestra una red abstracta, identificada como tal. Datos OSM: © OpenStreetMap contributors, licencia ODbL; https://www.openstreetmap.org/copyright. Mantener esta atribución al publicar o redistribuir el extracto.

## Añadir mapas

Crear los archivos en `maps/` y añadir entradas a `data/maps.json`:

```json
[
  {
    "id": "2026-01-points",
    "edition": 2026,
    "day": 1,
    "theme": "Points",
    "title": "Título del mapa",
    "description": "Qué representa y cómo se realizó.",
    "thumbnail": "maps/2026/day-01-points/thumbnail.webp",
    "url": "maps/2026/day-01-points/index.html"
  }
]
```

La página de detalle debe incluir el mapa, metodología, herramientas, fuentes y créditos. Los temas y fechas del ejemplo son orientativos. Las tarjetas de proyectos y el texto de perfil de la propuesta siguen siendo contenido de muestra; configurar también los enlaces de contacto antes de publicar.
