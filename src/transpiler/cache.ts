// Kapy-script Cache — content-hash-based transpilation cache
// Stores .ts output in .kapy-cache/ directory

import { existsSync, mkdirSync, writeFileSync, statSync, unlinkSync } from "fs";
import { join, basename } from "path";
import { createHash } from "crypto";

export interface CacheEntry {
  /** Content hash of the source .kapy file */
  hash: string;
  /** Path to the cached .ts file */
  tsPath: string;
  /** Path to the cached .js file (after Bun compilation) */
  jsPath: string;
  /** Timestamp of last cache write */
  timestamp: number;
}

export class Cache {
  private cacheDir: string;

  constructor(cacheDir: string = ".kapy-cache") {
    this.cacheDir = cacheDir;
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
  }

  /** Compute SHA256 content hash of source */
  hash(source: string): string {
    return createHash("sha256").update(source).digest("hex").slice(0, 16);
  }

  /** Get cache entry for a .kapy file, or null if not cached */
  get(kapyPath: string, source: string): CacheEntry | null {
    const hash = this.hash(source);
    const tsPath = join(this.cacheDir, `${basename(kapyPath, ".kapy")}.${hash}.ts`);
    const jsPath = join(this.cacheDir, `${basename(kapyPath, ".kapy")}.${hash}.js`);

    if (!existsSync(tsPath)) {
      return null;
    }

    // Check if source file is newer than cache
    try {
      const sourceStat = statSync(kapyPath);
      const cacheStat = statSync(tsPath);
      if (sourceStat.mtimeMs > cacheStat.mtimeMs) {
        // Source is newer — invalidate cache
        this.invalidate(tsPath);
        return null;
      }
    } catch {
      // If we can't stat the source, just use cache
    }

    return { hash, tsPath, jsPath, timestamp: Date.now() };
  }

  /** Store transpiled output in cache */
  set(kapyPath: string, source: string, tsCode: string): CacheEntry {
    const hash = this.hash(source);
    const tsPath = join(this.cacheDir, `${basename(kapyPath, ".kapy")}.${hash}.ts`);

    writeFileSync(tsPath, tsCode, "utf-8");

    return { hash, tsPath, jsPath: tsPath.replace(".ts", ".js"), timestamp: Date.now() };
  }

  /** Check if cache is valid for the given source */
  isValid(kapyPath: string, source: string): boolean {
    const entry = this.get(kapyPath, source);
    return entry !== null;
  }

  /** Get the cached .ts path if valid, or null */
  getCachedTsPath(kapyPath: string, source: string): string | null {
    const entry = this.get(kapyPath, source);
    return entry?.tsPath ?? null;
  }

  /** Invalidate a specific cache entry */
  invalidate(tsPath: string): void {
    try {
      if (existsSync(tsPath)) unlinkSync(tsPath);
    } catch {
      // Ignore errors
    }
  }

  /** Clear all cache entries */
  clear(): void {
    const files = require("fs").readdirSync(this.cacheDir);
    for (const file of files) {
      if (file.endsWith(".ts") || file.endsWith(".js") || file.endsWith(".map")) {
        try { unlinkSync(join(this.cacheDir, file)); } catch {}
      }
    }
  }
}