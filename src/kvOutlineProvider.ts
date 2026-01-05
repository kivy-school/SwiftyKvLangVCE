import * as vscode from 'vscode';
import { WasmBridge } from './wasmBridge';

export class KvOutlineProvider implements vscode.TreeDataProvider<KvOutlineItem>, vscode.TreeDragAndDropController<KvOutlineItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<KvOutlineItem | undefined | null | void> = new vscode.EventEmitter<KvOutlineItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<KvOutlineItem | undefined | null | void> = this._onDidChangeTreeData.event;

    // Support dragging and dropping within the outline for reordering
    dropMimeTypes = ['application/vnd.code.tree.kvOutlineView', 'text/plain'];
    dragMimeTypes = ['application/vnd.code.tree.kvOutlineView'];

    private currentDocument?: vscode.TextDocument;
    private symbols: any[] = [];

    constructor(private wasmBridge: WasmBridge) {}

    async refresh(document?: vscode.TextDocument): Promise<void> {
        this.currentDocument = document;
        console.log('[KvOutline] Refreshing outline, document:', document?.uri.fsPath);
        await this.updateSymbols();
        console.log('[KvOutline] Symbols extracted:', this.symbols.length);
        this._onDidChangeTreeData.fire();
    }

    private async updateSymbols() {
        if (!this.currentDocument) {
            this.symbols = [];
            return;
        }

        try {
            // Reuse the existing Swift WASM symbol extraction
            this.symbols = await this.wasmBridge.extractSymbols(this.currentDocument.getText());
        } catch (error) {
            console.error('[KvOutline] Error extracting symbols:', error);
            this.symbols = [];
        }
    }

    // Handle dropping widgets into the outline
    async handleDrop(target: KvOutlineItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        // Check if this is an internal drag (reordering outline items)
        const internalItem = dataTransfer.get('application/vnd.code.tree.kvOutlineView');
        if (internalItem) {
            await this.handleInternalDrop(target, internalItem.value as KvOutlineItem[]);
            return;
        }

        // Otherwise, handle external widget drop
        const textItem = dataTransfer.get('text/plain');
        if (!textItem || !this.currentDocument) {
            console.log('[KvOutline] Drop failed: no data or document');
            return;
        }

        const snippet = textItem.value as string;
        console.log('[KvOutline] Dropping external snippet:', snippet.substring(0, 50));
        
        const editor = vscode.window.activeTextEditor;
        
        if (!editor || editor.document !== this.currentDocument) {
            console.log('[KvOutline] Drop failed: no active editor or wrong document');
            return;
        }

        if (target) {
            console.log('[KvOutline] Dropping on target:', target.label, 'at line', target.range.start.line + 1);
            // Insert as a child of the target widget
            await this.insertWidgetAsChild(editor, target, snippet);
        } else {
            console.log('[KvOutline] Dropping at document end');
            // Insert at the end of the document
            const lastLine = editor.document.lineCount - 1;
            const position = new vscode.Position(lastLine, editor.document.lineAt(lastLine).text.length);
            await editor.edit(editBuilder => {
                editBuilder.insert(position, '\n' + snippet);
            });
        }

        // Refresh the outline after insertion
        setTimeout(() => this.refresh(this.currentDocument), 100);
    }

    private async handleInternalDrop(target: KvOutlineItem | undefined, sourceItems: KvOutlineItem[]): Promise<void> {
        if (!this.currentDocument || sourceItems.length === 0) {
            console.log('[KvOutline] Internal drop failed: no document or items');
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== this.currentDocument) {
            console.log('[KvOutline] Internal drop failed: no active editor');
            return;
        }

        const source = sourceItems[0]; // Handle single item for now
        console.log('[KvOutline] Moving item:', source.label, 'to target:', target?.label || 'end');

        // Extract the text of the source item and all its children
        const sourceText = this.extractItemText(editor.document, source);
        if (!sourceText) {
            console.log('[KvOutline] Failed to extract source text');
            return;
        }

        await editor.edit(editBuilder => {
            // Delete the source item
            const deleteRange = this.getFullItemRange(editor.document, source);
            editBuilder.delete(deleteRange);

            // Insert at the new location
            if (target) {
                // Insert as a child of the target
                const targetIndent = this.getIndentation(editor.document.lineAt(target.range.start.line).text);
                const childIndent = targetIndent + '    ';
                
                // Find insertion point
                let insertLine = target.range.start.line + 1;
                if (target.children && target.children.length > 0) {
                    const lastChild = target.children[target.children.length - 1];
                    insertLine = this.findLastLineOfElement(editor.document, lastChild) + 1;
                }

                // Re-indent the source text
                const reindentedText = this.reindentText(sourceText, childIndent);
                editBuilder.insert(new vscode.Position(insertLine, 0), reindentedText + '\n');
            } else {
                // Insert at document end
                const lastLine = editor.document.lineCount - 1;
                const position = new vscode.Position(lastLine, editor.document.lineAt(lastLine).text.length);
                editBuilder.insert(position, '\n' + sourceText);
            }
        });

        // Refresh the outline after moving
        setTimeout(() => this.refresh(this.currentDocument), 100);
    }

    private extractItemText(document: vscode.TextDocument, item: KvOutlineItem): string {
        const range = this.getFullItemRange(document, item);
        return document.getText(range);
    }

    private getFullItemRange(document: vscode.TextDocument, item: KvOutlineItem): vscode.Range {
        const startLine = item.range.start.line;
        let endLine = this.findLastLineOfElement(document, item);
        
        // Include the newline after the last line
        if (endLine < document.lineCount - 1) {
            endLine++;
            return new vscode.Range(startLine, 0, endLine, 0);
        } else {
            // Last line in document
            return new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
        }
    }

    private reindentText(text: string, newIndent: string): string {
        const lines = text.split('\n');
        if (lines.length === 0) return text;

        // Get the original indent of the first line
        const firstLineIndent = this.getIndentation(lines[0]);
        const indentDiff = newIndent.length - firstLineIndent.length;

        return lines.map(line => {
            if (!line.trim()) return ''; // Empty lines stay empty
            
            const currentIndent = this.getIndentation(line);
            const newLineIndent = ' '.repeat(Math.max(0, currentIndent.length + indentDiff));
            return newLineIndent + line.trim();
        }).join('\n');
    }

    private async insertWidgetAsChild(editor: vscode.TextEditor, target: KvOutlineItem, snippet: string) {
        const document = editor.document;
        
        // Get target line and indentation
        const targetLine = target.range.start.line;
        const targetLineText = document.lineAt(targetLine).text;
        const targetIndent = this.getIndentation(targetLineText);
        const childIndent = targetIndent + '    ';
        
        console.log('[KvOutline] Target line:', targetLine + 1, 'indent:', targetIndent.length);
        
        // Find where to insert: after target line, or after last child
        let insertLine = targetLine + 1;
        
        // If target has children, find the last child's end
        if (target.children && target.children.length > 0) {
            const lastChild = target.children[target.children.length - 1];
            insertLine = this.findLastLineOfElement(document, lastChild) + 1;
            console.log('[KvOutline] Inserting after last child at line:', insertLine);
        } else {
            console.log('[KvOutline] Inserting as first child at line:', insertLine);
        }
        
        // Indent the snippet
        const indentedSnippet = snippet.split('\n').map((line, index) => {
            if (index === 0 && line.trim()) {
                return childIndent + line.trim();
            } else if (line.trim()) {
                return childIndent + line.trim();
            } else {
                return '';
            }
        }).join('\n');
        
        console.log('[KvOutline] Inserting at position:', insertLine, '0');
        console.log('[KvOutline] Indented snippet:', indentedSnippet);
        
        // Insert at the position
        const insertPosition = new vscode.Position(insertLine, 0);
        const success = await editor.edit(editBuilder => {
            editBuilder.insert(insertPosition, indentedSnippet + '\n');
        });
        
        console.log('[KvOutline] Insert success:', success);
    }
    
    private findLastLineOfElement(document: vscode.TextDocument, element: KvOutlineItem): number {
        // If element has children, recurse to find the last child's last line
        if (element.children && element.children.length > 0) {
            const lastChild = element.children[element.children.length - 1];
            return this.findLastLineOfElement(document, lastChild);
        }
        // Otherwise return this element's end line
        return element.range.end.line;
    }

    private getIndentation(line: string): string {
        const match = line.match(/^(\s*)/);
        return match ? match[1] : '';
    }

    // Drag handler - allows dragging outline items for reordering
    async handleDrag(source: KvOutlineItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        if (source.length === 0) return;
        
        // Serialize the dragged items for internal use
        dataTransfer.set('application/vnd.code.tree.kvOutlineView', new vscode.DataTransferItem(source));
        
        console.log('[KvOutline] Dragging items:', source.map(s => s.label).join(', '));
    }

    getTreeItem(element: KvOutlineItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: KvOutlineItem): Promise<KvOutlineItem[]> {
        if (!element) {
            // Return root level items - directly convert symbols to tree items
            return this.symbolsToTreeItems(this.symbols);
        } else {
            // Return children from the symbol data
            return element.children || [];
        }
    }

    private symbolsToTreeItems(symbols: any[]): KvOutlineItem[] {
        const items: KvOutlineItem[] = [];

        for (const symbol of symbols) {
            if (!symbol) continue;

            const label = symbol.name || symbol.className || 'Unknown';
            
            // Map symbol kind to VSCode icon
            const icon = this.getIconForKind(symbol.kind);
            
            // Create range from symbol data (WASM format: startLineNumber, startColumn, etc.)
            let range: vscode.Range | undefined;
            if (symbol.range && symbol.range.startLineNumber !== undefined) {
                // Convert 1-based line numbers to 0-based for VSCode
                range = new vscode.Range(
                    new vscode.Position(symbol.range.startLineNumber - 1, symbol.range.startColumn - 1),
                    new vscode.Position(symbol.range.endLineNumber - 1, symbol.range.endColumn - 1)
                );
            }

            // Recursively process children
            const children = symbol.children ? this.symbolsToTreeItems(symbol.children) : [];

            if (range) {
                items.push(new KvOutlineItem(
                    label,
                    range,
                    children.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
                    icon,
                    children
                ));
            }
        }

        return items;
    }

    private getIconForKind(kind: number): string {
        // Map LSP SymbolKind values to VSCode icons
        // kind 4 = Constructor (rules), 18 = Object (widgets), 6 = Property, 13 = Constant (canvas), 2 = Module
        switch (kind) {
            case 4: return 'symbol-class';        // Rules like TestCanvas@BoxLayout
            case 18: return 'symbol-object';      // Widgets like Label, BoxLayout
            case 6: return 'symbol-property';     // Properties like text, orientation
            case 13: return 'symbol-constant';    // Canvas instructions like Color, Rectangle
            case 2: return 'symbol-namespace';    // Canvas blocks
            case 14: return 'symbol-variable';    // Values
            default: return 'symbol-misc';
        }
    }
}

export class KvOutlineItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly range: vscode.Range,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconName: string,
        public readonly children?: KvOutlineItem[]
    ) {
        super(label, collapsibleState);
        
        this.iconPath = new vscode.ThemeIcon(iconName);
        this.tooltip = `${label} (line ${range.start.line + 1})`;
        this.contextValue = 'kvOutlineItem';
        
        // Make it clickable to jump to the location
        this.command = {
            command: 'kvOutline.gotoLocation',
            title: 'Go to Location',
            arguments: [range]
        };
    }
}
