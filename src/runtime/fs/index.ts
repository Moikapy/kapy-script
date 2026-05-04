// Kapy Runtime — File System
// Wraps Node.js fs for kapy-script's `import kapy/fs`

import { Ok, Err, type Result } from "../index.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { dirname } from "path";

export interface FileStats {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  modified: Date;
}

/**
 * Read a file as a string. Returns Result.
 */
export function readFile(path: string): Result<string, string> {
  try {
    return Ok(readFileSync(path, "utf-8"));
  } catch (e) {
    return Err(`Failed to read file '${path}': ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Write a string to a file. Returns Result.
 */
export function writeFile(path: string, content: string): Result<void, string> {
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, content, "utf-8");
    return Ok(undefined as unknown as void);
  } catch (e) {
    return Err(`Failed to write file '${path}': ${e instanceof Error ? e.message : String(e)}`);
  }
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
export function listDir(path: string): Result<string[], string> {
  try {
    return Ok(readdirSync(path));
  } catch (e) {
    return Err(`Failed to list directory '${path}': ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Get file/directory stats.
 */
export function stat(path: string): Result<FileStats, string> {
  try {
    const s = statSync(path);
    return Ok({
      size: s.size,
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
      modified: s.mtime,
    });
  } catch (e) {
    return Err(`Failed to stat '${path}': ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Delete a file.
 */
export function deleteFile(path: string): Result<void, string> {
  try {
    unlinkSync(path);
    return Ok(undefined as unknown as void);
  } catch (e) {
    return Err(`Failed to delete '${path}': ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Create a directory (and parents as needed).
 */
export function mkdir(path: string): Result<void, string> {
  try {
    mkdirSync(path, { recursive: true });
    return Ok(undefined as unknown as void);
  } catch (e) {
    return Err(`Failed to create directory '${path}': ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Read a file as JSON.
 */
export function readJson<T = unknown>(path: string): Result<T, string> {
  try {
    return Ok(JSON.parse(readFileSync(path, "utf-8")) as T);
  } catch (e) {
    return Err(`Failed to read JSON from '${path}': ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Write JSON to a file.
 */
export function writeJson(path: string, data: unknown, indent: number = 2): Result<void, string> {
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(data, null, indent), "utf-8");
    return Ok(undefined as unknown as void);
  } catch (e) {
    return Err(`Failed to write JSON to '${path}': ${e instanceof Error ? e.message : String(e)}`);
  }
}