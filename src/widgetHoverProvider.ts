import * as vscode from 'vscode';
import { WasmBridge } from './wasmBridge';
import { KivyRenderService } from './kivyRenderService';

export class KvWidgetHoverProvider implements vscode.HoverProvider {
    private renderService: KivyRenderService;
    
    constructor(
        private readonly wasmBridge: WasmBridge,
        context: vscode.ExtensionContext
    ) {
        this.renderService = KivyRenderService.getInstance(context);
    }

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        // Get widget code at cursor position
        const widgetCode = this.extractWidgetAtPosition(document, position);
        
        if (!widgetCode) {
            return undefined;
        }
        
        // Don't render for very simple single-line properties
        if (widgetCode.lineCount < 2) {
            return undefined;
        }
        
        // Create the complete Kivy app code
        const kivyCode = this.createKivyApp(widgetCode.code);
        
        try {
            // Render the widget
            const imageBase64 = await this.renderService.renderKivyCode(kivyCode);
            
            if (!imageBase64) {
                return undefined;
            }
            
            // Create markdown with rendered preview
            const markdown = new vscode.MarkdownString();
            markdown.supportHtml = true;
            markdown.isTrusted = true;
            
            markdown.appendMarkdown(`**Kivy Widget Preview**\n\n`);
            markdown.appendMarkdown(`<img src="data:image/png;base64,${imageBase64}" style="max-width: 400px; max-height: 400px;" />\n\n`);
            markdown.appendMarkdown(`*Hover over widget to see rendered preview*`);
            
            return new vscode.Hover(markdown, widgetCode.range);
            
        } catch (error) {
            console.error('[KvWidgetHover] Error rendering widget:', error);
            return undefined;
        }
    }
    
    private extractWidgetAtPosition(document: vscode.TextDocument, position: vscode.Position): { code: string; range: vscode.Range; lineCount: number } | undefined {
        const line = document.lineAt(position.line);
        const lineText = line.text;
        
        // Check if we're on a widget line (starts with capital letter after whitespace)
        const widgetMatch = lineText.match(/^(\s*)([A-Z]\w*):/);
        if (!widgetMatch) {
            return undefined;
        }
        
        const baseIndent = widgetMatch[1].length;
        const widgetName = widgetMatch[2];
        
        // Extract the entire widget block (all lines with greater indentation)
        const startLine = position.line;
        let endLine = startLine;
        const lines: string[] = [lineText];
        
        // Find all child lines
        for (let i = startLine + 1; i < document.lineCount; i++) {
            const currentLine = document.lineAt(i);
            const currentText = currentLine.text;
            
            // Skip empty lines
            if (currentText.trim() === '') {
                continue;
            }
            
            // Check indentation
            const currentIndent = currentText.search(/\S/);
            if (currentIndent <= baseIndent) {
                // Found a line at same or less indentation - end of widget block
                break;
            }
            
            lines.push(currentText);
            endLine = i;
        }
        
        const code = lines.join('\n');
        const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
        
        return { code, range, lineCount: lines.length };
    }
    
    private createKivyApp(kvCode: string): string {
        // Wrap the KV code in a minimal Kivy app
        return `from kivy.app import App
from kivy.uix.widget import Widget
from kivy.lang import Builder

KV = '''
${kvCode}
'''

class MyApp(App):
    def build(self):
        return Builder.load_string(KV)

if __name__ == '__main__':
    MyApp().run()
`;
    }
}
