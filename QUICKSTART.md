# Quick Start Guide

## Installation (Development)

1. Navigate to the extension directory:
   ```bash
   cd /Volumes/CodeSSD/GitHub/PySwiftKitDemoPlugin/SwiftyKvLangVCE
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run compile
   ```

3. Open in VSCode and press `F5` to launch Extension Development Host

## Using the Extension

### Step 1: Create a KV File

Create a file named `myapp.kv`:

```kv
<MyButton@Button>:
    text: 'Click Me'
    size_hint: 0.5, 0.3
    on_press: root.on_click()

<MainScreen>:
    orientation: 'vertical'
    
    Label:
        text: app.title
        font_size: 24
    
    MyButton:
        on_press: root.handle_button()
```

### Step 2: (Optional) Create Paired Python File

Create a file named `myapp.py` in the same directory:

```python
from kivy.uix.boxlayout import BoxLayout

class MainScreen(BoxLayout):
    def handle_button(self):
        print("Button clicked!")
```

### Step 3: Open Preview

1. Open `myapp.kv` in VSCode
2. Click the preview icon (👁️) in the editor toolbar
   - Or press `Cmd+Shift+P` and run "KV: Show Preview Panel"
3. See the generated Python code in the preview panel

### Step 4: Generate Python File

1. Press `Cmd+Shift+P`
2. Run "KV: Generate Python Class"
3. A new Python file opens with the complete generated code

## Features

### Automatic Paired File Detection

When you open `myapp.kv`, the extension automatically:
- Searches for `myapp.py` in the same directory
- Loads both files
- Combines them when generating output
- Preserves your existing Python methods

### Live Preview

The preview panel updates automatically as you type:
- Edit the KV file → Preview updates
- Edit the paired Python file → Preview updates
- Configurable delay (default: 500ms)

### Syntax Highlighting

Full syntax highlighting for KV files:
- Widget class names (blue)
- Property names (yellow/gold)
- Event handlers (purple)
- Strings, numbers, comments
- Canvas instructions

### Error Diagnostics

Parse errors appear inline:
- Red squiggly underlines
- Hover for error details
- Updates as you type

## Commands

| Command | Description | Shortcut |
|---------|-------------|----------|
| KV: Show Preview Panel | Open live preview | - |
| KV: Generate Python Class | Create new Python file | - |
| KV: Toggle Auto-Generate | Enable/disable auto-updates | - |

## Settings

Configure via `Preferences: Open Settings`:

```json
{
  "swiftyKvLang.autoGenerate": true,
  "swiftyKvLang.debounceDelay": 500,
  "swiftyKvLang.previewOnSide": true
}
```

- **autoGenerate**: Update preview automatically on file changes
- **debounceDelay**: Wait time (ms) before generating after edit
- **previewOnSide**: Open preview beside editor (true) or in current column (false)

## Tips

1. **Pair your files**: Name them the same (e.g., `myapp.kv` + `myapp.py`) for automatic detection
2. **Use the preview**: See changes instantly without generating files
3. **Preserve methods**: The generator keeps your existing Python methods, only regenerates `__init__`
4. **Adjust delay**: If generation is slow, increase `debounceDelay`
5. **Disable auto-gen**: For large files, disable auto-generation and generate manually

## Troubleshooting

### Preview not updating?
- Check if auto-generate is enabled (run "KV: Toggle Auto-Generate")
- Try saving the file (`Cmd+S`)
- Increase debounce delay in settings

### Syntax highlighting not working?
- Make sure the file extension is `.kv`
- Try reloading the window (`Cmd+Shift+P` → "Developer: Reload Window")

### Paired file not detected?
- Files must be in the same directory
- Files must have the same base name (e.g., `app.kv` + `app.py`)
- Try saving both files

## Next Steps

- See [EXAMPLES.md](EXAMPLES.md) for more KV examples
- See [DEVELOPMENT.md](DEVELOPMENT.md) for development guide
- Check out the [Kivy KV Language Guide](https://kivy.org/doc/stable/guide/lang.html)
