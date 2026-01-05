/**
 * WASM Bridge for SwiftyKvLangVCE Swift module
 * 
 * This module loads and interacts with the Swift WASM module compiled
 * from the SwiftyKvLangVCE generator.
 */
import * as vscode from 'vscode';
import * as path from 'path';

export interface GenerateResult {
    success: boolean;
    output: string;
    error?: string;
}

export class WasmBridge {
    private initialized = false;
    private wasmInstance: any = null;
    private extensionPath: string = '';
    
    /**
     * Initialize the WASM module
     * This will load the Swift WASM binary and set up the runtime
     */
    async initialize(extensionPath: string): Promise<void> {
        this.extensionPath = extensionPath;
        
        if (this.initialized) {
            return;
        }
        
        try {
            console.log('[WasmBridge] Loading WASM module...');
            
            // Use our CommonJS loader
            const loaderPath = path.join(extensionPath, 'wasm', 'loader.cjs');
            const { loadWasm } = require(loaderPath);
            
            // Initialize WASM
            const result = await loadWasm();
            this.wasmInstance = result.instance;
            
            console.log('[WasmBridge] WASM module loaded successfully');
            console.log('[WasmBridge] Checking for Swift functions...');
            
            // Check if functions are exposed
            if (typeof (globalThis as any).extractKvSymbols === 'function') {
                console.log('[WasmBridge] ✅ extractKvSymbols is available');
            } else {
                console.log('[WasmBridge] ⚠️ extractKvSymbols not yet available');
            }
            
            if (typeof (globalThis as any).getKvCompletions === 'function') {
                console.log('[WasmBridge] ✅ getKvCompletions is available');
            } else {
                console.log('[WasmBridge] ⚠️ getKvCompletions not yet available');
            }
            
            if (typeof (globalThis as any).generatePythonClassesFromKv === 'function') {
                console.log('[WasmBridge] ✅ generatePythonClassesFromKv is available');
            } else {
                console.log('[WasmBridge] ⚠️ generatePythonClassesFromKv not yet available');
            }
            
            this.initialized = true;
        } catch (error) {
            console.error('[WasmBridge] Failed to initialize WASM:', error);
            // Don't throw - just log and continue without WASM
            console.log('[WasmBridge] Continuing without WASM support');
        }
    }
    /**
     * Get completion suggestions for KV code
     * @param kvCode The KV language source code
     * @param line Line number (0-based)
     * @param character Character position in line (0-based)
     * @returns Array of completion items
     */
    async getCompletions(kvCode: string, line: number, character: number): Promise<vscode.CompletionList> {
        if (!this.initialized && this.extensionPath) {
            await this.initialize(this.extensionPath);
        }
        
        try {
            // Call Swift WASM function if available
            if (typeof (globalThis as any).getKvCompletions === 'function') {
                console.log(`[WasmBridge] Calling getKvCompletions(line=${line}, char=${character})`);
                const result = (globalThis as any).getKvCompletions(kvCode, line, character);
                console.log('[WasmBridge] getKvCompletions result type:', typeof result, result);
                
                // Result could be array directly or need parsing
                if (Array.isArray(result)) {
                    console.log('[WasmBridge] Got array with', result.length, 'completions');
                    console.log('[WasmBridge] First completion:', JSON.stringify(result[0], null, 2));
                    return {
                        items: result,
                        isIncomplete: false
                    };
                }
                if (typeof result === 'string') {
                    const parsed = JSON.parse(result);
                    console.log('[WasmBridge] Parsed string to array with', parsed.length, 'completions');
                    
                    return {
                        items: parsed,
                        isIncomplete: false
                    };
                }
                console.log('[WasmBridge] Unexpected result type, returning empty');
                return {
                        items: [],
                        isIncomplete: false
                    };
            }
            
            // Fallback: return empty array if WASM not loaded
            console.log('[WasmBridge] getKvCompletions not available yet');
            return {
                        items: [],
                        isIncomplete: false
                    };
        } catch (error) {
            console.error('[WasmBridge] Error getting completions:', error);
            return {
                        items: [],
                        isIncomplete: false
                    };
        }
    }

    /**
     * Extract document symbols from KV code for outline view
     * @param kvCode The KV language source code
     * @returns Array of symbols (will be implemented in Swift WASM)
     */
    async extractSymbols(kvCode: string): Promise<any[]> {
        if (!this.initialized && this.extensionPath) {
            await this.initialize(this.extensionPath);
        }
        
        try {
            // Call Swift WASM function if available
            if (typeof (globalThis as any).extractKvSymbols === 'function') {
                console.log('[WasmBridge] Calling extractKvSymbols');
                const result = (globalThis as any).extractKvSymbols(kvCode);
                console.log('[WasmBridge] extractKvSymbols result type:', typeof result);
                
                if (typeof result === 'string') {
                    const parsed = JSON.parse(result);
                    // Check if it's an error object
                    if (parsed.error) {
                        console.error('[WasmBridge] Parser error:', parsed.error);
                        return [];
                    }
                    console.log('[WasmBridge] Parsed', parsed.length, 'symbols');
                    return parsed;
                }
                return [];
            }
            
            // Fallback: return empty array if WASM not loaded
            console.log('[WasmBridge] extractKvSymbols not available yet');
            return [];
        } catch (error) {
            console.error('[WasmBridge] Error extracting symbols:', error);
            return [];
        }
    }
    
