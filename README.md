# Ocean Graph Viewer

Visualizador de grafos de conocimiento con la estética de **Ocean Industries** — liquid glass, esmeralda-noche, tipografía editorial. Toma el `graph.json` que produce [Graphify](https://github.com/Graphify-Labs/graphify) y lo convierte en un grafo navegable: buscador, panel de detalle, filtro por comunidades y **camino más corto entre cualquier par de conceptos**.

App estática pura (HTML + D3, sin build step). Se despliega en Vercel de un solo paso.

---

## Qué hace

- **Sube tu `graph.json`** (arrastrar y soltar) o **carga el grafo de ejemplo** incluido.
- **Force-directed graph** con nodos dimensionados por grado — los *god nodes* (más conectados) salen más grandes y con glow.
- **Comunidades** coloreadas con una rampa oceánica coherente, filtrables desde la leyenda.
- **Buscador** en vivo por función o archivo.
- **Detalle de nodo**: archivo, ubicación, comunidad, conexiones y vecinos con la relación de cada arista.
- **Camino más corto**: clic en dos nodos y la ruta se resalta salto a salto.
- **EXTRACTED vs INFERRED**: las aristas explícitas son sólidas; las inferidas por Graphify, punteadas en ámbar. La confianza es visible sin abrir nada.
- **Todo local**: el `graph.json` se procesa en el navegador. Nada se sube a ningún servidor.

## Estructura

```
index.html        shell de la app (landing + vista del grafo)
style.css         estética Ocean Glass completa
graph.js          motor de render (D3) — renderGraph(data, title)
app.js            capa de app: carga de archivo, drag&drop, demo, navegación
demo-graph.json   grafo de ejemplo (el propio código de Graphify)
vercel.json       config de deploy estático
```

## Desplegar en Vercel

### Opción A — desde el dashboard (más simple)

1. Entra a [vercel.com/new](https://vercel.com/new).
2. Importa este repositorio de GitHub.
3. Framework preset: **Other** (es estático, no necesita build).
4. Deploy. Listo — te da una URL `https://<proyecto>.vercel.app`.

### Opción B — desde la CLI

```bash
npm i -g vercel     # una vez
vercel deploy --prod
```

No hay variables de entorno ni secretos. Es 100% estático.

## Uso local

Cualquier servidor estático sirve (no abras `index.html` con `file://`, el `fetch` del demo lo bloquea):

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

## Generar tu propio grafo

```bash
pip install graphifyy          # o: uv tool install graphifyy
graphify . --no-viz            # mapea el repo actual (AST, local, sin LLM para código)
graphify cluster-only .        # nombra las comunidades
# luego suelta graphify-out/graph.json en la app
```

## Deep-link opcional

Puedes cargar un grafo remoto por URL:

```
https://tu-app.vercel.app/?graph=https://ejemplo.com/graph.json
```

(El JSON remoto debe permitir CORS.)

## Estética

Parte del ecosistema de skills de Ocean Industries. La visualización sigue el ADN visual de la agencia: dark con tinte (nunca `#000` plano), esmeralda-noche de base, un único acento solar ámbar del Pacífico, vidrio real con blur medido, Space Grotesk + JetBrains Mono. Un acento memorable, no diez.

## Créditos

- El grafo lo construye [Graphify](https://github.com/Graphify-Labs/graphify) (Graphify Labs, YC S26) — código abierto.
- Esta visualización y su estética son de Ocean Industries.

## Licencia

MIT — ver [LICENSE](./LICENSE).
