import { NextRequest, NextResponse } from "next/server";
import { getDashboard, updateDashboard } from "@/lib/supabase/db";
import { deleteDashboardHtml } from "@/lib/r2";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const dashboard = await getDashboard(id);

    if (dashboard.status !== "published") {
      return NextResponse.json(
        { error: "Only published dashboards can be archived" },
        { status: 400 }
      );
    }

    // Remove HTML from R2 so the public URL returns 404
    await deleteDashboardHtml(dashboard.slug);

    // Update status in database
    await updateDashboard(id, { status: "archived" });

    return NextResponse.json({ status: "archived" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("no rows") || message.includes("multiple")) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