    /**
     * Generate Python classes from KV and Python code
     * @param kvCode The KV language source code
     * @param pythonCode The existing Python code (optional)
     * @returns Generated Python code or error message
     */
    async generatePythonClasses(kvCode: string, pythonCode: string = ''): Promise<GenerateResult> {
        if (!this.initialized && this.extensionPath) {
            await this.initialize(this.extensionPath);
        }
        
        try {
            if (!kvCode.trim()) {
                return {
                    success: false,
                    output: '',
                    error: 'KV code is empty'
                };
            }
            
            // Call Swift WASM function if available
            if (typeof (globalThis as any).generatePythonClassesFromKv === 'function') {
                const result = (globalThis as any).generatePythonClassesFromKv(kvCode, pythonCode);
                if (typeof result === 'string') {
                    return {
                        success: true,
                        output: result,
                        error: undefined
                    };
                }
            }
            
            // Fallback: return mock output if WASM not loaded
            console.log('[WasmBridge] generatePythonClassesFromKv not available, using mock output');
            const output = this.generateMockOutput(kvCode, pythonCode);
            
            return {
                success: true,
                output: output,
                error: 'WASM module not loaded - showing placeholder'
            };
        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    
    /**
     * Add widget to KV code at specified position with AST-aware collision detection
     * @param kvCode The current KV code
     * @param widgetSnippet The widget snippet to insert
     * @param line Line number where widget is being dropped (0-based)
     * @param column Column position (0-based)
     * @returns Result with new KV code or error
     */
    async addWidgetToKv(kvCode: string, widgetSnippet: string, line: number, column: number): Promise<{ success: boolean; kvCode?: string; error?: string }> {
        try {
            // Call Swift WASM function if available
            if (typeof (globalThis as any).addWidgetToKv === 'function') {
                console.log('[WasmBridge] Calling addWidgetToKv at line', line);
                const result = (globalThis as any).addWidgetToKv(kvCode, widgetSnippet, line, column);
                console.log('[WasmBridge] addWidgetToKv result:', result);
                
                if (typeof result === 'string') {
                    const parsed = JSON.parse(result);
                    return parsed;
                }
            }
            
            // Fallback: simple insertion at position
            console.log('[WasmBridge] addWidgetToKv not available, using fallback');
            return {
                success: false,
                error: 'WASM function not available'
            };
        } catch (error) {
            console.error('[WasmBridge] Error adding widget:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    
    /**
     * Generate mock output for testing
     * This will be replaced with actual WASM calls
     */
    private generateMockOutput(kvCode: string, pythonCode: string): string {
        const lines: string[] = [];
        
        lines.push('# Generated Python Classes from KV');
        lines.push('# TODO: Replace with actual WASM-generated output');
        lines.push('');
        lines.push('from kivy.uix.boxlayout import BoxLayout');
        lines.push('from kivy.uix.button import Button');
        lines.push('from kivy.uix.label import Label');
        lines.push('from kivy.app import App');
        lines.push('');
        lines.push('');
        
        // Extract rule/class names from KV (simple regex)
        const ruleMatches = kvCode.matchAll(/<(\w+)(@\w+)?>/g);
        const widgetMatches = kvCode.matchAll(/^\s{4}(\w+):/gm);
        
        const classNames = new Set<string>();
        for (const match of ruleMatches) {
            classNames.add(match[1]);
        }
        
        // Generate mock classes
        for (const className of classNames) {
            lines.push(`class ${className}(BoxLayout):`);
            lines.push('    def __init__(self, **kwargs):');
            lines.push('        super().__init__(**kwargs)');
            lines.push('        self._bindings = []');
            lines.push('        # TODO: Property assignments and bindings');
            lines.push('        # TODO: Child widget creation');
            lines.push('');
            
            // If there's matching Python code, preserve methods
            if (pythonCode.includes(`class ${className}`)) {
                lines.push('    # Methods from original Python file would be preserved here');
            }
            lines.push('');
        }
        
        if (classNames.size === 0) {
            lines.push('# No KV rules found to generate classes');
            lines.push('# KV rules should be defined with <ClassName> or <ClassName@BaseClass>');
        }
        
        return lines.join('\n');
    }
    
    /**
     * Clean up WASM resources
     */
    dispose(): void {
        this.wasmInstance = null;
        this.initialized = false;
    }
}
