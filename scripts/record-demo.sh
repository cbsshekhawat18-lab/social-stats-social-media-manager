#!/usr/bin/env bash
# Record the README demo GIF (docs/demo.gif) and screenshot (docs/screenshot.png).
#
# The browser part is scripted (scripts/record-demo.cjs), so a re-take shows
# the same steps: demo login, the analytics page with 90 days of seeded data,
# the dashboard. About 22 s; the GIF must stay under 5 MB so GitHub plays it
# inline.
#
# Before running:
#   1. Start the app with seeded data (README → "Demo"), at http://localhost:3000
#      (or set BASE_URL). The script clicks the one-click demo button, so the
#      frontend must be built with it:
#        REACT_APP_SHOW_DEMO=true docker compose --env-file .env.docker up -d --build
#   2. Install Playwright once:  npm install --no-save playwright && npx playwright install chromium
#   3. Have ffmpeg on PATH.
set -euo pipefail
cd "$(dirname "$0")/.."

FPS=${FPS:-8}       # 8 fps keeps the 22 s take near 3 MB at 880 px
WIDTH=${WIDTH:-880}
OUT=docs/demo.gif
export OUT_DIR=docs/.recording

rm -rf "$OUT_DIR"
node scripts/record-demo.cjs
RAW=$(ls "$OUT_DIR"/*.webm)

# Frame 1 is what GitHub shows while the GIF is paused (viewers with
# animated-image autoplay off or reduced motion), so open on the analytics
# screenshot the recorder just took, held POSTER_SECONDS. TRIM_START drops the
# blank page-load frames at the head of the recording. The last frame is held
# 2.5 s, then the two-pass palette conversion.
POSTER_SECONDS=${POSTER_SECONDS:-2}
TRIM_START=${TRIM_START:-0.5}
SCALE="scale=${WIDTH}:-2:flags=lanczos"
FILTER="[0:v]${SCALE},fps=${FPS},format=rgb24[p];[1:v]tpad=stop_mode=clone:stop_duration=2.5,fps=${FPS},${SCALE},format=rgb24[r];[p][r]concat=n=2:v=1:a=0"
INPUTS=(-loop 1 -framerate "$FPS" -t "$POSTER_SECONDS" -i docs/screenshot.png -ss "$TRIM_START" -i "$RAW")
ffmpeg -v error -y "${INPUTS[@]}" -filter_complex "${FILTER},palettegen=max_colors=128:stats_mode=diff" "$OUT_DIR/palette.png"
ffmpeg -v error -y "${INPUTS[@]}" -i "$OUT_DIR/palette.png" \
  -filter_complex "${FILTER}[x];[x][2:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" "$OUT"
rm -rf "$OUT_DIR"

SIZE=$(stat -f%z "$OUT" 2>/dev/null || stat -c%s "$OUT")
echo "$OUT: $((SIZE / 1024)) KiB (limit for inline rendering: 5 MB)"
if [ "$SIZE" -gt $((5 * 1024 * 1024)) ]; then
  echo "Over 5 MB: re-run with FPS=6 or WIDTH=800." >&2
  exit 1
fi
