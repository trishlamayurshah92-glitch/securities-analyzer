import { zodToJsonSchema } from 'zod-to-json-schema';
import { StructuredStockAnalysisV1Schema } from '@stockwatch/shared';

export const SUBMIT_STOCK_ANALYSIS_TOOL = {
  name: 'submit_stock_analysis',
  description:
    'Submit structured analysis data for one stock. ' +
    'Call this BEFORE writing the markdown narrative for that stock. ' +
    'Use null for any field the data sources could not provide.',
  input_schema: zodToJsonSchema(StructuredStockAnalysisV1Schema, {
    $refStrategy: 'none',
    target: 'jsonSchema7',
  }) as Record<string, unknown>,
} as const;
