import Anthropic from "@anthropic-ai/sdk";
import { MLSExtractionSchema, type MLSExtraction } from "./schemas/mls-extraction";
import type { z } from "zod";

// Manual JSON schema output format (avoids @anthropic-ai/sdk/helpers/zod which requires zod 3.25+)
function zodToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const shape = schema.shape;
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const field = value as z.ZodTypeAny;
    const def = field._def;
    let prop: Record<string, unknown> = {};

    // Unwrap optionals
    let inner = def;
    let isOptional = false;
    if (inner.typeName === "ZodOptional") {
      isOptional = true;
      inner = inner.innerType._def;
    }

    // Map zod types to JSON schema
    switch (inner.typeName) {
      case "ZodString":
        prop = { type: "string" };
        break;
      case "ZodNumber":
        prop = inner.checks?.some((c: { kind: string }) => c.kind === "int")
          ? { type: "integer" }
          : { type: "number" };
        break;
      case "ZodBoolean":
        prop = { type: "boolean" };
        break;
      case "ZodArray":
        prop = { type: "array", items: { type: "string" } };
        break;
      default:
        prop = { type: "string" };
    }

    if (inner.description) prop.description = inner.description;
    properties[key] = prop;
    if (!isOptional) required.push(key);
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

function manualOutputFormat(schema: z.ZodObject<z.ZodRawShape>) {
  return {
    type: "json_schema" as const,
    schema: zodToJsonSchema(schema),
  };
}

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
  outputFormat: { type: "json_schema"; schema: Record<string, unknown> },
  options: ClaudeOptions = {}
): Promise<{ content: unknown[]; parsed_output: T; stop_reason: string; usage: { input_tokens: number; output_tokens: number } }> {
  const client = getClient();
  const model = options.model || "claude-sonnet-4-20250514";
  const maxTokens = options.maxTokens || 16384;

  const params: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages,
    output_config: { format: outputFormat },
  };
  if (options.system) params.system = options.system;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await sleep(retryDelay(attempt));
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await client.messages.create(params as any);
      // Parse the JSON output from the response content
      const textBlock = (response as unknown as ClaudeResponse).content.find((c) => c.type === "text");
      const parsed = textBlock?.text ? JSON.parse(textBlock.text) : null;
      return {
        content: (response as unknown as ClaudeResponse).content,
        parsed_output: parsed as T,
        stop_reason: (response as unknown as ClaudeResponse).stop_reason,
        usage: (response as unknown as ClaudeResponse).usage,
      };
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
          text: `Extract the property details from this MLS listing PDF. Return ONLY a JSON object with these fields:
{
  "beds": (integer),
  "baths": (number, e.g. 2.5),
  "sqft": (integer, living area),
  "yearBuilt": (integer),
  "pool": (boolean),
  "stories": (integer),
  "lotSqft": (integer),
  "address": (string, full street address),
  "subdivision": (string, subdivision or community name),
  "features": (array of strings, notable property features)
}
Return ONLY the JSON object, no other text.`,
        },
      ],
    },
  ];

  const response = await callClaude(messages, { maxTokens: 4096 });
  const textBlock = response.content.find((c) => c.type === "text");
  const text = textBlock?.text || "";

  // Parse JSON, handling possible markdown code fences or prose
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to extract JSON from Claude response");

  return JSON.parse(jsonMatch[0]) as MLSExtraction;
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
