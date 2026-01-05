import * as vscode from 'vscode';
import { WasmBridge } from './wasmBridge';
import { PairedFileManager } from './pairedFileManager';

export class DiagnosticsProvider {
    private readonly diagnosticCollection: vscode.DiagnosticCollection;
    private readonly wasmBridge: WasmBridge;
    private readonly pairedFileManager: PairedFileManager;
    
    constructor(
        wasmBridge: WasmBridge,
        pairedFileManager: PairedFileManager
    ) {
        this.wasmBridge = wasmBridge;
        this.pairedFileManager = pairedFileManager;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('kv');
    }
    
    /**
     * Update diagnostics for a KV file
     * @param document The text document to check
     */
    async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
        // Only process .kv files
        if (document.languageId !== 'kv') {
            return;
        }
        
        try {
            const kvContent = document.getText();
            const pairedFiles = await this.pairedFileManager.findPairedFiles(document.uri);
            const { pyContent } = await this.pairedFileManager.getFileContents(pairedFiles);
            
            // Try to generate code to detect errors
            const result = await this.wasmBridge.generatePythonClasses(kvContent, pyContent);
            
            if (result.success) {
                // Clear diagnostics if generation succeeded
                this.diagnosticCollection.set(document.uri, []);
            } else if (result.error) {
                // Parse error message and create diagnostic
                const diagnostics = this.parseError(result.error, document);
                this.diagnosticCollection.set(document.uri, diagnostics);
            }
        } catch (error) {
            console.error('Error updating diagnostics:', error);
            // Don't show diagnostics for internal errors
            this.diagnosticCollection.set(document.uri, []);
        }
    }
    
    /**
     * Parse error message and create diagnostic objects
     * @param errorMessage The error message from the generator
     * @param document The document being analyzed
     * @returns Array of diagnostic objects
     */
    private parseError(errorMessage: string, document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        
        // Try to extract line and column information from error message
        // Common formats:
        // - "Error at line 5, column 10: ..."
        // - "Line 5: ..."
        // - "Parse error on line 5: ..."
        
        const lineColMatch = errorMessage.match(/line\s+(\d+)(?:,?\s+column\s+(\d+))?/i);
        
        if (lineColMatch) {
            const lineNum = parseInt(lineColMatch[1], 10) - 1; // Convert to 0-based
            const colNum = lineColMatch[2] ? parseInt(lineColMatch[2], 10) - 1 : 0;
            
            // Validate line number
            if (lineNum >= 0 && lineNum < document.lineCount) {
                const line = document.lineAt(lineNum);
                const startPos = new vscode.Position(lineNum, colNum);
                const endPos = line.range.end;
                
                const diagnostic = new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    errorMessage,
                    vscode.DiagnosticSeverity.Error
                );
                
                diagnostic.source = 'kv-to-pyclass';
                diagnostics.push(diagnostic);
            } else {
                // Line number out of range, show at end of document
                this.addGenericDiagnostic(diagnostics, errorMessage, document);
            }
        } else {
            // No line information, show at beginning of document
            this.addGenericDiagnostic(diagnostics, errorMessage, document);
        }
        
        return diagnostics;
    }
    
    /**
     * Add a generic diagnostic at the beginning of the document
     */
    private addGenericDiagnostic(
        diagnostics: vscode.Diagnostic[],
        errorMessage: string,
        document: vscode.TextDocument
    ): void {
        const firstLine = document.lineAt(0);
        const diagnostic = new vscode.Diagnostic(
            firstLine.range,
            errorMessage,
            vscode.DiagnosticSeverity.Error
        );
        diagnostic.source = 'kv-to-pyclass';
        diagnostics.push(diagnostic);
    }
    
    /**
     * Clear all diagnostics
     */
    clear(): void {
        this.diagnosticCollection.clear();
    }
    
    /**
     * Clear diagnostics for a specific document
     */
    clearForDocument(uri: vscode.Uri): void {
        this.diagnosticCollection.delete(uri);
    }
    
    /**
     * Dispose of the diagnostic collection
     */
    dispose(): void {
        this.diagnosticCollection.dispose();
    }
}
