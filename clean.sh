#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "🧹 Cleaning build artifacts..."

# Remove build directories
[ -d ".build" ] && rm -rf .build && echo "  ✓ Removed .build/"
[ -d "out" ] && rm -rf out && echo "  ✓ Removed out/"
[ -d "wasm" ] && rm -rf wasm && echo "  ✓ Removed wasm/"
[ -d "node_modules" ] && rm -rf node_modules && echo "  ✓ Removed node_modules/"

# Remove lock files (optional)
[ -f "package-lock.json" ] && rm package-lock.json && echo "  ✓ Removed package-lock.json"

echo ""
echo "✅ Cleanup complete!"
echo "Run './build-wasm.sh' to rebuild"
