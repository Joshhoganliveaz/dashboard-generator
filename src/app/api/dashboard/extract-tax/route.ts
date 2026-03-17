import { NextResponse } from "next/server";
import { askClaudeWithPDF } from "@/lib/claude-api";
import { buildMonsoonExtractionPrompt } from "@/lib/tax-record-parser";
import type { MonsoonExtraction } from "@/lib/types";

export const maxDuration = 60;

/**
 * Parse JSON from Claude's response, handling possible markdown fences
 * or prose wrapping around the JSON object.
 */
function parseJSONFromClaude(text: string): unknown {
  // Try direct parse first
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip markdown code fences if present
    let cleaned = trimmed;
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    try {
      return JSON.parse(cleaned);
    } catch {
      // Extract first JSON object from the text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error("No valid JSON found in Claude response");
    }
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("taxPdf") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No PDF file provided" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { success: false, error: "File must be a PDF" },
        { status: 400 }
      );
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // Extract tax record data using Claude with the Monsoon extraction prompt
    const responseText = await askClaudeWithPDF(
      buildMonsoonExtractionPrompt(),
      base64,
      { maxTokens: 4096 }
    );

    const data = parseJSONFromClaude(responseText) as MonsoonExtraction;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Tax record extraction error:", err);
    return NextResponse.json(
      { success: false, error: "Extraction failed. Try a clearer PDF." },
      { status: 500 }
    );
  }
}
