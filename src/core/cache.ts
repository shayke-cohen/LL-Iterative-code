import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(__filename);

const cacheDir = path.join(currentDir, '../.cache');

class Cache {
    private static instance: Cache;
    private cacheDir: string;

    private constructor() {
        this.cacheDir = path.join(__dirname, '..', '..', 'cache');
        this.initCacheDir();
    }

    private initCacheDir(): void {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir);
        }
    }

    private generateCacheKey(key: any): string {
        const keyString = typeof key === 'string' ? key : JSON.stringify(key);
        return crypto.createHash('md5').update(keyString).digest('hex');
    }

    private getCacheFilePath(key: string): string {
        return path.join(this.cacheDir, `${key}.cache`);
    }

    public async getFromCache(key: any): Promise<string | null> {
        const cacheFilePath = this.getCacheFilePath(this.generateCacheKey(key));
        if (fs.existsSync(cacheFilePath)) {
            const data = await new Promise<string>((resolve, reject) => {
                fs.readFile(cacheFilePath, 'utf8', (err, data) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            });
            return data;
        }
        return null;
    }

    public async setInCache(key: any, value: string): Promise<void> {
        const cacheFilePath = this.getCacheFilePath(this.generateCacheKey(key));
        await new Promise<void>((resolve, reject) => {
            fs.writeFile(cacheFilePath, value, 'utf8', (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public memoize(fn: Function): (...args: any[]) => Promise<any> {
        const instance = this;
        return async function(...args: any[]): Promise<any> {
            const key = args;
            const cachedResult = await instance.getFromCache(key);
            if (cachedResult !== null) {
                return cachedResult;
            } else {
                const result = await fn(...args);
                await instance.setInCache(key, result);
                return result;
            }
        };
    }

    public static getInstance(): Cache {
        if (!Cache.instance) {
            Cache.instance = new Cache();
            Object.freeze(Cache.instance);
        }
        return Cache.instance;
    }
}

export default Cache.getInstance();
