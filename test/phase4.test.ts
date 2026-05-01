import { describe, it, expect } from "bun:test";
import { parsePkg, findPkg, readPkg } from "../src/cli/pkg";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";

// ── kapy.pkg Parser Tests ──

describe("kapy.pkg parser", () => {
  it("parses a simple manifest", () => {
    const content = `name: my-project
version: 0.1.0
entry: src/main.kapy

dependencies

ai_provider: openai
ai_model: gpt-4`;
    const pkg = parsePkg(content);
    expect(pkg.name).toBe("my-project");
    expect(pkg.version).toBe("0.1.0");
    expect(pkg.entry).toBe("src/main.kapy");
    expect(pkg.ai_provider).toBe("openai");
    expect(pkg.ai_model).toBe("gpt-4");
  });

  it("parses dependencies section", () => {
    const content = `name: test
version: 1.0.0
entry: src/index.kapy

dependencies
  @kapy/ai: 0.1.0
  zod: 3.22.0`;
    const pkg = parsePkg(content);
    expect(pkg.dependencies["@kapy/ai"]).toBe("0.1.0");
    expect(pkg.dependencies["zod"]).toBe("3.22.0");
  });

  it("parses ai_options section", () => {
    const content = `name: test
version: 1.0.0

ai_options
  temperature: 0.7
  max_tokens: 2048`;
    const pkg = parsePkg(content);
    expect(pkg.ai_options?.temperature).toBe("0.7");
    expect(pkg.ai_options?.max_tokens).toBe("2048");
  });

  it("handles empty dependencies", () => {
    const content = `name: minimal
version: 0.0.1
entry: src/main.kapy

dependencies`;
    const pkg = parsePkg(content);
    expect(pkg.name).toBe("minimal");
    expect(Object.keys(pkg.dependencies).length).toBe(0);
  });

  it("ignores comments", () => {
    const content = `# Project manifest
name: commented
version: 1.0.0
# This is a comment
entry: src/main.kapy`;
    const pkg = parsePkg(content);
    expect(pkg.name).toBe("commented");
  });

  it("preserves unknown fields in raw", () => {
    const content = `name: test
version: 1.0.0
custom_field: custom_value`;
    const pkg = parsePkg(content);
    expect(pkg.raw["custom_field"]).toBe("custom_value");
  });
});

// ── Mock System Tests ──

describe("mock system", () => {
  it("mock_llm returns mocked response", async () => {
    const { mock_llm, mock_reset, llm } = await import("../src/runtime/index");
    mock_llm("Hello from mock!");
    const result = await llm("test prompt");
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value).toBe("Hello from mock!");
    }
    mock_reset();
  });

  it("mock_embed returns mocked vector", async () => {
    const { mock_embed, mock_reset, embed } = await import("../src/runtime/index");
    mock_embed([0.1, 0.2, 0.3]);
    const result = await embed("test text");
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value).toEqual([0.1, 0.2, 0.3]);
    }
    mock_reset();
  });

  it("mock_reset clears mocks", async () => {
    const { mock_llm, mock_reset } = await import("../src/runtime/index");
    mock_llm("should be cleared");
    mock_reset();
    // After reset, mock should return null when checked
    const { get_llm_mock } = await import("../src/runtime/mock");
    expect(get_llm_mock()).toBeNull();
  });

  it("mock_tool registers handler", async () => {
    const { mock_tool, mock_reset } = await import("../src/runtime/index");
    mock_tool("search", (q: string) => `results for ${q}`);
    const { get_tool_mock } = await import("../src/runtime/mock");
    const handler = get_tool_mock("search");
    expect(handler).not.toBeNull();
    expect(handler?.("test")).toBe("results for test");
    mock_reset();
  });
});