import * as vscode from 'vscode';
import { WasmBridge } from './wasmBridge';
import { PairedFileManager } from './pairedFileManager';
import { PreviewPanel } from './previewPanel';
import { VncPreviewPanel } from './vncPreviewPanel';
import { DiagnosticsProvider } from './diagnosticsProvider';
import { KvSymbolProvider } from './symbolProvider';
import { KvCompletionProvider } from './completionProvider';
import { KvInlayHintsProvider } from './inlayHintsProvider';
import { KvColorProvider } from './colorProvider';
import { KvHoverProvider } from './hoverProvider';
import { KvWidgetHoverProvider } from './widgetHoverProvider';
import { KivyRenderService } from './kivyRenderService';
import { KvFilesProvider, KvWidgetsProvider } from './kvExplorerView';
import { KvOutlineProvider } from './kvOutlineProvider';

let wasmBridge: WasmBridge;
let pairedFileManager: PairedFileManager;
let previewPanel: PreviewPanel;
let diagnosticsProvider: DiagnosticsProvider;
let autoGenerateEnabled = true;

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('🚀 SwiftyKvLangVCE extension is now active!');
    vscode.window.showInformationMessage('SwiftyKvLangVCE extension activated!');
    
    // Initialize components
    wasmBridge = new WasmBridge();
    pairedFileManager = new PairedFileManager();
    previewPanel = new PreviewPanel(context, wasmBridge, pairedFileManager);
    diagnosticsProvider = new DiagnosticsProvider(wasmBridge, pairedFileManager);
    
    // Get initial configuration
    const config = vscode.workspace.getConfiguration('swiftyKvLang');
    autoGenerateEnabled = config.get<boolean>('autoGenerate', true);
    
    console.log('✅ All components initialized');
    
    // Initialize WASM module
    try {
        console.log('🔧 Initializing WASM module...');
        await wasmBridge.initialize(context.extensionPath);
        console.log('✅ WASM bridge initialized successfully');
    } catch (error) {
        console.error('❌ WASM initialization error:', error);
        vscode.window.showErrorMessage(
            `Failed to initialize SwiftyKvLangVCE: ${error instanceof Error ? error.message : String(error)}`
        );
    }
    
    // Register commands
    registerCommands(context);
    
    // Register language providers
    registerLanguageProviders(context);
    
    // Register sidebar views
    registerSidebarViews(context);
    
    // Set up file watchers and event listeners
    setupEventListeners(context);
    
    // Update diagnostics for currently open KV files
    vscode.workspace.textDocuments.forEach(doc => {
        if (doc.languageId === 'kv') {
            diagnosticsProvider.updateDiagnostics(doc);
        }
    });
    
    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get<boolean>('hasShownWelcome', false);
    if (!hasShownWelcome) {
        vscode.window.showInformationMessage(
            'SwiftyKvLangVCE extension activated! Open a .kv file to get started.',
            'Show Example'
        ).then(selection => {
            if (selection === 'Show Example') {
                vscode.env.openExternal(vscode.Uri.parse(
                    'https://github.com/kivy/kivy/wiki/Kv-Language-Guide'
                ));
            }
        });
        context.globalState.update('hasShownWelcome', true);
    }
}

/**
 * Register all extension commands
 */
