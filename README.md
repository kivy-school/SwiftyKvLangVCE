# SwiftyKvLangVCE - VS Code Extension

VS Code extension for Kivy KV language with syntax highlighting, diagnostics, preview panels, and Python class generation.

## Features

- 🔄 **Automatic paired file detection** - When you open a `.kv` file, the extension automatically finds and loads the matching `.py` file (and vice versa)
- 👁️ **Live preview panel** - See generated Python code in real-time as you edit KV files
- 🎨 **Syntax highlighting** - Full syntax highlighting for KV language
- ⚠️ **Inline diagnostics** - Parse errors shown directly in the editor
- ⚡ **Powered by Swift WASM** - Uses the same generator as the PySwiftKit web demo

## Usage

### Generate Python Classes

1. Open a `.kv` file in VSCode
2. The extension will automatically look for a matching `.py` file (e.g., `myfile.kv` → `myfile.py`)
3. Click the preview icon in the editor toolbar or run **KV: Show Preview Panel**
4. Edit your KV or Python file and see the generated code update automatically

### Commands

- **KV: Generate Python Class** - Generate Python class from current KV file
- **KV: Show Preview Panel** - Open live preview of generated Python code
- **KV: Toggle Auto-Generate** - Enable/disable automatic generation on file changes

## Configuration

- `swiftyKvLang.autoGenerate` - Automatically generate Python classes when files change (default: `true`)
- `swiftyKvLang.debounceDelay` - Delay in milliseconds before generating code after changes (default: `500`)
- `swiftyKvLang.previewOnSide` - Open preview panel to the side (default: `true`)

## How It Works

The extension uses the SwiftyKvLangVCE generator compiled to WebAssembly from Swift. When you edit a KV file:

1. The tokenizer parses the KV syntax
2. The parser builds an AST (Abstract Syntax Tree)
3. The generator creates Python class definitions with:
   - Proper widget initialization
   - Property assignments
   - Reactive bindings (e.g., `app.title` → `self.title`)
   - Event handlers
   - Child widget tree construction

## Example

**Input KV** (`myapp.kv`):
```kv
<MyButton@Button>:
    text: app.title
    size_hint: 0.5, 0.5
    on_press: print(self.text)

<UserProfile>:
    orientation: 'vertical'
    Label:
        text: app.username
        id: username_label
```

**Output Python** (generated):
```python
from kivy.uix.button import Button
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.app import App

class MyButton(Button):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._bindings = []
        app = App.get_running_app()
        self.size_hint = (0.5, 0.5)
        binding = app.bind(title=self.setter('text'))
        self._bindings.append(('title', binding))
        self.bind(on_press=self._on_press_handler)
    
    def _on_press_handler(self, instance):
        print(self.text)

class UserProfile(BoxLayout):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._bindings = []
        app = App.get_running_app()
        self.orientation = 'vertical'
        
        label_A1B2C3D4 = Label()
        binding = app.bind(username=label_A1B2C3D4.setter('text'))
        self._bindings.append(('username', binding))
        self.ids.username_label = label_A1B2C3D4
        self.add_widget(label_A1B2C3D4)
```

## Building from Source

### Prerequisites

- Node.js and npm
- Swift toolchain with WebAssembly support (swiftly)
- VS Code Extension Manager (vsce)

### Build Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build WASM and compile TypeScript:**
   ```bash
   ./build-wasm.sh
   ```
   This will:
   - Compile Swift code to WebAssembly
   - Generate JavaScript runtime files
   - Compress WASM binary
   - Compile TypeScript to JavaScript

3. **Package the extension:**
   ```bash
   npm install -g @vscode/vsce
   vsce package
   ```
   This creates a `.vsix` file you can install in VS Code.

4. **Install the extension:**
   ```bash
   code --install-extension swifty-kv-lang-*.vsix
   ```

### Clean Build

To start fresh:
```bash
./clean.sh
npm install
./build-wasm.sh
vsce package
```

## Requirements

- VSCode 1.85.0 or higher

## License

See LICENSE file in the PySwiftKitDemoPlugin repository.
