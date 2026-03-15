import { NextRequest, NextResponse } from "next/server";
import { getDashboard, updateDashboard } from "@/lib/supabase/db";
import { renderDashboardHtml } from "@/lib/publish";
import { uploadDashboardHtml } from "@/lib/r2";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Fetch dashboard to get slug and validate existence
    const dashboard = await getDashboard(id);

    // Render HTML from DB data using existing template engine
    const html = await renderDashboardHtml(id);

    // Upload to R2 (overwrites if already published — same key, same URL)
    await uploadDashboardHtml(dashboard.slug, html);

    // Update status to published with timestamp
    const published_at = new Date().toISOString();
    await updateDashboard(id, {
      status: "published",
      published_at,
    });

    return NextResponse.json({
      url: `/d/${dashboard.slug}`,
      slug: dashboard.slug,
      published_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("no rows") || message.includes("multiple")) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
