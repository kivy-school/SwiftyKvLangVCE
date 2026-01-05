import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { ChildProcess, spawn } from 'child_process';

export class KivyRenderService {
    private static instance: KivyRenderService;
    private serverProcess: ChildProcess | null = null;
    private serverUrl = 'http://127.0.0.1:9876';
    private isReady = false;
    private readyPromise: Promise<void> | null = null;
    private cache = new Map<string, string>(); // code hash -> base64 image
    
    private constructor(private context: vscode.ExtensionContext) {}
    
    static getInstance(context: vscode.ExtensionContext): KivyRenderService {
        if (!KivyRenderService.instance) {
            KivyRenderService.instance = new KivyRenderService(context);
        }
        return KivyRenderService.instance;
    }
    
    async start(): Promise<void> {
        if (this.readyPromise) {
            return this.readyPromise;
        }
        
        this.readyPromise = this._startServer();
        return this.readyPromise;
    }
    
    private async _startServer(): Promise<void> {
        try {
            // Check if server is already running
            const isRunning = await this.checkHealth();
            if (isRunning) {
                console.log('[KivyRender] Server already running');
                this.isReady = true;
                return;
            }
            
            // Get path to doctor-kivy directory
            const doctorKivyPath = path.join(this.context.extensionPath, 'doctor-kivy');
            
            if (!fs.existsSync(doctorKivyPath)) {
                throw new Error('doctor-kivy directory not found');
            }
            
            // Start the server process
            console.log('[KivyRender] Starting server...');
            this.serverProcess = spawn('python3', ['server.py'], {
                cwd: doctorKivyPath,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            this.serverProcess.stdout?.on('data', (data) => {
                console.log(`[KivyRender] ${data.toString()}`);
            });
            
            this.serverProcess.stderr?.on('data', (data) => {
                console.error(`[KivyRender] ${data.toString()}`);
            });
            
            this.serverProcess.on('exit', (code) => {
                console.log(`[KivyRender] Server exited with code ${code}`);
                this.isReady = false;
                this.serverProcess = null;
            });
            
            // Wait for server to be ready
            for (let i = 0; i < 30; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (await this.checkHealth()) {
                    this.isReady = true;
                    console.log('[KivyRender] Server ready');
                    return;
                }
            }
            
            throw new Error('Server failed to start within timeout');
            
        } catch (error) {
            console.error('[KivyRender] Failed to start server:', error);
            throw error;
        }
    }
    
    private async checkHealth(): Promise<boolean> {
        return new Promise((resolve) => {
            const req = http.get(`${this.serverUrl}/health`, (res) => {
                resolve(res.statusCode === 200);
            });
            
            req.on('error', () => {
                resolve(false);
            });
            
            req.setTimeout(2000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }
    
    async renderKivyCode(code: string): Promise<string | null> {
        // Check cache first
        const cacheKey = this.hashCode(code);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }
        
        if (!this.isReady) {
            await this.start();
        }
        
        return new Promise((resolve) => {
            const postData = JSON.stringify({
                code: code,
                mode: 'screenshot'
            });
            
            const options = {
                hostname: '127.0.0.1',
                port: 9876,
                path: '/render',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: 30000
            };
            
            const req = http.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.success && response.image) {
                            // Cache the result
                            this.cache.set(cacheKey, response.image);
                            resolve(response.image);
                        } else {
                            console.error('[KivyRender] Render failed:', response.error);
                            resolve(null);
                        }
                    } catch (error) {
                        console.error('[KivyRender] Failed to parse response:', error);
                        resolve(null);
                    }
                });
            });
            
            req.on('error', (error) => {
                console.error('[KivyRender] Request error:', error);
                resolve(null);
            });
            
            req.on('timeout', () => {
                console.error('[KivyRender] Request timeout');
                req.destroy();
                resolve(null);
            });
            
            req.write(postData);
            req.end();
        });
    }
    
    private hashCode(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }
    
    stop(): void {
        if (this.serverProcess) {
            console.log('[KivyRender] Stopping server...');
            this.serverProcess.kill();
            this.serverProcess = null;
        }
        this.isReady = false;
        this.readyPromise = null;
    }
}
