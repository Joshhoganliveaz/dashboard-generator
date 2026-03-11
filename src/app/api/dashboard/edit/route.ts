import { NextResponse } from "next/server";
import { askClaude } from "@/lib/claude-api";
import { dashboardEditPrompt } from "@/lib/claude-prompts";
import { extractConfig, injectConfig } from "@/lib/template-engine";
import { getTemplateHtml } from "@/lib/template-loader";
import type { TemplateType } from "@/lib/template-registry";
import type { AnyDashboardConfig } from "@/lib/types";

export const maxDuration = 120;

function parseJSONFromClaude(text: string): Record<string, unknown> {
  let cleaned = text.trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim());
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error(`No JSON object found in response: ${cleaned.slice(0, 100)}...`);
  }
}

export async function POST(request: Request) {
  try {
    const { html, instruction, templateType } = (await request.json()) as {
      html: string;
      instruction: string;
      templateType: TemplateType;
    };

    if (!html || !instruction || !templateType) {
      return NextResponse.json(
        { error: "Missing required fields: html, instruction, templateType" },
        { status: 400 }
      );
    }

    // 1. Extract current config from HTML
    const currentConfig = extractConfig(html);
    const configJson = JSON.stringify(currentConfig, null, 2);

    // 2. Ask Claude to apply the edit
    const prompt = dashboardEditPrompt(configJson, instruction);
    const response = await askClaude(prompt, { maxTokens: 16384 });
    const modifiedConfig = parseJSONFromClaude(response) as unknown as AnyDashboardConfig;

    // 3. Re-inject into template
    const templateHtml = getTemplateHtml(templateType);
    const updatedHtml = injectConfig(templateHtml, modifiedConfig);

    return NextResponse.json({ html: updatedHtml });
  } catch (err) {
    console.error("Dashboard edit error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Edit failed" },
      { status: 500 }
    );
  }
}
