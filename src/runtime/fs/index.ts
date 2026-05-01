// Kapy Runtime — File System
// Wraps Node.js fs for kapy-script's `import kapy/fs`

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { dirname } from "path";

export interface FileStats {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  modified: Date;
}

/**
 * Read a file as a string (synchronous).
 */
export function readFile(path: string): string {
  return readFileSync(path, "utf-8");
}

/**
 * Write a string to a file (synchronous).
 */
export function writeFile(path: string, content: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, content, "utf-8");
}

/**
 * Check if a file or directory exists.
 */
export function exists(path: string): boolean {
  return existsSync(path);
}

/**
 * List files in a directory.
 */
export function listDir(path: string): string[] {
  return readdirSync(path);
}

/**
 * Get file/directory stats.
 */
export function stat(path: string): FileStats {
  const s = statSync(path);
  return {
    size: s.size,
    isFile: s.isFile(),
    isDirectory: s.isDirectory(),
    modified: s.mtime,
  };
}

/**
 * Delete a file.
 */
export function deleteFile(path: string): void {
  unlinkSync(path);
}

/**
 * Create a directory (and parents as needed).
 */
export function mkdir(path: string): void {
  mkdirSync(path, { recursive: true });
}

/**
 * Read a file as JSON (synchronous).
 */
export function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

/**
 * Write JSON to a file (synchronous).
 */
export function writeJson(path: string, data: unknown, indent: number = 2): void {
  writeFile(path, JSON.stringify(data, null, indent));
}