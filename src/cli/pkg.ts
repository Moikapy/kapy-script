// Kapy-script manifest parser — reads kapy.pkg files
// The manifest is indentation-based (2 spaces), same as kapy-script source

import { readFileSync, existsSync } from "fs";
import { resolve, join, dirname } from "path";

export interface KapyPkg {
  name: string;
  version: string;
  entry: string;
  dependencies: Record<string, string>;
  ai_provider?: string;
  ai_model?: string;
  ai_api_key?: string;
  ai_options?: Record<string, string>;
  // Raw fields for extensibility
  raw: Record<string, string>;
}

const DEFAULT_PKG: KapyPkg = {
  name: "",
  version: "0.1.0",
  entry: "src/main.kapy",
  dependencies: {},
  raw: {},
};

/** Parse a kapy.pkg manifest from string content */
export function parsePkg(content: string, _dir?: string): KapyPkg {
  const lines = content.split("\n");
  const pkg: KapyPkg = { ...DEFAULT_PKG, dependencies: {}, raw: {} };

  let currentSection: string | null = null;
  let sectionData: Record<string, string> = {};

  function saveSection(): void {
    if (currentSection) {
      if (currentSection === "dependencies") {
        pkg.dependencies = { ...pkg.dependencies, ...sectionData };
      } else if (currentSection === "ai_options") {
        pkg.ai_options = { ...sectionData };
      }
      currentSection = null;
      sectionData = {};
    }
  }

  for (const line of lines) {
    // Skip blank lines and comments
    if (line.trim() === "" || line.trim().startsWith("#")) continue;

    // Indented line — belongs to current section
    if (line.startsWith("  ") && currentSection) {
      const trimmed = line.trim();
      // Find the LAST colon for dependency lines like "@kapy/ai: 0.1.0"
      // But for regular key-value, find the FIRST colon like "temperature: 0.7"
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx > 0) {
        const key = trimmed.slice(0, colonIdx).trim();
        const value = trimmed.slice(colonIdx + 1).trim();
        sectionData[key] = value;
      }
      continue;
    }

    // Non-indented line — either a section header or key:value
    const trimmed = line.trim();
    const colonIdx = trimmed.indexOf(":");

    if (colonIdx === -1) {
      // No colon — this is a section header (e.g. "dependencies")
      saveSection();
      currentSection = trimmed;
      sectionData = {};
      continue;
    }

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (value === "") {
      // Empty value after colon — this is also a section header (e.g. "dependencies:")
      saveSection();
      currentSection = key;
      sectionData = {};
      continue;
    }

    // Top-level key: value pair
    saveSection(); // Close any open section first

    switch (key) {
      case "name": pkg.name = value; break;
      case "version": pkg.version = value; break;
      case "entry": pkg.entry = value; break;
      case "ai_provider": pkg.ai_provider = value; break;
      case "ai_model": pkg.ai_model = value; break;
      case "ai_api_key": pkg.ai_api_key = value; break;
      default: pkg.raw[key] = value; break;
    }
  }

  // Save last section if file ends while in a section
  saveSection();

  return pkg;
}

/** Find and parse kapy.pkg, walking up from dir */
export function findPkg(dir: string): KapyPkg | null {
  let current = resolve(dir);
  const root = resolve("/");

  while (current !== root) {
    const pkgPath = join(current, "kapy.pkg");
    if (existsSync(pkgPath)) {
      try {
        const content = readFileSync(pkgPath, "utf-8");
        return parsePkg(content, current);
      } catch {
        return null;
      }
    }
    current = dirname(current);
  }

  return null;
}

/** Read kapy.pkg from a specific directory */
export function readPkg(dir: string): KapyPkg | null {
  const pkgPath = join(resolve(dir), "kapy.pkg");
  if (!existsSync(pkgPath)) return null;
  try {
    const content = readFileSync(pkgPath, "utf-8");
    return parsePkg(content, resolve(dir));
  } catch {
    return null;
  }
}