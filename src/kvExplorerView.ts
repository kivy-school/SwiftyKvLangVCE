import * as vscode from 'vscode';
import * as path from 'path';

// Common Kivy widgets
const KIVY_WIDGETS = [
    // Layouts
    { name: 'BoxLayout', category: 'Layouts', snippet: 'BoxLayout:\n    orientation: "vertical"\n    $0' },
    { name: 'GridLayout', category: 'Layouts', snippet: 'GridLayout:\n    cols: 2\n    $0' },
    { name: 'StackLayout', category: 'Layouts', snippet: 'StackLayout:\n    orientation: "lr-tb"\n    $0' },
    { name: 'AnchorLayout', category: 'Layouts', snippet: 'AnchorLayout:\n    anchor_x: "center"\n    anchor_y: "center"\n    $0' },
    { name: 'FloatLayout', category: 'Layouts', snippet: 'FloatLayout:\n    $0' },
    { name: 'RelativeLayout', category: 'Layouts', snippet: 'RelativeLayout:\n    $0' },
    { name: 'PageLayout', category: 'Layouts', snippet: 'PageLayout:\n    $0' },
    { name: 'ScatterLayout', category: 'Layouts', snippet: 'ScatterLayout:\n    $0' },
    
    // Basic Widgets
    { name: 'Label', category: 'Widgets', snippet: 'Label:\n    text: "Hello World"\n    $0' },
    { name: 'Button', category: 'Widgets', snippet: 'Button:\n    text: "Click Me"\n    on_press: $0' },
    { name: 'Image', category: 'Widgets', snippet: 'Image:\n    source: "path/to/image.png"\n    $0' },
    { name: 'TextInput', category: 'Widgets', snippet: 'TextInput:\n    text: ""\n    multiline: False\n    $0' },
    { name: 'Slider', category: 'Widgets', snippet: 'Slider:\n    min: 0\n    max: 100\n    value: 50\n    $0' },
    { name: 'ProgressBar', category: 'Widgets', snippet: 'ProgressBar:\n    value: 50\n    max: 100\n    $0' },
    { name: 'CheckBox', category: 'Widgets', snippet: 'CheckBox:\n    active: False\n    $0' },
    { name: 'Switch', category: 'Widgets', snippet: 'Switch:\n    active: False\n    $0' },
    { name: 'ToggleButton', category: 'Widgets', snippet: 'ToggleButton:\n    text: "Toggle"\n    state: "normal"\n    $0' },
    { name: 'Spinner', category: 'Widgets', snippet: 'Spinner:\n    text: "Select"\n    values: []\n    $0' },
    
    // Container Widgets
    { name: 'ScrollView', category: 'Containers', snippet: 'ScrollView:\n    $0' },
    { name: 'Carousel', category: 'Containers', snippet: 'Carousel:\n    direction: "right"\n    $0' },
    { name: 'ScreenManager', category: 'Containers', snippet: 'ScreenManager:\n    $0' },
    { name: 'TabbedPanel', category: 'Containers', snippet: 'TabbedPanel:\n    do_default_tab: False\n    $0' },
    { name: 'Accordion', category: 'Containers', snippet: 'Accordion:\n    $0' },
    
    // Other
    { name: 'Video', category: 'Media', snippet: 'Video:\n    source: "path/to/video.mp4"\n    $0' },
    { name: 'Camera', category: 'Media', snippet: 'Camera:\n    resolution: (640, 480)\n    $0' },
    { name: 'FileChooser', category: 'Dialogs', snippet: 'FileChooser:\n    $0' },
    { name: 'Popup', category: 'Dialogs', snippet: 'Popup:\n    title: "Popup"\n    size_hint: (0.8, 0.8)\n    $0' },
];

export class KvFilesProvider implements vscode.TreeDataProvider<KvTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<KvTreeItem | undefined | null | void> = new vscode.EventEmitter<KvTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<KvTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string | undefined) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: KvTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: KvTreeItem): Promise<KvTreeItem[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No workspace folder open');
            return [];
        }

        if (element) {
            return [];
        } else {
            // Return root level items - find all .kv files
            const kvFiles = await vscode.workspace.findFiles('**/*.kv', '**/{node_modules,.build,.venv}/**');
            
            return kvFiles.map(uri => {
                const fileName = path.basename(uri.fsPath);
                return new KvTreeItem(
                    fileName,
                    uri,
                    vscode.TreeItemCollapsibleState.None,
                    'file'
                );
            });
        }
    }
}

export class KvWidgetsProvider implements vscode.TreeDataProvider<KvTreeItem>, vscode.TreeDragAndDropController<KvTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<KvTreeItem | undefined | null | void> = new vscode.EventEmitter<KvTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<KvTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    // Mime type for drag and drop
    dropMimeTypes = ['text/uri-list'];
    dragMimeTypes = ['text/plain'];

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    // Handle dragging items
    async handleDrag(source: KvTreeItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        if (source[0]?.snippet) {
            // Set plain text for editor drops (use snippet, not label)
            dataTransfer.set('text/plain', new vscode.DataTransferItem(source[0].snippet));
            
            // Set JSON data for VNC preview drops
            const widgetData = {
                name: source[0].label,
                category: source[0].category,
                snippet: source[0].snippet,
                type: 'kivy-widget'
            };
            dataTransfer.set('application/json', new vscode.DataTransferItem(JSON.stringify(widgetData)));
        }
    }

    // Handle dropping items (not needed for widgets view)
    async handleDrop(target: KvTreeItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        // Not implemented for widgets view
    }

    getTreeItem(element: KvTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: KvTreeItem): Promise<KvTreeItem[]> {
        if (element) {
            // If it's a category, return its widgets
            if (element.contextValue === 'category') {
                const category = element.label as string;
                return KIVY_WIDGETS
                    .filter(w => w.category === category)
                    .map(widget => new KvTreeItem(
                        widget.name,
                        undefined,
                        vscode.TreeItemCollapsibleState.None,
                        'widget',
                        widget.snippet,
                        widget.category
                    ));
            }
            return [];
        } else {
            // Return categories
            const categories = [...new Set(KIVY_WIDGETS.map(w => w.category))];
            return categories.map(category => 
                new KvTreeItem(
                    category,
                    undefined,
                    vscode.TreeItemCollapsibleState.Expanded,
                    'category'
                )
            );
        }
    }
}

export class KvTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly resourceUri: vscode.Uri | undefined,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly snippet?: string,
        public readonly category?: string
    ) {
        super(label, collapsibleState);
        
        if (contextValue === 'file' && resourceUri) {
            this.tooltip = resourceUri.fsPath;
            this.description = path.dirname(resourceUri.fsPath).split(path.sep).pop();
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [resourceUri]
            };
            this.iconPath = new vscode.ThemeIcon('file-code');
        } else if (contextValue === 'widget') {
            this.tooltip = `Drag and drop to insert ${label}`;
            this.iconPath = new vscode.ThemeIcon('symbol-class');
            // Only drag and drop enabled, no click-to-insert
        } else if (contextValue === 'category') {
            this.iconPath = new vscode.ThemeIcon('folder');
        }
    }
}
