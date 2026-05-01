// Kapy-script Mock System — test doubles for llm(), embed(), and tools
// All mocks are scoped via a registry that the runtime checks before real calls

const mocks = {
  llm: null as string | null,
  embed: null as number[] | null,
  tools: new Map<string, (...args: any[]) => any>(),
};

/** Make all subsequent llm() calls return this string (wrapped in Ok) */
export function mock_llm(response: string): void {
  mocks.llm = response;
}

/** Make all subsequent embed() calls return this vector (wrapped in Ok) */
export function mock_embed(vector: number[]): void {
  mocks.embed = vector;
}

/** Register a mock tool handler */
export function mock_tool(name: string, handler: (...args: any[]) => any): void {
  mocks.tools.set(name, handler);
}

/** Clear all mocks */
export function mock_reset(): void {
  mocks.llm = null;
  mocks.embed = null;
  mocks.tools.clear();
}

// ── Internal — called by runtime before real API calls ──

export function get_llm_mock(): string | null {
  return mocks.llm;
}

export function get_embed_mock(): number[] | null {
  return mocks.embed;
}

export function get_tool_mock(name: string): ((...args: any[]) => any) | null {
  return mocks.tools.get(name) ?? null;
}