import { myProvider } from '@/lib/ai/models';
import {
  bioSheetPrompt,
  sheetPrompt,
  updateDocumentPrompt,
} from '@/lib/ai/prompts';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { streamObject } from 'ai';
import { z } from 'zod';

// Schema for bioinformatics metadata
const bioSheetMetadataSchema = z.object({
  dataType: z
    .enum([
      'gene_expression',
      'sequence_data',
      'variant_data',
      'pathway_data',
      'general',
    ])
    .optional(),
  organism: z.string().optional(),
  sampleCount: z.number().optional(),
  featureCount: z.number().optional(),
  significantFeatures: z.array(z.string()).optional(),
  pathways: z.array(z.string()).optional(),
  analysisNotes: z.string().optional(),
});

// Type for operation parameter values
type ParameterValue = string | number | boolean | null;

export const sheetDocumentHandler = createDocumentHandler<'sheet'>({
  kind: 'sheet',
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = '';
    let isBioinformatics = false;

    // Check if the title suggests bioinformatics data
    const bioinformaticsKeywords = [
      'gene',
      'expression',
      'rna-seq',
      'rnaseq',
      'dna',
      'protein',
      'sequence',
      'genome',
      'variant',
      'snp',
      'mutation',
      'pathway',
      'cell',
      'scRNA',
      'single-cell',
      'genomics',
      'transcriptome',
    ];

    isBioinformatics = bioinformaticsKeywords.some((keyword) =>
      title.toLowerCase().includes(keyword.toLowerCase()),
    );

    // Use specialized prompt for bioinformatics data
    const promptToUse = isBioinformatics ? bioSheetPrompt : sheetPrompt;

    // Stream the CSV data generation
    const { fullStream } = streamObject({
      model: myProvider.languageModel('artifact-model'),
      system: promptToUse,
      prompt: title,
      schema: z.object({
        csv: z.string().describe('CSV data'),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'object') {
        const { object } = delta;
        const { csv } = object;

        if (csv) {
          dataStream.writeData({
            type: 'sheet-delta',
            content: csv,
          });

          draftContent = csv;
        }
      }
    }

    // If it's bioinformatics data, process additional metadata
    if (isBioinformatics && draftContent) {
      try {
        // Generate basic metadata on the client side
        dataStream.writeData({
          type: 'bio-metadata',
          content: {
            dataType: 'general',
            organism: null,
            sampleCount: draftContent.split('\n').length - 1, // Rough count excluding header
            featureCount: draftContent.split('\n')[0].split(',').length,
            significantFeatures: [],
            pathways: [],
            filterHistory: [],
            analysisNotes: null,
          },
        });
      } catch (error) {
        console.error('Error generating bioinformatics metadata:', error);
      }
    }

    dataStream.writeData({
      type: 'sheet-delta',
      content: draftContent,
    });

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = '';
    const isBioDataUpdate = isBioinformaticsDescription(description);

    // Use specialized prompt for bioinformatics data updates
    const promptToUse = isBioDataUpdate
      ? updateDocumentPrompt(document.content, 'biosheet')
      : updateDocumentPrompt(document.content, 'sheet');

    const { fullStream } = streamObject({
      model: myProvider.languageModel('artifact-model'),
      system: promptToUse,
      prompt: description,
      schema: z.object({
        csv: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'object') {
        const { object } = delta;
        const { csv } = object;

        if (csv) {
          dataStream.writeData({
            type: 'sheet-delta',
            content: csv,
          });

          draftContent = csv;
        }
      }
    }

    // If the update is biodata-specific, process additional client-side metadata
    if (isBioDataUpdate && draftContent) {
      try {
        // Update client-side metadata based on the description
        dataStream.writeData({
          type: 'bio-metadata',
          content: {
            filterHistory: extractFilterHistory(description),
            // Other metadata fields are preserved from previous state
          },
        });
      } catch (error) {
        console.error('Error processing bioinformatics data update:', error);
      }
    }

    return draftContent;
  },
});

/**
 * Helper function to detect if a description refers to bioinformatics operations
 *
 * @param description The user's description or query to analyze
 * @returns boolean indicating if the description is related to bioinformatics
 */
function isBioinformaticsDescription(description: string): boolean {
  const bioKeywords = [
    'gene',
    'expression',
    'pathway',
    'p-value',
    'fold change',
    'significant',
    'transcript',
    'protein',
    'sequence',
    'variant',
    'mutation',
    'chromosome',
    'genomic',
    'differential',
    'cell type',
    'cluster',
    'marker',
    'ontology',
    'GO term',
  ];

  return bioKeywords.some((keyword) =>
    description.toLowerCase().includes(keyword.toLowerCase()),
  );
}

/**
 * Helper function to extract operation type from description
 *
 * @param description The user's description or query
 * @returns String representing the operation type
 */
function extractBioOperation(description: string): string {
  const descLower = description.toLowerCase();

  if (descLower.includes('filter')) {
    return 'filter';
  }

  if (
    descLower.includes('highlight pathway') ||
    descLower.includes('pathway highlight')
  ) {
    return 'highlight_pathway';
  }

  if (
    descLower.includes('significant') ||
    descLower.includes('p-value') ||
    descLower.includes('p < 0.05')
  ) {
    return 'filter_significant';
  }

  return 'process'; // Default generic operation
}

/**
 * Helper function to extract parameters from description
 *
 * @param description The user's description
 * @returns Record of parameter values
 */
function extractBioParameters(
  description: string,
): Record<string, ParameterValue> {
  const params: Record<string, ParameterValue> = {};

  // Extract p-value threshold
  const pValueMatch = description.match(/p\s*[<>]\s*(0\.\d+)/i);
  if (pValueMatch?.[1]) {
    params.p_value_threshold = Number.parseFloat(pValueMatch[1]);
  }

  // Extract fold change threshold
  const fcMatch = description.match(/fold change\s*[><]\s*(\d+\.?\d*)/i);
  if (fcMatch?.[1]) {
    params.fold_change_threshold = Number.parseFloat(fcMatch[1]);
  }

  // Extract pathway name
  const pathwayMatch = description.match(
    /pathway[s]?\s+(?:called|named)?\s+["']?([^"'.,]+)["']?/i,
  );
  if (pathwayMatch?.[1]) {
    params.pathway = pathwayMatch[1].trim();
  }

  // Extract gene name
  const geneMatch = description.match(
    /gene[s]?\s+(?:called|named)?\s+["']?([^"'.,]+)["']?/i,
  );
  if (geneMatch?.[1]) {
    params.gene = geneMatch[1].trim();
  }

  return params;
}

/**
 * Helper function to extract filter history from description
 *
 * @param description The user's description
 * @returns Array of filter operations
 */
function extractFilterHistory(
  description: string,
): Array<{ column: string; condition: string; value: string }> {
  // This is a simplified implementation that should be expanded based on the project's needs
  const filterHistory: Array<{
    column: string;
    condition: string;
    value: string;
  }> = [];

  // Example: Extract "filter genes where p-value < 0.05"
  const pValueFilterMatch = description.match(
    /filter\s+(\w+)\s+where\s+(\w+[\-\s]?\w*)\s+([<>=]+)\s+(.+?)(?:\s|$)/i,
  );
  if (pValueFilterMatch) {
    filterHistory.push({
      column: pValueFilterMatch[2].trim(),
      condition:
        pValueFilterMatch[3] === '<'
          ? 'lessThan'
          : pValueFilterMatch[3] === '>'
            ? 'greaterThan'
            : 'equals',
      value: pValueFilterMatch[4].trim(),
    });
  }

  return filterHistory;
}

export const handler = sheetDocumentHandler;
