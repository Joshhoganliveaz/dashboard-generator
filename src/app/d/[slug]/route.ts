import { NextRequest } from "next/server";
import { getDashboardHtml } from "@/lib/r2";

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  const body = await getDashboardHtml(slug);

  if (!body) {
    return new Response("Dashboard not found", { status: 404 });
  }

  // Stream HTML directly from R2 — avoid buffering ~788KB templates in memory
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}
