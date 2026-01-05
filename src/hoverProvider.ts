import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WasmBridge } from './wasmBridge';

export class KvHoverProvider implements vscode.HoverProvider {
    constructor(private readonly wasmBridge: WasmBridge) {}

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        const line = document.lineAt(position.line);
        const lineText = line.text;
        
        // Check if this line contains an image source property
        const imagePropertyMatch = lineText.match(/^\s*(source|background_normal|background_down|background_disabled_normal|background_disabled_down):\s*['"]?(.+?)['"]?\s*$/);
        
        if (!imagePropertyMatch) {
            return undefined;
        }
        
        const propertyName = imagePropertyMatch[1];
        const imagePath = imagePropertyMatch[2].trim().replace(/['"]/g, '');
        
        // Check if it's a valid image extension
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'];
        const ext = path.extname(imagePath).toLowerCase();
        if (!imageExtensions.includes(ext)) {
            return undefined;
        }
        
        // Try to resolve the image path
        const resolvedPath = this.resolveImagePath(document, imagePath);
        if (!resolvedPath || !fs.existsSync(resolvedPath)) {
            return undefined;
        }
        
        // Get file stats for file size
        const stats = fs.statSync(resolvedPath);
        const fileSizeKB = (stats.size / 1024).toFixed(2);
        
        // Try to get image dimensions
        let dimensions = '';
        try {
            const imageSize = this.getImageDimensions(resolvedPath);
            if (imageSize) {
                dimensions = ` (${imageSize.width}×${imageSize.height})`;
            }
        } catch (e) {
            // Ignore dimension errors
        }
        
        // Create markdown with image preview
        const imageUri = vscode.Uri.file(resolvedPath);
        const markdown = new vscode.MarkdownString();
        markdown.supportHtml = true;
        markdown.isTrusted = true;
        
        // Use standard markdown image syntax
        markdown.appendMarkdown(`![${path.basename(imagePath)}](${imageUri.toString()})\n\n`);
        markdown.appendMarkdown(`**File:** \`${path.basename(imagePath)}\`${dimensions}\n\n`);
        markdown.appendMarkdown(`**Path:** \`${imagePath}\`\n\n`);
        markdown.appendMarkdown(`**Size:** ${fileSizeKB} KB`);
        
        return new vscode.Hover(markdown);
    }
    
    private resolveImagePath(document: vscode.TextDocument, imagePath: string): string | undefined {
        // Try different resolution strategies:
        
        // 1. Absolute path
        if (path.isAbsolute(imagePath) && fs.existsSync(imagePath)) {
            return imagePath;
        }
        
        // 2. Relative to the .kv file directory
        const kvDir = path.dirname(document.uri.fsPath);
        let resolvedPath = path.join(kvDir, imagePath);
        if (fs.existsSync(resolvedPath)) {
            return resolvedPath;
        }
        
        // 3. Relative to workspace root
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (workspaceFolder) {
            resolvedPath = path.join(workspaceFolder.uri.fsPath, imagePath);
            if (fs.existsSync(resolvedPath)) {
                return resolvedPath;
            }
        }
        
        // 4. Search in common directories
        const commonDirs = ['images', 'assets', 'img', 'resources'];
        for (const dir of commonDirs) {
            if (workspaceFolder) {
                resolvedPath = path.join(workspaceFolder.uri.fsPath, dir, imagePath);
                if (fs.existsSync(resolvedPath)) {
                    return resolvedPath;
                }
            }
            
            resolvedPath = path.join(kvDir, dir, imagePath);
            if (fs.existsSync(resolvedPath)) {
                return resolvedPath;
            }
        }
        
        return undefined;
    }
    
    private getImageDimensions(imagePath: string): { width: number; height: number } | undefined {
        try {
            // Read PNG dimensions
            if (imagePath.toLowerCase().endsWith('.png')) {
                const buffer = fs.readFileSync(imagePath);
                if (buffer.length > 24) {
                    const width = buffer.readUInt32BE(16);
                    const height = buffer.readUInt32BE(20);
                    return { width, height };
                }
            }
            // Read JPEG dimensions
            else if (imagePath.toLowerCase().match(/\.(jpg|jpeg)$/)) {
                const buffer = fs.readFileSync(imagePath);
                let offset = 2;
                while (offset < buffer.length) {
                    if (buffer[offset] !== 0xFF) break;
                    const marker = buffer[offset + 1];
                    if (marker === 0xC0 || marker === 0xC2) {
                        const height = buffer.readUInt16BE(offset + 5);
                        const width = buffer.readUInt16BE(offset + 7);
                        return { width, height };
                    }
                    offset += 2 + buffer.readUInt16BE(offset + 2);
                }
            }
        } catch (e) {
            // Return undefined on error
        }
        return undefined;
    }
}
