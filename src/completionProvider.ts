import * as vscode from 'vscode';
import { WasmBridge } from './wasmBridge';

interface MonacoRange {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
}

interface MonacoCompletionItem {
    label: string | { label: string; detail?: string };
    kind: number;
    detail?: string;
    documentation?: string | { value: string };
    insertText: string;
    insertTextFormat?: number;
    range?: MonacoRange;
    sortText?: string;
    filterText?: string;
}

export class KvCompletionProvider implements vscode.CompletionItemProvider {
    constructor(private wasmBridge: WasmBridge) {}

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.CompletionList> {
        const result = await this.wasmBridge.getCompletions(
            document.getText(),
            position.line,
            position.character
        );
        
        const items = result.items.map((m: any) => this.toVSCodeCompletion(m));
        return new vscode.CompletionList(items, result.isIncomplete);
    }

    private toVSCodeCompletion(m: MonacoCompletionItem): vscode.CompletionItem {
        const label = typeof m.label === 'string' ? m.label : m.label.label;
        const item = new vscode.CompletionItem(label, m.kind);
        
        if (m.detail) item.detail = m.detail;
        if (m.sortText) item.sortText = m.sortText;
        if (m.filterText) item.filterText = m.filterText;
        
        if (m.documentation) {
            item.documentation = typeof m.documentation === 'string' 
                ? m.documentation 
                : m.documentation.value;
        }
        
        // insertTextFormat: 1=PlainText, 2=Snippet (same in Monaco & VSCode)
        if (m.insertTextFormat === 2) {
            item.insertText = new vscode.SnippetString(m.insertText);
        } else {
            item.insertText = m.insertText;
        }
        
        if (m.range) {
            item.range = new vscode.Range(
                m.range.startLineNumber - 1,
                m.range.startColumn - 1,
                m.range.endLineNumber - 1,
                m.range.endColumn - 1
            );
        }
        
        return item;
    }
}
