import { describe, it, expect } from "bun:test";
import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import { Emitter } from "../src/transpiler/emitter";

function transpile(source: string): string {
  const tokens = new Lexer(source, "test.kapy").tokenize();
  const ast = new Parser(tokens, "test.kapy").parse();
  const emitter = new Emitter();
  const { code } = emitter.emit(ast);
  return code;
}

// ── Stdlib Import Resolution Tests ──

describe("Stdlib imports", () => {
  it("transpiles kapy/http import", () => {
    const source = `import kapy/http\n\nfn main\n  print("hello")`;
    const ts = transpile(source);
    expect(ts).toContain('import * as http from "@kapy/runtime/http"');
  });

  it("transpiles kapy/json import", () => {
    const source = `import kapy/json\n\nfn main\n  print("hello")`;
    const ts = transpile(source);
    expect(ts).toContain('import * as json from "@kapy/runtime/json"');
  });

  it("transpiles kapy/fs import", () => {
    const source = `import kapy/fs\n\nfn main\n  print("hello")`;
    const ts = transpile(source);
    expect(ts).toContain('import * as fs from "@kapy/runtime/fs"');
  });

  it("transpiles kapy/ai import", () => {
    const source = `import kapy/ai\n\nfn main\n  print("hello")`;
    const ts = transpile(source);
    expect(ts).toContain('import * as ai from "@kapy/runtime/ai"');
  });

  it("transpiles multiple kapy imports", () => {
    const source = `import kapy/http\nimport kapy/json\n\nfn main\n  print("hello")`;
    const ts = transpile(source);
    expect(ts).toContain('import * as http from "@kapy/runtime/http"');
    expect(ts).toContain('import * as json from "@kapy/runtime/json"');
  });

  it("transpiles npm imports with from clause", () => {
    const source = `import { z } from "zod"\n\nfn main\n  print("hello")`;
    const ts = transpile(source);
    expect(ts).toContain('import { z } from "zod"');
  });

  it("preserves kapy imports AND npm imports", () => {
    const source = `import kapy/http\nimport { z } from "zod"\n\nfn main\n  print("hello")`;
    const ts = transpile(source);
    expect(ts).toContain('import * as http from "@kapy/runtime/http"');
    expect(ts).toContain('import { z } from "zod"');
  });
});

// ── Runtime Module Tests ──

describe("Runtime modules", () => {
  // HTTP module
  describe("HTTP", () => {
    it("exports get, post, put, del functions", async () => {
      const http = await import("../src/runtime/http");
      expect(typeof http.get).toBe("function");
      expect(typeof http.post).toBe("function");
      expect(typeof http.put).toBe("function");
      expect(typeof http.del).toBe("function");
    });

    it("HttpResponse interface has status, headers, body, ok", async () => {
      const response: http.HttpResponse = { status: 200, headers: {}, body: "ok", ok: true };
      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);
    });
  });

  // JSON module
  describe("JSON utils", () => {
    it("parse returns Ok for valid JSON", async () => {
      const json = await import("../src/runtime/json");
      const result = json.parse('{"key": "value"}');
      expect(result._tag === "Ok").toBe(true);
      if (result._tag === "Ok") {
        expect((result.value as Record<string, string>).key).toBe("value");
      }
    });

    it("parse returns Err for invalid JSON", async () => {
      const json = await import("../src/runtime/json");
      const result = json.parse("{invalid}");
      expect(result._tag === "Err").toBe(true);
    });

    it("stringify returns Ok for valid values", async () => {
      const json = await import("../src/runtime/json");
      const result = json.stringify({ key: "value" });
      expect(result._tag === "Ok").toBe(true);
      if (result._tag === "Ok") {
        expect(result.value).toContain('"key"');
      }
    });
  });

  // FS module
  describe("FS", () => {
    it("exports file operations", async () => {
      const fs = await import("../src/runtime/fs");
      expect(typeof fs.readFile).toBe("function");
      expect(typeof fs.writeFile).toBe("function");
      expect(typeof fs.exists).toBe("function");
      expect(typeof fs.listDir).toBe("function");
      expect(typeof fs.readJson).toBe("function");
      expect(typeof fs.writeJson).toBe("function");
    });
  });

  // AI module
  describe("AI providers", () => {
    it("exports chat functions for all providers", async () => {
      const ai = await import("../src/runtime/ai");
      expect(typeof ai.chat).toBe("function");
      expect(typeof ai.openaiChat).toBe("function");
      expect(typeof ai.anthropicChat).toBe("function");
      expect(typeof ai.ollamaChat).toBe("function");
    });

    it("chat returns Err for missing API key", async () => {
      const ai = await import("../src/runtime/ai");
      const result = await ai.chat([{ role: "user", content: "test" }], { provider: "openai" });
      expect(result._tag === "Err").toBe(true);
    });
  });
});