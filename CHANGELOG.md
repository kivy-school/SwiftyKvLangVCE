# Change Log

All notable changes to the "SwiftyKvLangVCE" extension will be documented in this file.

## [0.1.0] - 2025-12-30

### Added
- Initial release of SwiftyKvLangVCE extension
- Syntax highlighting for KV language files
- Automatic paired file detection (.kv ↔ .py)
- Live preview panel for generated Python code
- Command: Generate Python Class from KV file
- Command: Show Preview Panel
- Command: Toggle Auto-Generate
- Inline diagnostics for KV parsing errors
- Configurable auto-generation with debouncing
- Mock WASM bridge (ready for Swift WASM integration)

### Features
- Detects and loads paired .kv and .py files automatically
- Real-time code generation as you type
- Preserves existing Python methods when generating classes
- Creates proper widget hierarchies and property bindings
- Handles event handlers (on_press, on_release, etc.)
- Supports f-strings and reactive bindings (app.property → self.property)

### Configuration
- `swiftyKvLang.autoGenerate` - Enable/disable automatic generation
- `swiftyKvLang.debounceDelay` - Delay before generating (default: 500ms)
- `swiftyKvLang.previewOnSide` - Open preview beside editor

### Notes
- Currently using mock WASM bridge for testing
- Full Swift WASM integration coming soon
- See EXAMPLES.md for usage examples
