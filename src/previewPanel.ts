import * as vscode from 'vscode';
import { WasmBridge } from './wasmBridge';
import { PairedFileManager } from './pairedFileManager';

export class PreviewPanel {
    private panel: vscode.WebviewPanel | undefined;
    private readonly wasmBridge: WasmBridge;
    private readonly pairedFileManager: PairedFileManager;
    private updateTimeout: NodeJS.Timeout | undefined;
    private currentKvUri: vscode.Uri | undefined;
    
    constructor(
        private readonly context: vscode.ExtensionContext,
        wasmBridge: WasmBridge,
        pairedFileManager: PairedFileManager
    ) {
        this.wasmBridge = wasmBridge;
        this.pairedFileManager = pairedFileManager;
    }
    
    /**
     * Show or focus the preview panel
     * @param kvUri The URI of the .kv file to preview
     */
    async show(kvUri: vscode.Uri): Promise<void> {
        this.currentKvUri = kvUri;
        const column = this.getPreviewColumn();
        
        if (this.panel) {
            // Panel already exists, reveal it
            this.panel.reveal(column);
        } else {
            // Create new panel
            this.panel = vscode.window.createWebviewPanel(
                'swiftyKvLangPreview',
                'KV Preview',
                column,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(this.context.extensionUri, 'media')
                    ]
                }
            );
            
            this.panel.iconPath = {
                light: vscode.Uri.joinPath(this.context.extensionUri, 'media', 'preview-light.svg'),
                dark: vscode.Uri.joinPath(this.context.extensionUri, 'media', 'preview-dark.svg')
            };
            
            // Handle panel disposal
            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });
            
            // Set initial content
            this.panel.webview.html = this.getLoadingHtml();
        }
        
        // Update content
        await this.updatePreview();
    }
    
    /**
     * Update the preview content
     */
    async updatePreview(): Promise<void> {
        if (!this.panel || !this.currentKvUri) {
            return;
        }
        
        try {
            // Find paired files
            const pairedFiles = await this.pairedFileManager.findPairedFiles(this.currentKvUri);
            const { kvContent, pyContent } = await this.pairedFileManager.getFileContents(pairedFiles);
            
            // Update panel title
            const fileName = this.currentKvUri.fsPath.split('/').pop() || 'Unknown';
            this.panel.title = `KV Preview: ${fileName}`;
            
            // Generate Python code
            const result = await this.wasmBridge.generatePythonClasses(kvContent, pyContent);
            
            // Update webview
            this.panel.webview.html = this.getPreviewHtml(result.output, result.error);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.panel.webview.html = this.getErrorHtml(errorMsg);
        }
    }
    
    /**
     * Schedule a preview update with debouncing
     */
    scheduleUpdate(): void {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        
        const config = vscode.workspace.getConfiguration('swiftyKvLang');
        const delay = config.get<number>('debounceDelay', 500);
        
        this.updateTimeout = setTimeout(() => {
            this.updatePreview();
        }, delay);
    }
    
    /**
     * Determine which column to show the preview in
     */
    private getPreviewColumn(): vscode.ViewColumn {
        const config = vscode.workspace.getConfiguration('swiftyKvLang');
        const previewOnSide = config.get<boolean>('previewOnSide', true);
        
        if (!previewOnSide) {
            return vscode.ViewColumn.Active;
        }
        
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return vscode.ViewColumn.Two;
        }
        
        switch (activeEditor.viewColumn) {
            case vscode.ViewColumn.One:
                return vscode.ViewColumn.Two;
            case vscode.ViewColumn.Two:
                return vscode.ViewColumn.Three;
            default:
                return vscode.ViewColumn.Three;
        }
    }
    
    /**
     * Generate HTML for loading state
     */
    private getLoadingHtml(): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KV Preview</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-size: 16px;
        }
    </style>
</head>
<body>
    <div class="loading">Loading preview...</div>
</body>
</html>`;
    }
    
    /**
     * Generate HTML for preview content
     */
    private getPreviewHtml(output: string, error?: string): string {
        const escapedOutput = this.escapeHtml(output);
        const errorSection = error ? `
            <div class="error">
                <strong>Error:</strong> ${this.escapeHtml(error)}
            </div>
        ` : '';
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KV Preview</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 0;
            margin: 0;
        }
        .header {
            padding: 12px 20px;
            background-color: var(--vscode-editorGroupHeader-tabsBackground);
            border-bottom: 1px solid var(--vscode-editorGroup-border);
            font-size: 13px;
            font-weight: 600;
        }
        .content {
            padding: 0;
        }
        .error {
            padding: 16px 20px;
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
            margin: 16px 20px;
            border-radius: 3px;
        }
        pre {
            margin: 0;
            padding: 16px 20px;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            line-height: 1.5;
            overflow-x: auto;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        code {
            font-family: var(--vscode-editor-font-family);
        }
        .keyword { color: var(--vscode-symbolIcon-keywordForeground, #569cd6); }
        .string { color: var(--vscode-symbolIcon-stringForeground, #ce9178); }
        .comment { color: var(--vscode-descriptionForeground, #6a9955); }
        .class-name { color: var(--vscode-symbolIcon-classForeground, #4ec9b0); }
        .function { color: var(--vscode-symbolIcon-functionForeground, #dcdcaa); }
    </style>
</head>
<body>
    <div class="header">Generated Python Code</div>
    ${errorSection}
    <div class="content">
        <pre><code>${this.highlightPython(escapedOutput)}</code></pre>
    </div>
</body>
</html>`;
    }
    
    /**
     * Generate HTML for error state
     */
    private getErrorHtml(error: string): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KV Preview - Error</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .error {
            padding: 16px;
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="error">
        <strong>Error generating preview:</strong><br>
        ${this.escapeHtml(error)}
    </div>
</body>
</html>`;
    }
    
    /**
     * Escape HTML special characters
     */
    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    /**
     * Simple Python syntax highlighting
     */
    private highlightPython(code: string): string {
        // Keywords - use HTML entities since code is already escaped
        code = code.replace(
            /\b(class|def|import|from|return|if|elif|else|for|while|try|except|finally|with|as|raise|pass|break|continue|yield|lambda|async|await|super|self|__init__|None|True|False)\b/g,
            '<span class="keyword">$1</span>'
        );
        
        // Strings (quotes are already HTML entities)
        code = code.replace(
            /(&quot;[^&]*&quot;|&#39;[^&#]*&#39;)/g,
            '<span class="string">$1</span>'
        );
        
        // Comments
        code = code.replace(
            /#[^\n]*/g,
            '<span class="comment">$&</span>'
        );
        
        // Class names (after 'class' keyword)
        code = code.replace(
            /(<span class="keyword">class<\/span>)\s+(\w+)/g,
            '$1 <span class="class-name">$2</span>'
        );
        
        // Function names (after 'def' keyword)
        code = code.replace(
            /(<span class="keyword">def<\/span>)\s+(\w+)/g,
            '$1 <span class="function">$2</span>'
        );
        
        return code;
    }
    
    /**
     * Dispose of the preview panel
     */
    dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
        
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
    }
}
