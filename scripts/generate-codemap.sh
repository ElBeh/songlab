#!/usr/bin/env bash
# Generate CODEMAP.md — a structured overview of all TS/TSX files
# Usage: ./scripts/generate-codemap.sh > CODEMAP.md

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "# SongLab Code Map"
echo ""
echo "Auto-generated overview of all TypeScript files."
echo "Re-generate: \`./scripts/generate-codemap.sh > CODEMAP.md\`"
echo ""
echo "---"

# Process directories in logical order
DIRS=(
  "src/types"
  "src/stores"
  "src/services"
  "src/utils"
  "src/hooks"
  "src/components/Layout"
  "src/components/Player"
  "src/components/Markers"
  "src/components/Tabs"
  "src/components/Controller"
  "shared"
  "server"
)

for dir in "${DIRS[@]}"; do
  full="$ROOT/$dir"
  [ -d "$full" ] || continue

  echo ""
  echo "## $dir"

  find "$full" -maxdepth 1 \( -name '*.ts' -o -name '*.tsx' \) | sort | while read -r file; do
    relpath="${file#$ROOT/}"
    lines=$(wc -l < "$file")
    filename=$(basename "$file")

    echo ""
    echo "### $filename ($lines lines)"

    # Extract exported items: functions, consts, types, interfaces, components
    # Covers: export function, export const, export type, export interface,
    #         export default, export async function, and re-exports
    grep -nE '^export ' "$file" 2>/dev/null | sed 's/^/- /' | while read -r line; do
      # Trim to signature only (remove body, keep up to opening brace/equals)
      echo "$line" | sed \
        -e 's/ {$//' \
        -e 's/ => .*//' \
        -e 's/ = create(.*//' \
        -e 's/  *$//' \
        -e 's/\(.\{120\}\).*/\1.../'
    done

    # Show imports from local project files (dependencies)
    deps=$(grep -oE "from '\.\./[^']+'" "$file" 2>/dev/null | sed "s/from '//;s/'//" | sort -u | tr '\n' ', ' | sed 's/,$//')
    if [ -n "$deps" ]; then
      echo "- **deps**: $deps"
    fi
  done
done

# Add src/App.tsx and src/main.tsx
for file in "$ROOT/src/App.tsx" "$ROOT/src/main.tsx"; do
  [ -f "$file" ] || continue
  relpath="${file#$ROOT/}"
  lines=$(wc -l < "$file")
  filename=$(basename "$file")
  echo ""
  echo "## src/"
  echo ""
  echo "### $filename ($lines lines)"
  grep -nE '^export ' "$file" | sed 's/^/- /' | sed -e 's/ {$//' -e 's/\(.\{120\}\).*/\1.../' 2>/dev/null || true
done