import type { ConversionResult } from "../services/conversionService.js";

export function formatConversionResult(result: ConversionResult): string {
  if (result.ok) {
    return result.affiliateLink;
  }

  return `Could not generate affiliate link. ${result.message}`;
}
