import { NextRequest, NextResponse } from "next/server";
import { askClaudeWithWebSearch } from "@/lib/claude-api";

export async function POST(req: NextRequest) {
  try {
    const { address, cityStateZip } = await req.json();

    if (!address || !cityStateZip) {
      return NextResponse.json(
        { error: "address and cityStateZip are required" },
        { status: 400 }
      );
    }

    const prompt = `Search the Maricopa County Assessor records (or the relevant Arizona county assessor) for this property to find the official subdivision/plat name and any broader master-planned community it belongs to.

Address: ${address}
City/State/Zip: ${cityStateZip}

Search for the property on the county assessor's website (e.g., mcassessor.maricopa.gov) to find the legal subdivision name from the plat records. This is the official recorded subdivision, not just the neighborhood marketing name.

Return ONLY valid JSON with no other text:
{"subdivision": "Official Subdivision/Plat Name", "communityName": "Name of Community or Master-Planned Community"}

If the subdivision IS the community (no broader master-planned community), use the same name for both.`;

    const response = await askClaudeWithWebSearch(prompt, {
      model: "claude-sonnet-4-20250514",
      maxTokens: 1024,
    });

    // Extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { subdivision: "", communityName: "" },
        { status: 200 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      subdivision: parsed.subdivision || "",
      communityName: parsed.communityName || "",
    });
  } catch (err) {
    console.error("Subdivision lookup error:", err);
    return NextResponse.json(
      { subdivision: "", communityName: "", error: (err as Error).message },
      { status: 200 } // Return 200 with empty values so the form isn't blocked
    );
  }
}
