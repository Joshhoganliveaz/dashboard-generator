import { NextRequest, NextResponse } from "next/server";
import { findAvailableSlug } from "@/lib/slug";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get("slug");
  const excludeId = searchParams.get("excludeId") ?? undefined;

  if (!slug) {
    return NextResponse.json(
      { error: "slug parameter is required" },
      { status: 400 }
    );
  }

  try {
    const suggestion = await findAvailableSlug(slug, excludeId);
    return NextResponse.json({
      available: suggestion === slug,
      suggestion,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to check slug";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
