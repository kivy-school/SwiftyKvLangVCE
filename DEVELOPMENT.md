# Development Guide

## Building the Extension

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the extension:
   ```bash
   npm run compile
   # or use the build script
   ./build.sh
   ```

3. Watch for changes during development:
   ```bash
   npm run watch
   ```

## Testing the Extension

### Using Extension Development Host

1. Open the KvToPyClassVsCode folder in VSCode
2. Press `F5` to launch Extension Development Host
3. In the new window, open a `.kv` file
4. Test the commands and features

### Manual Testing Steps

1. Create test files (`test.kv` and `test.py`)
2. Open `test.kv` in the Extension Development Host
3. Verify syntax highlighting works
4. Click the preview icon in the toolbar
5. Verify the preview panel opens
6. Edit the KV file and verify the preview updates
7. Check that diagnostics appear for syntax errors

## Project Structure

```
SwiftyKvLangVCE/
├── src/
│   ├── extension.ts           # Main extension entry point
│   ├── pairedFileManager.ts   # Detects .kv/.py pairs
│   ├── wasmBridge.ts          # Swift WASM integration (mock)
│   ├── previewPanel.ts        # Preview webview panel
│   └── diagnosticsProvider.ts # Error diagnostics
├── syntaxes/
│   └── kv.tmLanguage.json     # KV language grammar
├── .vscode/
│   ├── launch.json            # Debug configurations
│   └── tasks.json             # Build tasks
├── package.json               # Extension manifest
├── tsconfig.json              # TypeScript config
└── README.md                  # User documentation
```

## Key Components

### Extension Activation
- Initializes all services (WASM bridge, paired file manager, preview panel, diagnostics)
- Registers commands and event listeners
- Sets up file watchers for .kv and .py files

### Paired File Manager
- Automatically finds matching .kv/.py file pairs
- Caches file pairs for performance
- Invalidates cache on file system changes

### WASM Bridge
- **Current**: Mock implementation for testing
- **Future**: Will load Swift WASM module compiled from KvToPyClass
- Interface: `generatePythonClasses(kvCode, pythonCode) => GenerateResult`

### Preview Panel
- Webview-based panel showing generated Python code
- Updates with debouncing (default 500ms)
- Simple syntax highlighting for Python output
- Positioned beside the editor or in active column

### Diagnostics Provider
- Parses error messages from WASM generator
- Creates inline diagnostics with line/column information
- Updates on file changes and saves

## Integrating Swift WASM

To integrate the actual Swift WASM module:

1. Build the SwiftyKvLangVCE Swift module to WASM:
   ```bash
   cd /Volumes/CodeSSD/GitHub/PySwiftKitDemoPlugin
   ./build-kv-to-pyclass.sh
   ```

2. Copy WASM artifacts to extension:
   ```bash
   cp build/KvToPyClass.wasm SwiftyKvLangVCE/wasm/
   cp build/runtime.js SwiftyKvLangVCE/wasm/
   ```

3. Update `wasmBridge.ts`:
   - Load WASM module in `initialize()`
   - Call WASM functions in `generatePythonClasses()`
   - Handle WASM memory and string conversions

4. Example WASM integration:
   ```typescript
   import * as fs from 'fs';
   import * as path from 'path';
   
   async initialize() {
       const wasmPath = path.join(this.extensionPath, 'wasm', 'KvToPyClass.wasm');
       const wasmBuffer = fs.readFileSync(wasmPath);
       
       // Load runtime
       const runtime = require(path.join(this.extensionPath, 'wasm', 'runtime.js'));
       
       // Initialize WASM module
       this.wasmInstance = await runtime.instantiate(wasmBuffer);
       this.initialized = true;
   }
   ```

## Configuration Options

Users can configure the extension via settings:

- `swiftyKvLang.autoGenerate`: Enable auto-generation on file changes
- `swiftyKvLang.debounceDelay`: Delay in ms before generating (prevents excessive updates)
- `swiftyKvLang.previewOnSide`: Open preview in separate column vs current column

## Commands

- `swiftyKvLang.generatePythonClass`: Generate Python class and open in new file
- `swiftyKvLang.showPreview`: Open/focus the preview panel
- `swiftyKvLang.toggleAutoGenerate`: Toggle auto-generation on/off

## Publishing

1. Install vsce:
   ```bash
   npm install -g @vscode/vsce
   ```

2. Package the extension:
   ```bash
   npm run package
   ```

3. Publish to VS Code Marketplace:
   ```bash
   vsce publish
   ```

## Future Enhancements

- [ ] Integrate real Swift WASM module
- [ ] Add code completion for KV properties
- [ ] Add hover documentation for widgets
- [ ] Support for KV imports and includes
- [ ] Formatting provider for KV files
- [ ] Snippets for common KV patterns
- [ ] Jump to definition (KV → Python and vice versa)
- [ ] Rename refactoring across KV and Python files
