// @ts-ignore — imported as raw string via webpack asset/source rule in next.config.js
import houseversaryHtml from "./template-houseversary.html";
// @ts-ignore
import sellHtml from "./template-sell.html";
// @ts-ignore
import buyerHtml from "./template-buyer.html";
// @ts-ignore
import buysellHtml from "./template-buysell.html";

import type { TemplateType } from "./template-registry";

const TEMPLATES: Record<TemplateType, string> = {
  houseversary: houseversaryHtml,
  sell: sellHtml,
  buyer: buyerHtml,
  buysell: buysellHtml,
};

export function getTemplateHtml(templateType: TemplateType = "houseversary"): string {
  const html = TEMPLATES[templateType];
  if (!html) {
    throw new Error(`Unknown template type: ${templateType}`);
  }
  return html;
}
