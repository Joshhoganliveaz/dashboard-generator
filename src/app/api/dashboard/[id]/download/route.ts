import { NextRequest, NextResponse } from "next/server";
import { getDashboard } from "@/lib/supabase/db";
import { renderDashboardHtml } from "@/lib/publish";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get dashboard for slug (used in filename)
    const dashboard = await getDashboard(id);

    // Render HTML from DB data
    const html = await renderDashboardHtml(id);

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-disposition": `attachment; filename="${dashboard.slug}.html"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("no rows") || message.includes("multiple")) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
