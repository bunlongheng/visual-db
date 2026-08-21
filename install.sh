#!/usr/bin/env bash
# Symlink dbchart into ~/.local/bin (or $1 if given).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BIN="${1:-$HOME/.local/bin}"
mkdir -p "$BIN"
ln -sf "$HERE/bin/dbchart" "$BIN/dbchart"
echo "linked $BIN/dbchart -> $HERE/bin/dbchart"
case ":$PATH:" in
  *":$BIN:"*) echo "ready: run  dbchart <schema.table>";;
  *) echo "note: add $BIN to your PATH";;
esac
