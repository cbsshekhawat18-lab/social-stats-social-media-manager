#!/usr/bin/env bash
# Record the README demo GIF: 20–40 s, under 5 MB, so GitHub renders it inline.
#
# What the recording shows, in order (the "script"):
#   1. a terminal: `python manage.py migrate && python manage.py demo_setup`
#      (seeds three accounts and 90 days of analytics) — ~8 s
#   2. the browser at /login, one click on the "Agency member" demo button — ~5 s
#   3. the analytics dashboard with the seeded data: scroll once through the
#      KPI row and the per-platform table, change the date range once — ~15 s
#   4. one more module — the content calendar (/calendar) or the inbox:
#      open it, hover a scheduled post — ~8 s
#
# Manual steps (macOS; Linux swaps avfoundation for x11grab):
#   - Run the backend and frontend (README → "Option B"), then `demo_setup`.
#   - Set the browser window to 1280×800 and a light theme; close other tabs.
#   - `ffmpeg -f avfoundation -list_devices true -i ""` prints the screen index
#     (usually "Capture screen 0" → device 1 on a laptop with a camera).
#   - Start this script with that index, act out the four steps, press q to stop.
#   - It writes docs/demo.gif and prints its size; re-record if over 5 MB
#     (lower FPS or WIDTH below) or over 40 s.
#   - Then add this line to README.md just above "## Features":
#         ![Social Stats in 30 seconds](docs/demo.gif)
set -euo pipefail
cd "$(dirname "$0")/.."

DEVICE=${1:-1}      # avfoundation screen index (see above)
FPS=${FPS:-12}      # GIF frame rate: 12 keeps a 35 s clip around 3–4 MB at 960 px
WIDTH=${WIDTH:-960} # output width; height follows the 1280×800 window
RAW=docs/demo-raw.mp4
OUT=docs/demo.gif

echo "Recording screen device $DEVICE — press q in this terminal to stop."
ffmpeg -y -f avfoundation -framerate 30 -capture_cursor 1 -i "${DEVICE}:none" \
  -t 40 -c:v libx264 -preset ultrafast -crf 18 -pix_fmt yuv420p "$RAW"

# Two-pass palette conversion: the standard way to a small, clean GIF.
ffmpeg -y -i "$RAW" -vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,palettegen=max_colors=128" docs/demo-palette.png
ffmpeg -y -i "$RAW" -i docs/demo-palette.png \
  -lavfi "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5" \
  "$OUT"
rm -f docs/demo-palette.png "$RAW"

SIZE=$(stat -f%z "$OUT" 2>/dev/null || stat -c%s "$OUT")
echo "$OUT: $((SIZE / 1024)) KiB (limit for inline rendering: 5 MB)"
if [ "$SIZE" -gt $((5 * 1024 * 1024)) ]; then
  echo "Over 5 MB — re-run with FPS=10 or WIDTH=800, or record a shorter take." >&2
  exit 1
fi
