const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

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

export async function callClaude(
  messages: ClaudeMessage[],
  options: ClaudeOptions = {}
): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const model = options.model || "claude-sonnet-4-20250514";
  const maxTokens = options.maxTokens || 4096;

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages,
  };
  if (options.system) body.system = options.system;
  if (options.tools) body.tools = options.tools;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        lastError = new Error(`Rate limited (429). Attempt ${attempt + 1}/3`);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Claude API error ${res.status}: ${errText}`);
      }

      return (await res.json()) as ClaudeResponse;
    } catch (err) {
      lastError = err as Error;
      if (attempt < 2 && (err as Error).message?.includes("429")) continue;
      throw err;
    }
  }

  throw lastError || new Error("Claude API call failed after retries");
}

// Convenience: call Claude and get text response
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

// Call Claude with images (for Cromford screenshots)
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

// Call Claude with PDF
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

// Call Claude with web search tool
export async function askClaudeWithWebSearch(
  prompt: string,
  options: ClaudeOptions = {}
): Promise<string> {
  const tools: ClaudeTool[] = [
    {
      name: "web_search" as never,
      description: "Search the web for information",
      input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  ];

  // Use the Anthropic web search tool type
  const body: Record<string, unknown> = {
    model: options.model || "claude-sonnet-4-20250514",
    max_tokens: options.maxTokens || 4096,
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
  };
  if (options.system) body.system = options.system;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API error ${res.status}: ${errText}`);
  }

  const response = (await res.json()) as ClaudeResponse;
  const textBlock = response.content.find((c) => c.type === "text");
  return textBlock?.text || "";
}
