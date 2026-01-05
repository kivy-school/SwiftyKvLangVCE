import * as vscode from 'vscode';
import * as path from 'path';

export interface PairedFiles {
    kvFile: vscode.Uri | null;
    pyFile: vscode.Uri | null;
}

export class PairedFileManager {
    private pairsCache = new Map<string, PairedFiles>();
    
    /**
     * Find the paired file for a given .kv or .py file
     * @param fileUri The URI of the file to find a pair for
     * @returns The paired files (both .kv and .py if they exist)
     */
    async findPairedFiles(fileUri: vscode.Uri): Promise<PairedFiles> {
        const filePath = fileUri.fsPath;
        const ext = path.extname(filePath);
        const baseName = path.basename(filePath, ext);
        const dirName = path.dirname(filePath);
        
        // Check cache first
        const cacheKey = `${dirName}/${baseName}`;
        if (this.pairsCache.has(cacheKey)) {
            return this.pairsCache.get(cacheKey)!;
        }
        
        let kvFile: vscode.Uri | null = null;
        let pyFile: vscode.Uri | null = null;
        
        if (ext === '.kv') {
            kvFile = fileUri;
            // Look for matching .py file
            const pyPath = path.join(dirName, `${baseName}.py`);
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(pyPath));
                pyFile = vscode.Uri.file(pyPath);
            } catch {
                // .py file doesn't exist
            }
        } else if (ext === '.py') {
            pyFile = fileUri;
            // Look for matching .kv file
            const kvPath = path.join(dirName, `${baseName}.kv`);
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(kvPath));
                kvFile = vscode.Uri.file(kvPath);
            } catch {
                // .kv file doesn't exist
            }
        }
        
        const result: PairedFiles = { kvFile, pyFile };
        this.pairsCache.set(cacheKey, result);
        return result;
    }
    
    /**
     * Get the content of both paired files
     * @param files The paired files
     * @returns Object with kvContent and pyContent (empty strings if file doesn't exist)
     */
    async getFileContents(files: PairedFiles): Promise<{ kvContent: string; pyContent: string }> {
        let kvContent = '';
        let pyContent = '';
        
        if (files.kvFile) {
            try {
                const kvDoc = await vscode.workspace.openTextDocument(files.kvFile);
                kvContent = kvDoc.getText();
            } catch (error) {
                console.error('Error reading .kv file:', error);
            }
        }
        
        if (files.pyFile) {
            try {
                const pyDoc = await vscode.workspace.openTextDocument(files.pyFile);
                pyContent = pyDoc.getText();
            } catch (error) {
                console.error('Error reading .py file:', error);
            }
        }
        
        return { kvContent, pyContent };
    }
    
    /**
     * Clear the cache for a specific file or all files
     * @param fileUri Optional URI to clear specific cache entry
     */
    clearCache(fileUri?: vscode.Uri): void {
        if (fileUri) {
            const filePath = fileUri.fsPath;
            const ext = path.extname(filePath);
            const baseName = path.basename(filePath, ext);
            const dirName = path.dirname(filePath);
            const cacheKey = `${dirName}/${baseName}`;
            this.pairsCache.delete(cacheKey);
        } else {
            this.pairsCache.clear();
        }
    }
    
    /**
     * Watch for file system changes and update cache
     */
    setupFileWatcher(): vscode.Disposable {
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.{kv,py}');
        
        watcher.onDidCreate((uri) => {
            this.clearCache(uri);
        });
        
        watcher.onDidDelete((uri) => {
            this.clearCache(uri);
        });
        
        return watcher;
    }
}
