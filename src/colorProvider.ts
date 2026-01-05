import * as vscode from 'vscode';
import { WasmBridge } from './wasmBridge';

export class KvColorProvider implements vscode.DocumentColorProvider {
    constructor(private readonly wasmBridge: WasmBridge) {}

    async provideDocumentColors(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<vscode.ColorInformation[]> {
        const colors: vscode.ColorInformation[] = [];
        const symbols = await this.wasmBridge.extractSymbols(document.getText());
        
        // Process symbols recursively to find color properties
        this.processSymbols(symbols, colors, document);
        
        return colors;
    }

    private processSymbols(symbols: any[], colors: vscode.ColorInformation[], document: vscode.TextDocument): void {
        for (const symbol of symbols) {
            if (symbol.children) {
                for (const child of symbol.children) {
                    // Check if this is a color property (kind 6 = Property)
                    const isColorProperty = child.kind === 6 && 
                        (child.detail === 'ColorProperty' || child.detail === 'color');
                    
                    if (isColorProperty) {
                        const lineNumber = child.range.startLineNumber - 1;
                        
                        if (lineNumber >= 0 && lineNumber < document.lineCount) {
                            const line = document.lineAt(lineNumber);
                            const lineText = line.text;
                            
                            // Find the colon and get the value
                            const colonIndex = lineText.indexOf(':');
                            if (colonIndex !== -1) {
                                const afterColon = lineText.substring(colonIndex + 1).trimStart();
                                const color = this.parseColor(afterColon);
                                
                                if (color) {
                                    // Calculate the range for the color value
                                    const startPos = colonIndex + 1 + (lineText.substring(colonIndex + 1).length - afterColon.length);
                                    const endPos = startPos + afterColon.trimEnd().length;
                                    const range = new vscode.Range(
                                        new vscode.Position(lineNumber, startPos),
                                        new vscode.Position(lineNumber, endPos)
                                    );
                                    
                                    colors.push(new vscode.ColorInformation(range, color));
                                }
                            }
                        }
                    }
                    
                    // Recurse into children
                    if (child.children) {
                        this.processSymbols([child], colors, document);
                    }
                }
            }
        }
    }

    provideColorPresentations(
        color: vscode.Color,
        context: { document: vscode.TextDocument; range: vscode.Range },
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.ColorPresentation[]> {
        const presentations: vscode.ColorPresentation[] = [];
        
        // Check if the property is 'rgb' or 'rgba' by looking at the line
        const line = context.document.lineAt(context.range.start.line);
        const lineText = line.text;
        const isRgbaProperty = lineText.includes('rgba:');
        const isRgbProperty = lineText.includes('rgb:') && !isRgbaProperty;
        
        // If it's rgb property (not rgba), force alpha to 1
        const effectiveAlpha = isRgbProperty ? 1 : color.alpha;
        
        // Raw comma-separated format (no parentheses)
        if (!isRgbProperty) {
            const rawRGBA = `${color.red.toFixed(2)}, ${color.green.toFixed(2)}, ${color.blue.toFixed(2)}, ${effectiveAlpha.toFixed(2)}`;
            presentations.push(new vscode.ColorPresentation(rawRGBA));
        }
        
        const rawRGB = `${color.red.toFixed(2)}, ${color.green.toFixed(2)}, ${color.blue.toFixed(2)}`;
        presentations.push(new vscode.ColorPresentation(rawRGB));
        
        // Kivy tuple format
        if (!isRgbProperty) {
            const tupleRGBA = `(${color.red.toFixed(2)}, ${color.green.toFixed(2)}, ${color.blue.toFixed(2)}, ${effectiveAlpha.toFixed(2)})`;
            presentations.push(new vscode.ColorPresentation(tupleRGBA));
        }
        
        const tupleRGB = `(${color.red.toFixed(2)}, ${color.green.toFixed(2)}, ${color.blue.toFixed(2)})`;
        presentations.push(new vscode.ColorPresentation(tupleRGB));
        
        // Hex format #rrggbb or #rrggbbaa
        const r = Math.round(color.red * 255).toString(16).padStart(2, '0');
        const g = Math.round(color.green * 255).toString(16).padStart(2, '0');
        const b = Math.round(color.blue * 255).toString(16).padStart(2, '0');
        const hex = `#${r}${g}${b}`;
        presentations.push(new vscode.ColorPresentation(hex));
        
        if (!isRgbProperty && effectiveAlpha < 1) {
            const a = Math.round(effectiveAlpha * 255).toString(16).padStart(2, '0');
            const hexAlpha = `#${r}${g}${b}${a}`;
            presentations.push(new vscode.ColorPresentation(hexAlpha));
        }
        
        return presentations;
    }

    private parseColor(colorValue: string): vscode.Color | undefined {
        // Parse Kivy color formats:
        // - Tuple: (r, g, b) or (r, g, b, a) with values 0-1
        // - List: [r, g, b] or [r, g, b, a]
        // - Raw values: r, g, b or r, g, b, a (without parentheses)
        // - Hex: '#rrggbb' or '#rrggbbaa'
        
        const trimmed = colorValue.trim();
        
        // Parse tuple/list format: (r, g, b, a) or [r, g, b, a]
        const tupleMatch = trimmed.match(/^[\(\[](.+)[\)\]]$/);
        if (tupleMatch) {
            const parts = tupleMatch[1].split(',').map(s => parseFloat(s.trim()));
            if (parts.length >= 3 && parts.every(n => !isNaN(n))) {
                const r = Math.max(0, Math.min(1, parts[0]));
                const g = Math.max(0, Math.min(1, parts[1]));
                const b = Math.max(0, Math.min(1, parts[2]));
                const a = parts.length >= 4 ? Math.max(0, Math.min(1, parts[3])) : 1;
                return new vscode.Color(r, g, b, a);
            }
        }
        
        // Parse raw comma-separated values: r, g, b or r, g, b, a
        if (!tupleMatch && trimmed.includes(',')) {
            const parts = trimmed.split(',').map(s => parseFloat(s.trim()));
            if (parts.length >= 3 && parts.every(n => !isNaN(n))) {
                const r = Math.max(0, Math.min(1, parts[0]));
                const g = Math.max(0, Math.min(1, parts[1]));
                const b = Math.max(0, Math.min(1, parts[2]));
                const a = parts.length >= 4 ? Math.max(0, Math.min(1, parts[3])) : 1;
                return new vscode.Color(r, g, b, a);
            }
        }
        
        // Parse hex format: #rrggbb or #rrggbbaa
        const hexMatch = trimmed.match(/^['"]?#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})['"]?$/);
        if (hexMatch) {
            const hex = hexMatch[1];
            const r = parseInt(hex.substring(0, 2), 16) / 255;
            const g = parseInt(hex.substring(2, 4), 16) / 255;
            const b = parseInt(hex.substring(4, 6), 16) / 255;
            const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;
            return new vscode.Color(r, g, b, a);
        }
        
        return undefined;
    }
}
