#!/bin/bash
set -e

echo "🔨 Building KV to PyClass VSCode Extension..."

cd "$(dirname "$0")"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Compile TypeScript
echo "📝 Compiling TypeScript..."
npm run compile

echo "✅ Build complete!"
echo ""
echo "To test the extension:"
echo "  1. Press F5 in VSCode to open Extension Development Host"
echo "  2. Open a .kv file"
echo "  3. Use commands:"
echo "     - 'KV: Show Preview Panel'"
echo "     - 'KV: Generate Python Class'"
echo ""
echo "To package the extension:"
echo "  npm run package"
