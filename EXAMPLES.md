# KV to PyClass VSCode Extension

## Example KV File

Create a file named `example.kv` with this content to test the extension:

```kv
<MyButton@Button>:
    text: app.title
    background_color: 0.2, 0.6, 1, 1
    font_size: 18
    size_hint: None, None
    size: 200, 50
    on_press: root.on_button_click()

<AppInfo@BoxLayout>:
    orientation: 'vertical'
    padding: 20
    spacing: 10
    
    Label:
        text: f"{app.title} - {app.version}"
        font_size: 24
        size_hint_y: None
        height: 40
    
    Label:
        text: str(app.description)
        font_size: 16
        size_hint_y: None
        height: 60

<UserProfile>:
    orientation: 'vertical'
    spacing: 10
    padding: 20
    
    Label:
        text: 'User Profile'
        font_size: 24
        size_hint_y: None
        height: 40
    
    BoxLayout:
        orientation: 'horizontal'
        spacing: 10
        
        Label:
            text: 'Name:'
            size_hint_x: 0.3
        
        TextInput:
            id: name_input
            multiline: False
    
    BoxLayout:
        orientation: 'horizontal'
        spacing: 10
        
        Label:
            text: 'Email:'
            size_hint_x: 0.3
        
        TextInput:
            id: email_input
            multiline: False
    
    MyButton:
        text: 'Save Profile'
        on_press: root.save_profile()
```

## Example Python File (Optional)

Create a file named `example.py` with this content:

```python
class UserProfile(BoxLayout):
    def save_profile(self):
        name = self.ids.name_input.text
        email = self.ids.email_input.text
        print(f"Saving profile: {name}, {email}")
        
    def validate_email(self, email):
        return '@' in email
```

## Testing the Extension

1. Open `example.kv` in VSCode
2. Click the preview icon in the editor toolbar
3. See the generated Python code in the preview panel
4. Edit the KV or Python file and watch the preview update automatically
5. Use the command palette (`Cmd+Shift+P`) to run:
   - **KV: Generate Python Class** - Creates a new Python file with generated code
   - **KV: Show Preview Panel** - Opens the live preview
   - **KV: Toggle Auto-Generate** - Enable/disable automatic updates
