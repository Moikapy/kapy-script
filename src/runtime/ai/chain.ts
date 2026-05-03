// Kapy Runtime — AI Chain
// Sequential and parallel LLM chains for kapy-script's `import kapy/ai`

import { Ok, Err, type Result } from "../index.js";
import { chat, type AIConfig, type ChatMessage } from "./index.js";

/**
 * A chain step — either a prompt template or a function that transforms the previous result.
 */
export interface ChainStep {
  /** Role for this step's message (default: "user") */
  role?: "system" | "user" | "assistant";
  /** Prompt template — {input} and {prev} are replaced */
  prompt: string;
  /** Optional model override for this step */
  model?: string;
}

/**
 * Result of running a chain.
 */
export interface ChainResult {
  /** Final output text */
  output: string;
  /** All intermediate outputs */
  steps: string[];
  /** Total tokens used (if available) */
  totalTokens?: number;
}

/**
 * Run a sequential LLM chain — each step feeds into the next.
 *
 * Usage in .kapy:
 *   import kapy/ai
 *   import kapy/ai/chain
 *   result = chain.run([
 *     { prompt: "Summarize this text: {input}" },
 *     { prompt: "Translate to French: {prev}" },
 *   ], "The quick brown fox...", { provider: "openai", model: "gpt-4" })
 */
export async function run(
  steps: ChainStep[],
  input: string,
  config?: Partial<AIConfig>,
): Promise<Result<ChainResult, string>> {
  const outputs: string[] = [];
  let current = input;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const role = step.role ?? (i === 0 ? "user" : "user");

    // Replace template variables
    const prompt = step.prompt
      .replace(/\{input\}/g, input)
      .replace(/\{prev\}/g, current);

    const messages: ChatMessage[] = [{ role, content: prompt }];
    const stepConfig = step.model ? { ...config, model: step.model } : config;

    const result = await chat(messages, stepConfig);
    if (result._tag === "Err") {
      return Err(`Chain step ${i + 1} failed: ${(result as any).error}`);
    }

    current = (result as any).value;
    outputs.push(current);
  }

  return Ok({
    output: current,
    steps: outputs,
  });
}

/**
 * Run multiple prompts in parallel and return all results.
 *
 * Usage in .kapy:
 *   import kapy/ai/chain
 *   results = chain.parallel([
 *     { prompt: "Translate to French: {input}" },
 *     { prompt: "Translate to German: {input}" },
 *     { prompt: "Translate to Japanese: {input}" },
 *   ], "Hello, World!", { provider: "openai" })
 */
export async function parallel(
  steps: ChainStep[],
  input: string,
  config?: Partial<AIConfig>,
): Promise<Result<ChainResult[], string>> {
  const results = await Promise.all(
    steps.map(async (step, i) => {
      const prompt = step.prompt.replace(/\{input\}/g, input);
      const messages: ChatMessage[] = [{ role: "user", content: prompt }];
      const stepConfig = step.model ? { ...config, model: step.model } : config;
      const result = await chat(messages, stepConfig);

      if (result._tag === "Err") {
        return Err(`Parallel step ${i + 1} failed: ${(result as any).error}`);
      }

      return Ok({
        output: (result as any).value,
        steps: [(result as any).value],
      });
    }),
  );

  // Check for any failures
  const failure = results.find((r) => r._tag === "Err");
  if (failure && failure._tag === "Err") {
    return failure as Result<never, string>;
  }

  return Ok(results.map((r) => (r as any).value as ChainResult));
}

/**
 * Map-reduce pattern: process a list of items through an LLM prompt, then combine.
 *
 * Usage in .kapy:
 *   result = chain.mapReduce(
 *     "Summarize this document: {item}",
 *     "Combine these summaries into one: {items}",
 *     ["doc1 text", "doc2 text", "doc3 text"],
 *     { provider: "openai" }
 *   )
 */
export async function mapReduce(
  mapPrompt: string,
  reducePrompt: string,
  items: string[],
  config?: Partial<AIConfig>,
): Promise<Result<string, string>> {
  // Map phase: process each item
  const summaries = await Promise.all(
    items.map(async (item) => {
      const prompt = mapPrompt.replace(/\{item\}/g, item);
      const result = await chat([{ role: "user", content: prompt }], config);
      return result._tag === "Ok" ? (result as any).value : null;
    }),
  );

  const validSummaries = summaries.filter((s): s is string => s !== null);
  if (validSummaries.length === 0) {
    return Err("All map steps failed");
  }

  // Reduce phase: combine results
  const combined = validSummaries.join("\n\n---\n\n");
  const reduceInput = reducePrompt.replace(/\{items\}/g, combined);
  const reduceResult = await chat([{ role: "user", content: reduceInput }], config);

  if (reduceResult._tag === "Err") {
    return Err(`Reduce step failed: ${(reduceResult as any).error}`);
  }

  return Ok((reduceResult as any).value);
}