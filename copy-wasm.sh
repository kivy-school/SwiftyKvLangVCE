#!/bin/bash
set -e

echo "📦 Copying WASM artifacts from KvToPyClass demo build..."

cd "$(dirname "$0")"

# Create wasm directory if it doesn't exist
mkdir -p wasm

# Check if the demo WASM is built
if [ ! -f "../build/PySwiftKitDemo.js" ]; then
    echo "❌ WASM not built yet. Please run: cd .. && ./build-kv-to-pyclass.sh"
    exit 1
fi

# Copy WASM artifacts
cp ../build/PySwiftKitDemo.js wasm/
cp ../build/runtime.js wasm/

echo "✅ WASM artifacts copied to wasm/"
echo ""
echo "The extension can now use the Swift WASM module!"
