import * as vscode from 'vscode';
import { WasmBridge } from './wasmBridge';

interface MonacoRange {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
}

interface MonacoDocumentSymbol {
    name: string;
    detail?: string;
    kind: number;
    range: MonacoRange;
    selectionRange: MonacoRange;
    children?: MonacoDocumentSymbol[];
}

export class KvSymbolProvider implements vscode.DocumentSymbolProvider {
    constructor(private readonly wasmBridge: WasmBridge) {}
    
    async provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<vscode.DocumentSymbol[]> {
        const symbols = await this.wasmBridge.extractSymbols(document.getText());
        return symbols.map(s => this.toVSCodeSymbol(s, document));
    }

    private toVSCodeSymbol(s: MonacoDocumentSymbol, doc: vscode.TextDocument): vscode.DocumentSymbol {
        // Convert Monaco 1-based to VSCode 0-based ranges
        const range = new vscode.Range(
            s.range.startLineNumber - 1,
            s.range.startColumn - 1,
            s.range.endLineNumber - 1,
            s.range.endColumn - 1
        );
        const selectionRange = new vscode.Range(
            s.selectionRange.startLineNumber - 1,
            s.selectionRange.startColumn - 1,
            s.selectionRange.endLineNumber - 1,
            s.selectionRange.endColumn - 1
        );
        
        const symbol = new vscode.DocumentSymbol(s.name, s.detail || '', s.kind, range, selectionRange);
        if (s.children) {
            symbol.children = s.children.map(c => this.toVSCodeSymbol(c, doc));
        }
        return symbol;
    }
}
