import { NextResponse } from "next/server";
import { extractMLSData } from "@/lib/claude-api";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("mlsPdf") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No PDF file provided" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // Extract MLS data using Claude
    const extracted = await extractMLSData(base64);

    return NextResponse.json({ data: extracted });
  } catch (err) {
    console.error("MLS extraction error:", err);

    // Return 200 with empty data + error message so the UI can fall back to manual entry
    return NextResponse.json({
      data: null,
      error: (err as Error).message || "Extraction failed",
    });
  }
}
