#!/bin/bash
set -e

SWIFT_BIN="$HOME/.swiftly/bin/swift"
PRODUCT="SwiftyKvLangVCE"
OUTPUT="wasm"
BUILD_DIR=".build/plugins/PackageToJS/outputs/Package"

echo "🔨 Building $PRODUCT..."

cd "$(dirname "$0")"

# Build with SwiftWasm
$SWIFT_BIN package -c release --swift-sdk swift-6.2.1-RELEASE_wasm js --use-cdn --product "$PRODUCT"

# Copy artifacts
mkdir -p "$OUTPUT"
cp -r "$BUILD_DIR"/* "$OUTPUT/"

# Compress and patch for VSCode extension
if [ -f "$OUTPUT/$PRODUCT.wasm" ]; then
    original_size=$(stat -f%z "$OUTPUT/$PRODUCT.wasm")
    gzip -9 -f -k "$OUTPUT/$PRODUCT.wasm"
    rm "$OUTPUT/$PRODUCT.wasm"
    
    # Patch JS to decompress on the fly
    sed -i.bak "s|fetch(new URL(\"$PRODUCT.wasm\", import.meta.url))|fetch(new URL(\"$PRODUCT.wasm.gz\", import.meta.url)).then(async r => { const ds = new DecompressionStream(\"gzip\"); return new Response(r.body.pipeThrough(ds), { headers: { \"Content-Type\": \"application/wasm\" } }); })|" "$OUTPUT/index.js"
    rm "$OUTPUT/index.js.bak"
    
    compressed_size=$(stat -f%z "$OUTPUT/$PRODUCT.wasm.gz")
    compression_ratio=$(echo "scale=1; 100 - ($compressed_size * 100 / $original_size)" | bc)
    echo "✅ $PRODUCT: $(($original_size / 1024 / 1024))MB → $(($compressed_size / 1024 / 1024))MB (saved ${compression_ratio}%)"
fi

# Compile TypeScript
npm run compile

echo ""
echo "✅ Build complete!"
echo "Press F5 to test the extension"
