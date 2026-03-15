import { z } from "zod";

/**
 * Zod schema for structured MLS PDF extraction via Claude.
 * Defines the exact shape of data extracted from an ARMLS/FlexMLS listing PDF.
 */
export const MLSExtractionSchema = z.object({
  beds: z.number().int().min(0).describe("Number of bedrooms"),
  baths: z.number().min(0).describe("Total bathrooms (e.g. 2.5)"),
  sqft: z.number().int().min(0).describe("Approximate living square footage"),
  yearBuilt: z.number().int().min(1800).max(2100).describe("Year the home was built"),
  pool: z.boolean().describe("Whether the property has a private pool"),
  stories: z.number().int().min(1).max(5).describe("Number of exterior stories"),
  lotSqft: z.number().int().min(0).describe("Approximate lot square footage"),
  address: z.string().describe("Full street address"),
  subdivision: z.string().describe("Subdivision or community name"),
  features: z.array(z.string()).describe("Notable property features extracted from listing"),
});

export type MLSExtraction = z.infer<typeof MLSExtractionSchema>;
