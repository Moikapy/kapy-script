import { describe, it, expect } from "bun:test";
import {
	Result,
	Ok,
	Err,
	isOk,
	isErr,
	unwrap,
	unwrapOrCrash,
	unwrapOr,
	KapyRuntime,
	mock_llm,
	mock_embed,
	mock_tool,
	mock_reset,
	llm,
	embed,
} from "../src/runtime/index";
import { get_llm_mock, get_embed_mock, get_tool_mock } from "../src/runtime/mock";

// ── Result Type Tests ──

describe("Result type", () => {
	it("Ok creates a successful result", () => {
		const result = Ok(42);
		expect(result._tag).toBe("Ok");
		if (result._tag === "Ok") {
			expect(result.value).toBe(42);
		}
	});

	it("Err creates an error result", () => {
		const result = Err("something went wrong");
		expect(result._tag).toBe("Err");
		if (result._tag === "Err") {
			expect(result.error).toBe("something went wrong");
		}
	});

	it("isOk narrows type correctly", () => {
		const ok: Result<number, string> = Ok(10);
		const err: Result<number, string> = Err("fail");
		expect(isOk(ok)).toBe(true);
		expect(isOk(err)).toBe(false);
	});

	it("isErr narrows type correctly", () => {
		const ok: Result<number, string> = Ok(10);
		const err: Result<number, string> = Err("fail");
		expect(isErr(ok)).toBe(false);
		expect(isErr(err)).toBe(true);
	});
});

// ── Unwrap Operator Tests ──

describe("unwrap operators", () => {
	it("unwrap returns value on Ok", () => {
		expect(unwrap(Ok(42))).toBe(42);
	});

	it("unwrap throws on Err", () => {
		expect(() => unwrap(Err("boom"))).toThrow();
	});

	it("unwrapOrCrash returns value on Ok", () => {
		expect(unwrapOrCrash(Ok("hello"))).toBe("hello");
	});

	it("unwrapOrCrash throws on Err", () => {
		expect(() => unwrapOrCrash(Err("fatal"))).toThrow();
	});

	it("unwrapOr returns value on Ok", () => {
		expect(unwrapOr(Ok(99), 0)).toBe(99);
	});

	it("unwrapOr returns default on Err", () => {
		expect(unwrapOr(Err("none"), 0)).toBe(0);
	});
});

// ── Mock System Tests ──

describe("mock system", () => {
	it("mock_llm returns mocked response", async () => {
		mock_llm("Hello from mock!");
		const result = await llm("test prompt");
		expect(result._tag).toBe("Ok");
		if (result._tag === "Ok") {
			expect(result.value).toBe("Hello from mock!");
		}
		mock_reset();
		expect(get_llm_mock()).toBeNull();
	});

	it("mock_embed returns mocked vector", async () => {
		mock_embed([0.1, 0.2, 0.3]);
		const result = await embed("test text");
		expect(result._tag).toBe("Ok");
		if (result._tag === "Ok") {
			expect(result.value).toEqual([0.1, 0.2, 0.3]);
		}
		mock_reset();
		expect(get_embed_mock()).toBeNull();
	});

	it("mock_tool registers handler", () => {
		mock_tool("search", (q: string) => `results for ${q}`);
		const handler = get_tool_mock("search");
		expect(handler).not.toBeNull();
		expect(handler?.("test")).toBe("results for test");
		mock_reset();
	});

	it("mock_reset clears all mocks", () => {
		mock_llm("should be cleared");
		mock_embed([1.0]);
		mock_reset();
		expect(get_llm_mock()).toBeNull();
		expect(get_embed_mock()).toBeNull();
	});
});

// ── Error Path Tests ──

describe("llm error paths", () => {
	it("returns Err when OPENAI_API_KEY not set and no mock", async () => {
		const originalEnv = process.env.OPENAI_API_KEY;
		delete process.env.OPENAI_API_KEY;
		mock_reset();

		const result = await llm("test");
		expect(result._tag).toBe("Err");
		if (result._tag === "Err") {
			expect(result.error).toContain("OPENAI_API_KEY");
		}

		// Restore
		if (originalEnv) process.env.OPENAI_API_KEY = originalEnv;
		mock_reset();
	});
});

describe("embed error paths", () => {
	it("returns Err when OPENAI_API_KEY not set and no mock", async () => {
		const originalEnv = process.env.OPENAI_API_KEY;
		delete process.env.OPENAI_API_KEY;
		mock_reset();

		const result = await embed("test");
		expect(result._tag).toBe("Err");
		if (result._tag === "Err") {
			expect(result.error).toContain("OPENAI_API_KEY");
		}

		if (originalEnv) process.env.OPENAI_API_KEY = originalEnv;
		mock_reset();
	});
});

// ── KapyRuntime Tests ──

describe("KapyRuntime", () => {
	it("parallel runs tasks concurrently", async () => {
		const results = await KapyRuntime.parallel({
			a: () => Promise.resolve(1),
			b: () => Promise.resolve(2),
			c: () => Promise.resolve(3),
		});
		expect(results.a).toBe(1);
		expect(results.b).toBe(2);
		expect(results.c).toBe(3);
	});

	it("parallel handles non-function values", async () => {
		const results = await KapyRuntime.parallel({
			x: 42 as any,
			y: "hello" as any,
		});
		expect(results.x).toBe(42);
		expect(results.y).toBe("hello");
	});

	it("withTimeout resolves if function completes in time", async () => {
		const result = await KapyRuntime.withTimeout(1000, () =>
			Promise.resolve("done")
		);
		expect(result).toBe("done");
	});

	it("withTimeout rejects if function exceeds timeout", async () => {
		try {
			await KapyRuntime.withTimeout(10, () =>
				new Promise((resolve) => setTimeout(resolve, 500))
			);
			expect(true).toBe(false); // Should not reach here
		} catch (error: any) {
			expect(error.message).toContain("Timeout");
		}
	});
});