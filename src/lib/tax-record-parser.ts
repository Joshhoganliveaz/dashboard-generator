import type { LoanOrigination, MonsoonExtraction } from "./types";

/**
 * Build the Claude extraction prompt for Monsoon property tax record PDFs.
 * Returns a structured prompt that produces a MonsoonExtraction JSON object.
 */
export function buildMonsoonExtractionPrompt(): string {
  return `Extract structured data from this Monsoon property tax record PDF.

Return a JSON object with this exact structure:
{
  "address": "street address only",
  "city": "city name",
  "state": "AZ",
  "zip": "zip code",
  "livingArea": number (from Living Area in Structure Information),
  "yearBuilt": number,
  "lotSqft": number (from Lot size),
  "stories": number (1 for single story "S", 2 for two story),
  "pool": boolean,
  "poolSqft": number (0 if no pool),
  "garage": number (spaces, from Covered Parking),
  "deedHistory": [
    {
      "saleDate": "YYYY-MM-DD",
      "buyer": "buyer name",
      "seller": "seller name",
      "salePrice": number,
      "downPayment": number,
      "mortgageAmount": number,
      "financing": "financing type"
    }
  ],
  "loanOriginationHistory": [
    {
      "date": "YYYY-MM-DD",
      "amount": number,
      "lender": "mortgage company name",
      "financeType": "finance type"
    }
  ]
}

Important:
- Include ALL rows from the Deed History table
- Include ALL rows from the Loan Origination History table
- Parse dates as YYYY-MM-DD format
- Parse all dollar amounts as numbers (no $ or commas)
- For garage, extract the number from "GARAGE - 2" as 2
- For stories, "S" means 1 story
- Return ONLY the JSON object, no markdown or explanation`;
}

/**
 * Find the original loan amount for a specific owner from the extraction data.
 * Looks up the deed history for a matching buyer name, then falls back to
 * the closest loan origination within 60 days of the purchase date.
 *
 * @param extraction - Parsed Monsoon tax record data
 * @param ownerName - Owner name to match against deed history buyers
 * @returns Original loan amount or null if not found
 */
export function findOriginalLoanAmount(
  extraction: MonsoonExtraction,
  ownerName: string
): number | null {
  const ownerDeed = extraction.deedHistory.find(
    (d) => d.buyer.toUpperCase().includes(ownerName.toUpperCase().split(" ")[0])
  );

  if (!ownerDeed) return null;

  if (ownerDeed.mortgageAmount > 0) {
    return ownerDeed.mortgageAmount;
  }

  const purchaseDate = new Date(ownerDeed.saleDate).getTime();
  let closest: LoanOrigination | null = null;
  let closestDiff = Infinity;

  for (const loan of extraction.loanOriginationHistory) {
    const diff = Math.abs(new Date(loan.date).getTime() - purchaseDate);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = loan;
    }
  }

  // 60-day window in milliseconds
  if (closest && closestDiff < 60 * 24 * 60 * 60 * 1000) {
    return closest.amount;
  }

  return null;
}
