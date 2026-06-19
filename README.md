# The Battle of Hong Kong, 1941 — an interactive 3D documentary

A self-playing, cinematic 3D retelling of the **Battle of Hong Kong (8–25 December 1941)**,
rendered on **real-to-scale terrain** of Hong Kong with a directed "TV-documentary" camera,
bilingual (中／EN) narration, troop movements, front lines, weather, and a day/night cycle.

Built with **Three.js (r128)** as a fully self-contained static site — **no build step, no
backend, no API keys.** It runs from a single folder served over local HTTP.

## Run it locally

Map tiles must be loaded over HTTP (same-origin) — opening `index.html` via `file://` will
**not** work.

1. **Fetch the terrain + imagery tiles (first time only).** Requires **PowerShell 7+ (`pwsh`)** —
   cross-platform (Windows / macOS / Linux; install from <https://aka.ms/powershell>):
   ```
   pwsh tools/fetch_tiles.ps1
   ```
   This downloads ~242 tiles (elevation + satellite imagery) for the Hong Kong bounding box from
   their source providers into `lib/tiles/`. No account or API key is required.

2. **Serve and open:**
   ```
   node tools/serve.js
   ```
   then open <http://localhost:5050>. (Windows: double-click **`start.bat`**; macOS/Linux: `sh start.sh`.)

## How it works

- **Terrain:** AWS "Terrarium" elevation tiles (SRTM/USGS, public domain) decoded to a real
  height-mesh, Web-Mercator, to scale (with a fixed vertical exaggeration for legibility).
- **Surface:** EOX *Sentinel-2 cloudless 2016* satellite imagery draped over the terrain.
- **Direction:** a state-machine "Director" plays a fixed storyboard of shots; free-look pauses it.
- Everything is data-driven from `data.js` (forces, dated movement tracks, front lines, weather,
  storyboard, narration). `app.js` is the engine; `index.html` is the page.

## Licensing

- **Code** (`app.js`, `data.js`, `index.html`, `tools/`): **MIT** — see [`LICENSE`](LICENSE).
- **Narration, scenario data & text content:** **CC BY 4.0** —
  <https://creativecommons.org/licenses/by/4.0/>.
- **Bundled / fetched third-party software & data** (Three.js, Sentinel-2 imagery, SRTM/USGS
  elevation, the background music) retain their own licenses — see
  [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Credits & data sources

- Satellite imagery: **Sentinel-2 cloudless 2016 © EOX IT Services GmbH** (s2maps.eu) — contains
  modified Copernicus Sentinel data.
- Elevation: **SRTM, courtesy U.S. Geological Survey** via AWS Terrain Tiles.
- 3D engine: **Three.js** (MIT).
- Background music: *"Victoria Harbour 1941"* — original AI composition by the author via **Suno**.
- Historical sources: Wikipedia "Battle of Hong Kong"; Tony Banham, *Not the Slightest Chance*;
  CWGC; Juno Beach Centre; Valour Canada; ww2db; Hong Kong Observatory.

## Historical accuracy — please read

This is an **illustrative reconstruction**, not an authoritative tactical record:

- **Geography is present-day.** The satellite imagery and elevation are modern; Victoria Harbour's
  shoreline (Central/Wan Chai/Kowloon reclamation, Kai Tak, Chek Lap Kok, bridges) is post-war and
  did **not** exist in 1941. The 1941 coastline was narrower, so coastlines, landing beaches, and
  shoreline unit positions are shown only approximately.
- **Troop positions are narrative-schematic** — anchored to real place-name coordinates, but not an
  hour-by-hour precise tactical map.
- **Unit crests are stylised original glyphs / plausible invention**, not official heraldry or
  current regimental insignia.

## Author

Built with ❤️ by **Keith Li** — [LinkedIn](https://www.linkedin.com/in/keithlihk/).
