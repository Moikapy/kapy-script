// Kapy Runtime — AI Provider Adapters
// Config-driven access to LLM providers (OpenAI, Anthropic)

import { Ok, Err, type Result } from "../index";

// ── Provider Types ──

export interface AIConfig {
  provider: "openai" | "anthropic" | "ollama" | "custom";
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ── OpenAI Adapter ──

export async function openaiChat(
  messages: ChatMessage[],
  config: AIConfig,
): Promise<Result<string, string>> {
  const apiKey = config.apiKey || getEnv("OPENAI_API_KEY");
  if (!apiKey) {
    return Err("OPENAI_API_KEY not set. Set it via environment variable or AIConfig.");
  }

  const baseUrl = config.baseUrl || "https://api.openai.com/v1";

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || "gpt-4",
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return Err(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json() as OpenAIChatResponse;
    return Ok(data.choices?.[0]?.message?.content || "");
  } catch (error) {
    return Err(`OpenAI call failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ── Anthropic Adapter ──

export async function anthropicChat(
  messages: ChatMessage[],
  config: AIConfig,
): Promise<Result<string, string>> {
  const apiKey = config.apiKey || getEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return Err("ANTHROPIC_API_KEY not set. Set it via environment variable or AIConfig.");
  }

  // Extract system message (Anthropic requires it separately)
  const systemMsg = messages.find(m => m.role === "system")?.content || "";
  const userMessages = messages.filter(m => m.role !== "system");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model || "claude-sonnet-4-20250514",
        max_tokens: config.maxTokens ?? 2048,
        system: systemMsg,
        messages: userMessages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return Err(`Anthropic API error: ${response.status} ${error}`);
    }

    const data = await response.json() as AnthropicResponse;
    const text = data.content?.[0]?.text || "";
    return Ok(text);
  } catch (error) {
    return Err(`Anthropic call failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ── Ollama Adapter (local) ──

export async function ollamaChat(
  messages: ChatMessage[],
  config: AIConfig,
): Promise<Result<string, string>> {
  const baseUrl = config.baseUrl || "http://localhost:11434";

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model || "llama3",
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return Err(`Ollama API error: ${response.status} ${error}`);
    }

    const data = await response.json() as OllamaResponse;
    return Ok(data.message?.content || "");
  } catch (error) {
    return Err(`Ollama call failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ── Convenience: chat with auto-provider ──

export async function chat(
  messages: ChatMessage[],
  config?: Partial<AIConfig>,
): Promise<Result<string, string>> {
  // Check for mock first
  const { get_llm_mock } = await import("../mock.js");
  const mockResponse = get_llm_mock();
  if (mockResponse !== null) {
    return Ok(mockResponse);
  }

  const provider = config?.provider || "openai";
  const merged = { ...config, provider } as AIConfig;

  switch (provider) {
    case "openai":
      return openaiChat(messages, merged);
    case "anthropic":
      return anthropicChat(messages, merged);
    case "ollama":
      return ollamaChat(messages, merged);
    default:
      return Err(`Unknown AI provider: ${provider}. Use 'openai', 'anthropic', or 'ollama'.`);
  }
}

// ── Types ──

interface OpenAIChatResponse {
  choices?: { message?: { content?: string } }[];
}

interface AnthropicResponse {
  content?: { text: string; type: string }[];
}

interface OllamaResponse {
  message?: { content: string };
}

function getEnv(key: string): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
}