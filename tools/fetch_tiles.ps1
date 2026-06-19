#requires -Version 7.0
# fetch_tiles.ps1 — download REAL Hong Kong terrain into lib/tiles/ (run once, offline thereafter)
#   DEM : AWS open Terrarium terrain-RGB  (elev = R*256 + G + B/256 - 32768 m)  — no API key
#   IMG : EOX Sentinel-2 cloudless 2016 (satellite, CC BY 4.0)  {z}/{y}/{x}, JPEG — no API key
# Tile range is DERIVED from the bbox+zoom (single source of truth, mirrors app.js GEO).
$ErrorActionPreference = "Stop"
$ProgressPreference   = "SilentlyContinue"

# --- battle bounding box + zoom (keep in sync with app.js GEO) -------------
$minLng = 113.88; $maxLng = 114.32; $minLat = 22.16; $maxLat = 22.57; $z = 13

function LngToX([double]$lng,[int]$z){ [int][math]::Floor((($lng+180.0)/360.0)*[math]::Pow(2,$z)) }
function LatToY([double]$lat,[int]$z){ $r=$lat*[math]::PI/180.0
  [int][math]::Floor((1.0 - [math]::Log([math]::Tan($r)+1.0/[math]::Cos($r))/[math]::PI)/2.0*[math]::Pow(2,$z)) }

$xmin = LngToX $minLng $z; $xmax = LngToX $maxLng $z
$ymin = LatToY $maxLat $z; $ymax = LatToY $minLat $z   # note: north = smaller y
$nx = $xmax-$xmin+1; $ny = $ymax-$ymin+1
Write-Output ("zoom $z  x $xmin..$xmax ($nx)  y $ymin..$ymax ($ny)  => " + ($nx*$ny) + " tiles/layer")

$root = Split-Path $PSScriptRoot -Parent
$dem  = Join-Path $root "lib\tiles\dem"; $img = Join-Path $root "lib\tiles\img"
New-Item -ItemType Directory -Force $dem | Out-Null
New-Item -ItemType Directory -Force $img | Out-Null

$jobs = New-Object System.Collections.Generic.List[object]
for($x=$xmin;$x -le $xmax;$x++){ for($y=$ymin;$y -le $ymax;$y++){
  $jobs.Add([pscustomobject]@{ url="https://s3.amazonaws.com/elevation-tiles-prod/terrarium/$z/$x/$y.png";                               path=(Join-Path $dem ("{0}_{1}_{2}.png" -f $z,$x,$y)) })
  $jobs.Add([pscustomobject]@{ url="https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/$z/$y/$x.jpg"; path=(Join-Path $img ("{0}_{1}_{2}.jpg" -f $z,$x,$y)) })
}}

$fails = $jobs | ForEach-Object -ThrottleLimit 12 -Parallel {
  try { Invoke-WebRequest -Uri $_.url -OutFile $_.path -TimeoutSec 45 -MaximumRetryCount 4 -RetryIntervalSec 2 | Out-Null; $null }
  catch { "FAIL $($_.url)  ->  $($_.Exception.Message)" }
} | Where-Object { $_ }

$demN = (Get-ChildItem $dem -Filter *.png).Count
$imgN = (Get-ChildItem $img -Filter *.jpg).Count
Write-Output "DEM tiles: $demN   IMG tiles: $imgN   expected each: $($nx*$ny)"
if($fails){ Write-Output "FAILURES:"; $fails | ForEach-Object { Write-Output "  $_" }; throw "Some tiles failed to download." }
Write-Output "OK — all tiles downloaded."
