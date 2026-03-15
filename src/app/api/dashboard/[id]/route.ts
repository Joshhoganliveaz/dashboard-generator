import { NextRequest, NextResponse } from "next/server";
import { getDashboard, updateDashboard } from "@/lib/supabase/db";

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

    // Only allow updating safe fields
    const allowedFields = [
      "client_names",
      "full_name",
      "email",
      "agent_key",
      "slug",
      "status",
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const dashboard = await updateDashboard(id, updates);
    return NextResponse.json(dashboard);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
