import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MLSExtractionSchema, type MLSExtraction } from "./schemas/mls-extraction";

// --- Types (preserved for backward compatibility) ---

interface ClaudeMessage {
  role: "user" | "assistant";
  content: ClaudeContent[];
}

type ClaudeContent =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

interface ClaudeOptions {
  model?: string;
  maxTokens?: number;
  system?: string;
  tools?: ClaudeTool[];
}

interface ClaudeTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface ClaudeResponse {
  content: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

// --- Singleton client ---

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// --- Retry helpers ---

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  if (!status) return false;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function retryDelay(attempt: number): number {
  const base = Math.pow(2, attempt) * 1000;
  const jitter = Math.random() * 500;
  return Math.min(base + jitter, 30000);
}

// --- Core API: callClaude (backward-compatible) ---

export async function callClaude(
  messages: ClaudeMessage[],
  options: ClaudeOptions = {}
): Promise<ClaudeResponse> {
  const client = getClient();
  const model = options.model || "claude-sonnet-4-20250514";
  const maxTokens = options.maxTokens || 16384;

  const params: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages,
  };
  if (options.system) params.system = options.system;
  if (options.tools) params.tools = options.tools;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await sleep(retryDelay(attempt));
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await client.messages.create(params as any);
      return response as unknown as ClaudeResponse;
    } catch (err) {
      lastError = err as Error;
      if (isRetryable(err) && attempt < 2) continue;
      throw err;
    }
  }

  throw lastError || new Error("Claude API call failed after retries");
}

// --- Structured output with retry: callClaudeWithRetry ---

export async function callClaudeWithRetry<T>(
  messages: ClaudeMessage[],
  outputFormat: ReturnType<typeof zodOutputFormat>,
  options: ClaudeOptions = {}
): Promise<{ content: unknown[]; parsed_output: T; stop_reason: string; usage: { input_tokens: number; output_tokens: number } }> {
  const client = getClient();
  const model = options.model || "claude-sonnet-4-20250514";
  const maxTokens = options.maxTokens || 16384;

  const params: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages,
    output_format: outputFormat,
  };
  if (options.system) params.system = options.system;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await sleep(retryDelay(attempt));
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await client.messages.parse(params as any);
      return response as unknown as { content: unknown[]; parsed_output: T; stop_reason: string; usage: { input_tokens: number; output_tokens: number } };
    } catch (err) {
      lastError = err as Error;
      if (isRetryable(err) && attempt < 2) continue;
      throw err;
    }
  }

  throw lastError || new Error("Claude API call failed after retries");
}

// --- Structured MLS extraction ---

export async function extractMLSData(pdfBase64: string): Promise<MLSExtraction> {
  const messages: ClaudeMessage[] = [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: pdfBase64,
          },
        },
        {
          type: "text",
          text: "Extract the property details from this MLS listing PDF. Return beds, baths, sqft, yearBuilt, pool (boolean), stories, lotSqft, address, subdivision, and notable features array.",
        },
      ],
    },
  ];

  const result = await callClaudeWithRetry<MLSExtraction>(
    messages,
    zodOutputFormat(MLSExtractionSchema),
    { maxTokens: 4096 }
  );

  return result.parsed_output;
}

// --- Backward-compatible convenience functions ---

export async function askClaude(
  prompt: string,
  options: ClaudeOptions = {}
): Promise<string> {
  const response = await callClaude(
    [{ role: "user", content: [{ type: "text", text: prompt }] }],
    options
  );

  const textBlock = response.content.find((c) => c.type === "text");
  return textBlock?.text || "";
}

export async function askClaudeWithImages(
  prompt: string,
  images: { base64: string; mediaType: string }[],
  options: ClaudeOptions = {}
): Promise<string> {
  const content: ClaudeContent[] = images.map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: img.mediaType,
      data: img.base64,
    },
  }));
  content.push({ type: "text", text: prompt });

  const response = await callClaude(
    [{ role: "user", content }],
    options
  );

  const textBlock = response.content.find((c) => c.type === "text");
  return textBlock?.text || "";
}

export async function askClaudeWithPDF(
  prompt: string,
  pdfBase64: string,
  options: ClaudeOptions = {}
): Promise<string> {
  const content: ClaudeContent[] = [
    {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: pdfBase64,
      },
    },
    { type: "text", text: prompt },
  ];

  const response = await callClaude(
    [{ role: "user", content }],
    options
  );

  const textBlock = response.content.find((c) => c.type === "text");
  return textBlock?.text || "";
}

export async function askClaudeWithWebSearch(
  prompt: string,
  options: ClaudeOptions = {}
): Promise<string> {
  const client = getClient();
  const model = options.model || "claude-sonnet-4-20250514";
  const maxTokens = options.maxTokens || 16384;

  const params = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user" as const, content: [{ type: "text" as const, text: prompt }] }],
    tools: [{ type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 5 }],
    ...(options.system ? { system: options.system } : {}),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await client.messages.create(params as any);
  const textBlock = (response as unknown as ClaudeResponse).content.find((c) => c.type === "text");
  return textBlock?.text || "";
}
