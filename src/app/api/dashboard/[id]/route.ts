import { NextRequest, NextResponse } from "next/server";
import {
  getDashboard,
  updateDashboard,
  upsertSellData,
  upsertBuyData,
} from "@/lib/supabase/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const dashboard = await getDashboard(id);
    return NextResponse.json(dashboard);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // Supabase returns "JSON object requested, multiple (or no) rows returned"
    // when the row doesn't exist with .single()
    if (message.includes("no rows") || message.includes("multiple")) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Only allow updating safe dashboard-level fields
    const allowedFields = [
      "client_names",
      "full_name",
      "email",
      "agent_key",
      "slug",
      "status",
      "published_at",
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    // Save dashboard-level fields if any
    let dashboard = null;
    if (Object.keys(updates).length > 0) {
      dashboard = await updateDashboard(id, updates);
    }

    // Save sell_data if provided
    if (body.sell_data && typeof body.sell_data === "object") {
      await upsertSellData(id, body.sell_data);
    }

    // Save buy_data if provided
    if (body.buy_data && typeof body.buy_data === "object") {
      await upsertBuyData(id, body.buy_data);
    }

    // If nothing was updated at all, return error
    if (!dashboard && !body.sell_data && !body.buy_data) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Return fresh dashboard with all data
    const fresh = await getDashboard(id);
    return NextResponse.json(fresh);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
