import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the @anthropic-ai/sdk module
const mockCreate = vi.fn();
const mockParse = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreate,
        parse: mockParse,
      };
    },
  };
});

vi.mock("@anthropic-ai/sdk/helpers/zod", () => ({
  zodOutputFormat: vi.fn((schema: unknown) => ({
    type: "json_schema" as const,
    schema,
  })),
}));

// Import after mocks are set up
import {
  callClaude,
  askClaude,
  callClaudeWithRetry,
  extractMLSData,
} from "../claude-api";

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key-123");
  mockCreate.mockReset();
  mockParse.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("callClaude", () => {
  it("uses 16384 as default maxTokens", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "hello" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await callClaude([{ role: "user", content: [{ type: "text", text: "hi" }] }]);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ max_tokens: 16384 })
    );
  });

  it("allows overriding maxTokens", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "hello" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await callClaude(
      [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      { maxTokens: 8192 }
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ max_tokens: 8192 })
    );
  });
});

describe("callClaudeWithRetry", () => {
  it("retries on 429 status", async () => {
    const error429 = new Error("Rate limited") as Error & { status: number };
    error429.status = 429;

    mockParse
      .mockRejectedValueOnce(error429)
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "ok" }],
        parsed_output: { test: true },
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      });

    const result = await callClaudeWithRetry(
      [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      { type: "json_schema", schema: {} } as never
    );

    expect(mockParse).toHaveBeenCalledTimes(2);
    expect(result.parsed_output).toEqual({ test: true });
  });

  it("retries on 5xx status", async () => {
    const error500 = new Error("Server error") as Error & { status: number };
    error500.status = 500;

    mockParse
      .mockRejectedValueOnce(error500)
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "ok" }],
        parsed_output: { result: "success" },
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      });

    const result = await callClaudeWithRetry(
      [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      { type: "json_schema", schema: {} } as never
    );

    expect(mockParse).toHaveBeenCalledTimes(2);
    expect(result.parsed_output).toEqual({ result: "success" });
  });

  it("does NOT retry on 400 status", async () => {
    const error400 = new Error("Bad request") as Error & { status: number };
    error400.status = 400;

    mockParse.mockRejectedValueOnce(error400);

    await expect(
      callClaudeWithRetry(
        [{ role: "user", content: [{ type: "text", text: "hi" }] }],
        { type: "json_schema", schema: {} } as never
      )
    ).rejects.toThrow("Bad request");

    expect(mockParse).toHaveBeenCalledTimes(1);
  });

  it("uses exponential backoff with increasing delays", async () => {
    const error429 = new Error("Rate limited") as Error & { status: number };
    error429.status = 429;

    const callTimes: number[] = [];
    mockParse
      .mockImplementationOnce(async () => { callTimes.push(Date.now()); throw error429; })
      .mockImplementationOnce(async () => { callTimes.push(Date.now()); throw error429; })
      .mockImplementation(async () => {
        callTimes.push(Date.now());
        return {
          content: [{ type: "text", text: "ok" }],
          parsed_output: {},
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
        };
      });

    const result = await callClaudeWithRetry(
      [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      { type: "json_schema", schema: {} } as never
    );

    // Should have been called 3 times (2 retries + final success)
    expect(mockParse).toHaveBeenCalledTimes(3);
    expect(result.parsed_output).toEqual({});

    // Verify delays increase (second gap > first gap)
    if (callTimes.length === 3) {
      const gap1 = callTimes[1] - callTimes[0];
      const gap2 = callTimes[2] - callTimes[1];
      expect(gap2).toBeGreaterThan(gap1);
    }
  }, 30000);
});

describe("extractMLSData", () => {
  it("calls parse with structured output format", async () => {
    mockParse.mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
      parsed_output: {
        beds: 4,
        baths: 2.5,
        sqft: 1920,
        yearBuilt: 1986,
        pool: true,
        stories: 1,
        lotSqft: 8500,
        address: "2252 S Estrella Cir",
        subdivision: "Saratoga Lakes",
        features: ["pool", "covered patio"],
      },
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 50 },
    });

    const result = await extractMLSData("base64pdfdata");

    expect(mockParse).toHaveBeenCalledWith(
      expect.objectContaining({
        output_format: expect.objectContaining({ type: "json_schema" }),
      })
    );

    expect(result.beds).toBe(4);
    expect(result.sqft).toBe(1920);
    expect(result.features).toEqual(["pool", "covered patio"]);
  });
});

describe("askClaude (backward compatibility)", () => {
  it("returns a string, not structured output", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "This is a plain text response" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 8 },
    });

    const result = await askClaude("What is 2+2?");

    expect(typeof result).toBe("string");
    expect(result).toBe("This is a plain text response");
    // Should use create, not parse
    expect(mockCreate).toHaveBeenCalled();
    expect(mockParse).not.toHaveBeenCalled();
  });
});
