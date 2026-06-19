#!/bin/sh
# Battle of Hong Kong 1941 — launcher (macOS/Linux).
# Map tiles must be served over http (same-origin). First run only: pwsh tools/fetch_tiles.ps1
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Node.js is required (https://nodejs.org)."; exit 1; }
echo "Serving on http://localhost:5050  (Ctrl+C to stop)"
node tools/serve.js
