import * as vscode from 'vscode';
import { WasmBridge } from './wasmBridge';

export class KvInlayHintsProvider implements vscode.InlayHintsProvider {
    constructor(private readonly wasmBridge: WasmBridge) {}

    async provideInlayHints(
        document: vscode.TextDocument,
        range: vscode.Range,
        token: vscode.CancellationToken
    ): Promise<vscode.InlayHint[]> {
        //console.log('[InlayHints] provideInlayHints called');
        const hints: vscode.InlayHint[] = [];
        const symbols = await this.wasmBridge.extractSymbols(document.getText());
        //console.log('[InlayHints] Got symbols:', symbols.length);
        //console.log('[InlayHints] First symbol:', JSON.stringify(symbols[0], null, 2));
        
        // Process symbols recursively
        this.processSymbols(symbols, hints, document);
        
        //console.log('[InlayHints] Generated hints:', hints.length);
        return hints;
    }

    private processSymbols(symbols: any[], hints: vscode.InlayHint[], document: vscode.TextDocument): void {
        for (const symbol of symbols) {
            if (symbol.children) {
                for (const child of symbol.children) {
                    // Skip "value: ..." child nodes (they're sub-nodes of properties)
                    if (child.name && child.name.startsWith('value:')) {
                        continue;
                    }
                    
                    // Only add hints for properties with type info (kind 6 = Property)
                    if (child.kind === 6 && child.detail && !child.detail.includes('handler') && !child.detail.includes('identifier') && !child.detail.includes('widget') && !child.detail.includes('canvas')) {
                        const lineNumber = child.range.startLineNumber - 1;
                        //console.log(`[InlayHints] Processing property ${child.name} at line ${lineNumber}, type: ${child.detail}`);
                        
                        if (lineNumber >= 0 && lineNumber < document.lineCount) {
                            const line = document.lineAt(lineNumber);
                            const lineText = line.text;
                            
                            // Find the colon
                            const colonIndex = lineText.indexOf(':');
                            if (colonIndex !== -1) {
                                const afterColon = lineText.substring(colonIndex + 1).trimStart();
                                
                                // Position for hint (after the value if present, otherwise after colon)
                                const position = afterColon.length > 0
                                    ? new vscode.Position(lineNumber, line.text.trimEnd().length)
                                    : new vscode.Position(lineNumber, colonIndex + 1);
                                
                                const hint = new vscode.InlayHint(
                                    position,
                                    ` ${child.detail}`,
                                    vscode.InlayHintKind.Type
                                );
                                hint.paddingLeft = true;
                                hint.paddingRight = false;
                                
                                //console.log(`[InlayHints] Added hint for ${child.name}: ${child.detail} at position ${lineNumber}:${position.character}`);
                                hints.push(hint);
                            }
                        }
                    }
                    
                    // Recurse into children
                    if (child.children) {
                        this.processSymbols([child], hints, document);
                    }
                }
            }
        }
    }
}
