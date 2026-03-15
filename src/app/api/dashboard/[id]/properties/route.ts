import { NextRequest, NextResponse } from "next/server";
import {
  listPropertiesOfInterest,
  addPropertyOfInterest,
  removePropertyOfInterest,
} from "@/lib/supabase/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const properties = await listPropertiesOfInterest(id);
    return NextResponse.json(properties);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    if (!body.address || typeof body.address !== "string") {
      return NextResponse.json(
        { error: "address is required" },
        { status: 400 }
      );
    }

    const poi = await addPropertyOfInterest(id, {
      address: body.address,
      price: body.price ?? undefined,
      listing_url: body.listing_url ?? undefined,
      photo_url: body.photo_url ?? undefined,
      notes: body.notes ?? undefined,
    });

    return NextResponse.json(poi, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get("propertyId");

    if (!propertyId) {
      return NextResponse.json(
        { error: "propertyId query parameter is required" },
        { status: 400 }
      );
    }

    await removePropertyOfInterest(propertyId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
