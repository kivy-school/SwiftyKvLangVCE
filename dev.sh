#!/bin/bash
set -e

echo "🚀 Opening KV to PyClass extension in new VSCode window for development..."

cd "$(dirname "$0")"

# Check if compiled
if [ ! -d "out" ]; then
    echo "📦 Extension not compiled yet. Running build..."
    npm install
    npm run compile
fi

# Open in new window
code . -n

echo ""
echo "✅ VSCode window opened!"
echo ""
echo "Next steps in the new window:"
echo "  1. Press F5 to launch Extension Development Host"
echo "  2. In the Extension Development Host, open test.kv"
echo "  3. You should see 'KV to PyClass extension activated!' message"
echo "  4. Check the language mode (bottom-right) and select 'Kivy Language' if needed"
echo "  5. Try the commands or click the preview icon in the toolbar"
