export type TemplateType = "houseversary" | "sell" | "buyer" | "buysell";

export type AnalysisLens = "homeowner" | "listing" | "buyer";

export type FileSlot = "csv" | "mlsPdf" | "taxRecords" | "cromford";

export interface PipelineStep {
  key: string;
  label: string;
}

export interface TemplateConfig {
  label: string;
  description: string;
  lens: AnalysisLens;
  requiredFiles: FileSlot[];
  optionalFiles: FileSlot[];
  pipelineSteps: PipelineStep[];
  templateFile: string;
}

export const TEMPLATE_REGISTRY: Record<TemplateType, TemplateConfig> = {
  houseversary: {
    label: "Houseversary",
    description: "Annual equity & market update for past clients",
    lens: "homeowner",
    requiredFiles: ["csv"],
    optionalFiles: ["mlsPdf", "taxRecords", "cromford"],
    pipelineSteps: [
      { key: "extracting_mls", label: "MLS" },
      { key: "parsing_csv", label: "Comps" },
      { key: "review_comps", label: "Review" },
      { key: "reading_cromford", label: "Cromford" },
      { key: "reading_tax_records", label: "Tax" },
      { key: "researching", label: "Research" },
      { key: "generating_content", label: "Content" },
      { key: "assembling", label: "Build" },
      { key: "complete", label: "Done" },
    ],
    templateFile: "template-houseversary.html",
  },
  sell: {
    label: "Sell Dashboard",
    description: "Pre-listing CMA with pricing strategy & net proceeds",
    lens: "listing",
    requiredFiles: ["csv", "mlsPdf"],
    optionalFiles: ["cromford"],
    pipelineSteps: [
      { key: "extracting_mls", label: "MLS" },
      { key: "parsing_csv", label: "Comps" },
      { key: "review_comps", label: "Review" },
      { key: "reading_cromford", label: "Cromford" },
      { key: "generating_content", label: "Content" },
      { key: "assembling", label: "Build" },
      { key: "complete", label: "Done" },
    ],
    templateFile: "template-sell.html",
  },
  buyer: {
    label: "Buyer Dashboard",
    description: "Purchase calculator, neighborhoods & schools",
    lens: "buyer",
    requiredFiles: [],
    optionalFiles: ["csv"],
    pipelineSteps: [
      { key: "parsing_csv", label: "Comps" },
      { key: "review_comps", label: "Review" },
      { key: "generating_content", label: "Content" },
      { key: "assembling", label: "Build" },
      { key: "complete", label: "Done" },
    ],
    templateFile: "template-buyer.html",
  },
  buysell: {
    label: "Buy/Sell Dashboard",
    description: "Combined sell analysis + buyer search with bridge calculations",
    lens: "listing",
    requiredFiles: ["csv"],
    optionalFiles: ["mlsPdf", "cromford"],
    pipelineSteps: [
      { key: "extracting_mls", label: "MLS" },
      { key: "parsing_csv", label: "Comps" },
      { key: "review_comps", label: "Review" },
      { key: "reading_cromford", label: "Cromford" },
      { key: "generating_content", label: "Content" },
      { key: "assembling", label: "Build" },
      { key: "complete", label: "Done" },
    ],
    templateFile: "template-buysell.html",
  },
};

/** Check whether a file slot is required for a given template type */
export function isFileRequired(type: TemplateType, slot: FileSlot): boolean {
  return TEMPLATE_REGISTRY[type].requiredFiles.includes(slot);
}

/** Check whether a file slot is relevant (required or optional) for a given template type */
export function isFileRelevant(type: TemplateType, slot: FileSlot): boolean {
  const config = TEMPLATE_REGISTRY[type];
  return config.requiredFiles.includes(slot) || config.optionalFiles.includes(slot);
}