function registerCommands(context: vscode.ExtensionContext) {
    // Command: Generate Python Class
    const generateCommand = vscode.commands.registerCommand(
        'swiftyKvLang.generatePythonClass',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'kv') {
                vscode.window.showWarningMessage('Please open a .kv file first');
                return;
            }
            
            try {
                const kvUri = editor.document.uri;
                const pairedFiles = await pairedFileManager.findPairedFiles(kvUri);
                const { kvContent, pyContent } = await pairedFileManager.getFileContents(pairedFiles);
                
                const result = await wasmBridge.generatePythonClasses(kvContent, pyContent);
                
                if (result.success) {
                    // Create a new untitled document with the generated code
                    const doc = await vscode.workspace.openTextDocument({
                        content: result.output,
                        language: 'python'
                    });
                    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
                    vscode.window.showInformationMessage('Python class generated successfully!');
                } else {
                    vscode.window.showErrorMessage(`Generation failed: ${result.error}`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Error: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );
    
    // Command: Show Preview Panel
    const previewCommand = vscode.commands.registerCommand(
        'swiftyKvLang.showPreview',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'kv') {
                vscode.window.showWarningMessage('Please open a .kv file first');
                return;
            }
            
            await previewPanel.show(editor.document.uri);
        }
    );
    
    // Command: Toggle Auto-Generate
    const toggleAutoGenerateCommand = vscode.commands.registerCommand(
        'swiftyKvLang.toggleAutoGenerate',
        () => {
            autoGenerateEnabled = !autoGenerateEnabled;
            const config = vscode.workspace.getConfiguration('swiftyKvLang');
            config.update('autoGenerate', autoGenerateEnabled, vscode.ConfigurationTarget.Global);
            
            const status = autoGenerateEnabled ? 'enabled' : 'disabled';
            vscode.window.showInformationMessage(`Auto-generate ${status}`);
        }
    );
    
    // Command: Show VNC Live Preview - Instance Selector
    const vncPreviewCommand = vscode.commands.registerCommand(
        'swiftyKvLang.showVncPreview',
        async () => {
            try {
                await VncPreviewPanel.showInstanceSelector(context);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to open VNC preview: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );
    
    // Command: Show VNC Live Preview - Instance 1
    const vncPreview1Command = vscode.commands.registerCommand(
        'swiftyKvLang.showVncPreview1',
        async () => {
            try {
                const panel = VncPreviewPanel.getInstance(context, 1);
                await panel.show();
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to open VNC preview (Instance 1): ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );
    
    // Command: Show VNC Live Preview - Instance 2
    const vncPreview2Command = vscode.commands.registerCommand(
        'swiftyKvLang.showVncPreview2',
        async () => {
            try {
                const panel = VncPreviewPanel.getInstance(context, 2);
                await panel.show();
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to open VNC preview (Instance 2): ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );
    
    context.subscriptions.push(generateCommand);
    context.subscriptions.push(previewCommand);
    context.subscriptions.push(toggleAutoGenerateCommand);
    context.subscriptions.push(vncPreviewCommand);
    context.subscriptions.push(vncPreview1Command);
    context.subscriptions.push(vncPreview2Command);
}

/**
 * Register language feature providers
 */
function registerLanguageProviders(context: vscode.ExtensionContext) {
    // Register document symbol provider for outline view
    const symbolProvider = vscode.languages.registerDocumentSymbolProvider(
        { language: 'kv', scheme: 'file' },
        new KvSymbolProvider(wasmBridge)
    );
    
    // Register completion provider
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        { language: 'kv', scheme: 'file' },
        new KvCompletionProvider(wasmBridge)
    );

    // Register inlay hints provider for property types
    const inlayHintsProvider = vscode.languages.registerInlayHintsProvider(
        { language: 'kv', scheme: 'file' },
        new KvInlayHintsProvider(wasmBridge)
    );

    // Register color provider for color properties
    const colorProvider = vscode.languages.registerColorProvider(
        { language: 'kv', scheme: 'file' },
        new KvColorProvider(wasmBridge)
    );

    // Register hover provider for image previews
    const hoverProvider = vscode.languages.registerHoverProvider(
        { language: 'kv', scheme: 'file' },
        new KvHoverProvider(wasmBridge)
    );

    // Register widget hover provider for rendered previews (DISABLED - doctor-kivy integration needs work)
    // const widgetHoverProvider = vscode.languages.registerHoverProvider(
    //     { language: 'kv', scheme: 'file' },
    //     new KvWidgetHoverProvider(wasmBridge, context)
    // );

    // Start the Kivy render service (optional, only if enabled)
    const renderConfig = vscode.workspace.getConfiguration('swiftyKvLang');
    const enableRenderPreview = renderConfig.get<boolean>('enableRenderPreview', false);
    
    if (enableRenderPreview) {
        const renderService = KivyRenderService.getInstance(context);
        renderService.start().catch(error => {
            console.error('[KivyRender] Failed to start:', error);
            vscode.window.showWarningMessage(
                'Kivy render service failed to start. Widget previews will not be available.'
            );
        });
    }

    context.subscriptions.push(symbolProvider);
    context.subscriptions.push(completionProvider);
    context.subscriptions.push(inlayHintsProvider);
    context.subscriptions.push(colorProvider);
    context.subscriptions.push(hoverProvider);
    // context.subscriptions.push(widgetHoverProvider); // DISABLED - doctor-kivy integration needs work
    
    console.log('✅ Language providers registered');
}

/**
 * Register sidebar views in the Activity Bar
 */
function registerSidebarViews(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    
    // Register KV Files view
    const kvFilesProvider = new KvFilesProvider(workspaceRoot);
    const kvFilesView = vscode.window.registerTreeDataProvider(
        'kvFilesView',
        kvFilesProvider
    );
    
    // Register KV Widgets view with drag and drop support
    const kvWidgetsProvider = new KvWidgetsProvider();
    const kvWidgetsView = vscode.window.createTreeView('kvWidgetsView', {
        treeDataProvider: kvWidgetsProvider,
        dragAndDropController: kvWidgetsProvider
    });
    
    // Add refresh command
    const refreshCommand = vscode.commands.registerCommand('kvExplorer.refresh', () => {
        kvFilesProvider.refresh();
        kvWidgetsProvider.refresh();
    });
    
    // Add insert widget command
    const insertWidgetCommand = vscode.commands.registerCommand('kvExplorer.insertWidget', (snippet: string) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'kv') {
            const position = editor.selection.active;
            editor.edit(editBuilder => {
                editBuilder.insert(position, snippet);
            });
        } else {
            vscode.window.showWarningMessage('Please open a .kv file to insert widgets');
        }
    });
    
    context.subscriptions.push(kvFilesView, kvWidgetsView, refreshCommand, insertWidgetCommand);
    
    // Register KV Outline view with drop support
    const kvOutlineProvider = new KvOutlineProvider(wasmBridge);
    const kvOutlineView = vscode.window.createTreeView('kvOutlineView', {
        treeDataProvider: kvOutlineProvider,
        dragAndDropController: kvOutlineProvider
    });
    
    // Register goto location command for outline
    const gotoLocationCommand = vscode.commands.registerCommand('kvOutline.gotoLocation', (range: vscode.Range) => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.selection = new vscode.Selection(range.start, range.start);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        }
    });
    
    // Update outline when active editor changes
    const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.languageId === 'kv') {
            console.log('[KvOutline] Active editor changed to KV file');
            kvOutlineProvider.refresh(editor.document);
        }
    });
    
    // Update outline when document changes
    const docChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document && editor.document.languageId === 'kv') {
            // Debounce updates
            setTimeout(() => kvOutlineProvider.refresh(event.document), 500);
        }
    });
    
    // Initial outline refresh if a KV file is open
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.languageId === 'kv') {
        console.log('[KvOutline] Performing initial refresh for open KV file');
        kvOutlineProvider.refresh(activeEditor.document);
    }
    
    context.subscriptions.push(kvOutlineView, gotoLocationCommand, editorChangeListener, docChangeListener);
    
    // Register document drop handler for drag and drop from tree view to editor
    const dropProvider = vscode.languages.registerDocumentDropEditProvider(
        { language: 'kv' },
        {
            async provideDocumentDropEdits(document, position, dataTransfer, token) {
                const textItem = dataTransfer.get('text/plain');
                if (!textItem) {
                    return undefined;
                }
                
                const snippet = textItem.value as string;
                
                console.log('[Drop] Drop at VSCode position:', position.line, position.character);
                
                try {
                    // Use WASM to intelligently insert the widget
                    const result = await wasmBridge.addWidgetToKv(
                        document.getText(),
                        snippet,
                        position.line + 1, // Swift uses 1-based line numbers
                        position.character
                    );
                    
                    console.log('[Drop] WASM result:', result);
                    
                    if (result.success && result.kvCode) {
                        console.log('[Drop] Successfully processed drop with WASM');
                        
                        // Replace entire document with new KV code
                        const edit = new vscode.WorkspaceEdit();
                        const fullRange = new vscode.Range(
                            document.positionAt(0),
                            document.positionAt(document.getText().length)
                        );
                        edit.replace(document.uri, fullRange, result.kvCode);
                        await vscode.workspace.applyEdit(edit);
                        
                        return undefined; // We already applied the edit
                    } else {
                        console.log('[Drop] WASM processing failed, using fallback:', result.error);
                        // Fallback to default behavior
                        return {
                            insertText: new vscode.SnippetString(snippet)
                        };
                    }
                } catch (error) {
                    console.error('[Drop] Error processing drop:', error);
                    // Fallback to default behavior
                    return {
                        insertText: new vscode.SnippetString(snippet)
                    };
                }
            }
        }
    );
    
    context.subscriptions.push(dropProvider);
    
    console.log('✅ Sidebar views registered');
}

