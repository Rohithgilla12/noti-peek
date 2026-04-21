#!/usr/bin/env bash
# Regenerate all icon assets from the SVG masters in this directory.
#
# Requires: rsvg-convert (brew install librsvg), bun, Tauri CLI installed via
# the app's devDependencies.
#
# App icon set (PNG, .icns, .ico, Windows Store tiles, iOS, Android) is
# produced by `tauri icon`. The menubar template glyph is a separate
# monochrome silhouette and is rendered here directly.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ICONS_DIR="$(cd "$HERE/.." && pwd)"
APP_DIR="$(cd "$HERE/../../.." && pwd)"

# 1024 PNG master for the CLI
rsvg-convert -w 1024 "$HERE/icon-master.svg" -o "$HERE/icon-master.png"

# Full app iconset via Tauri
(cd "$APP_DIR" && bun tauri icon "$HERE/icon-master.png")

# Menubar template (pure black + alpha, for icon_as_template mode)
rsvg-convert -w 22 "$HERE/tray-template.svg" -o "$ICONS_DIR/tray-template.png"
rsvg-convert -w 44 "$HERE/tray-template.svg" -o "$ICONS_DIR/tray-template@2x.png"

echo "Icons regenerated in $ICONS_DIR"