/**
 * Set up event listeners for file changes and editor events
 */
function setupEventListeners(context: vscode.ExtensionContext) {
    // Set up file system watcher for paired files
    const fileWatcher = pairedFileManager.setupFileWatcher();
    context.subscriptions.push(fileWatcher);
    
    // Listen for text document changes
    const changeListener = vscode.workspace.onDidChangeTextDocument(event => {
        const document = event.document;
        
        // Only process .kv and .py files
        if (document.languageId !== 'kv' && document.languageId !== 'python') {
            return;
        }
        
        // Update diagnostics for .kv files
        if (document.languageId === 'kv') {
            diagnosticsProvider.updateDiagnostics(document);
        }
        
        // Update preview if auto-generate is enabled
        if (autoGenerateEnabled) {
            previewPanel.scheduleUpdate();
        }
    });
    context.subscriptions.push(changeListener);
    
    // Listen for text document save
    const saveListener = vscode.workspace.onDidSaveTextDocument(document => {
        if (document.languageId === 'kv') {
            // Clear paired file cache when file is saved
            pairedFileManager.clearCache(document.uri);
            
            // Update diagnostics
            diagnosticsProvider.updateDiagnostics(document);
            
            // Update preview
            previewPanel.scheduleUpdate();
        }
    });
    context.subscriptions.push(saveListener);
    
    // Listen for active editor changes
    const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.languageId === 'kv') {
            // Update diagnostics for newly opened KV file
            diagnosticsProvider.updateDiagnostics(editor.document);
        }
    });
    context.subscriptions.push(editorChangeListener);
    
    // Listen for text document open
    const openListener = vscode.workspace.onDidOpenTextDocument(document => {
        if (document.languageId === 'kv') {
            diagnosticsProvider.updateDiagnostics(document);
        }
    });
    context.subscriptions.push(openListener);
    
    // Listen for text document close
    const closeListener = vscode.workspace.onDidCloseTextDocument(document => {
        if (document.languageId === 'kv') {
            diagnosticsProvider.clearForDocument(document.uri);
        }
    });
    context.subscriptions.push(closeListener);
    
    // Listen for configuration changes
    const configListener = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('swiftyKvLang')) {
            const config = vscode.workspace.getConfiguration('swiftyKvLang');
            autoGenerateEnabled = config.get<boolean>('autoGenerate', true);
        }
    });
    context.subscriptions.push(configListener);
}

/**
 * Extension deactivation
 */
export function deactivate() {
    // Clean up resources
    if (wasmBridge) {
        wasmBridge.dispose();
    }
    
    if (previewPanel) {
        previewPanel.dispose();
    }
    
    if (diagnosticsProvider) {
        diagnosticsProvider.dispose();
    }
    
    if (pairedFileManager) {
        pairedFileManager.clearCache();
    }
    
    // Stop the render service
    try {
        const renderService = KivyRenderService.getInstance(null as any);
        renderService.stop();
    } catch (e) {
        // Service may not have been started
    }
    
    console.log('SwiftyKvLangVCE extension deactivated');
}
