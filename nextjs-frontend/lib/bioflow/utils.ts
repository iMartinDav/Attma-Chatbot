/**
 * BioFlow utilities for handling bioinformatics data
 */
import { parse, unparse, ParseResult } from 'papaparse';

/**
 * Type definition for CSV row data
 */
interface CSVRow {
  [key: string]: string | number | null | undefined;
}

/**
 * Detects if a given string or file contains bioinformatics data based on patterns
 * in column headers, content structure, and keywords.
 *
 * @param data String content to analyze or detect as bioinformatics data
 * @returns boolean indicating if data appears to be bioinformatics-related
 */
export function detectBioformaticsData(data: string): boolean {
  if (!data) return false;

  // Common bioinformatics column headers and terms
  const bioHeaders = [
    'gene',
    'transcript',
    'ensembl',
    'entrez',
    'uniprot',
    'chromosome',
    'chrom',
    'chr',
    'position',
    'pos',
    'start',
    'end',
    'strand',
    'p-value',
    'pvalue',
    'padj',
    'fdr',
    'adj.p',
    'log2fc',
    'lfc',
    'fold_change',
    'ref',
    'alt',
    'variant',
    'mutation',
    'snp',
    'indel',
    'allele',
    'effect',
    'go_term',
    'kegg',
    'reactome',
    'pathway',
    'ontology',
    'expression',
    'fpkm',
    'tpm',
    'counts',
    'normalized_counts',
    'cell_type',
    'cluster',
    'marker',
    'tissue',
    'sample',
  ];

  try {
    // Try to parse as CSV and check headers
    const parsed = parse(data, {
      header: true,
      preview: 10,
      skipEmptyLines: true,
    });
    const fields = parsed.meta?.fields;
    if (fields) {
      // Check if any headers match known bioinformatics terms
      for (const field of fields) {
        const fieldLower = field.toLowerCase();
        if (bioHeaders.some((header) => fieldLower.includes(header))) {
          return true;
        }
      }

      // Check data patterns in the first few rows (if available)
      if (parsed.data && parsed.data.length > 0) {
        // Check for patterns like gene identifiers or chromosomal positions
        const firstRow = parsed.data[0] as Record<string, unknown>;

        // Look for common bioinformatics data patterns in values
        for (const [key, value] of Object.entries(firstRow)) {
          if (typeof value === 'string') {
            // Check for gene identifier patterns (e.g., ENSG00000139618, TP53)
            if (
              /^ENS[GTP]\d{11}$/.test(value) || // Ensembl gene/transcript pattern
              (/^[A-Z0-9]+$/.test(value) && value.length <= 10)
            ) {
              // Gene symbol pattern
              return true;
            }

            // Check for chromosome position patterns (e.g., "chr7:140453136-140453136")
            if (/^chr[\dXYMT]+:\d+(-\d+)?$/.test(value)) {
              return true;
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to parse CSV for bioinformatics detection', e);
  }

  // Fallback to simple text pattern matching if parsing fails
  const dataLower = data.toLowerCase().substring(0, 5000); // Limit check to first 5000 chars
  return bioHeaders.some((term) => dataLower.includes(term.toLowerCase()));
}

/**
 * Detects if a description is requesting bioinformatics-specific operations
 *
 * @param description The user's description or query to analyze
 * @returns boolean indicating if the description is related to bioinformatics
 */
export function detectBioformaticsDescription(description: string): boolean {
  if (!description) return false;

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
    'go term',
    'kegg',
    'bioinformatics',
    'sequencing',
    'rna-seq',
    'dna-seq',
    'ngs',
    'single-cell',
    'scRNA',
    'genome',
    'proteome',
    'transcriptome',
    'heatmap',
    'volcano plot',
    'enrichment',
    'annotation',
    'alignment',
  ];

  const descLower = description.toLowerCase();
  return bioKeywords.some((keyword) =>
    descLower.includes(keyword.toLowerCase()),
  );
}

/**
 * Extracts useful bioinformatics metadata from CSV content
 *
 * @param data CSV content to analyze
 * @returns Object with metadata about the bioinformatics data
 */

interface BioMetadata {
  dataType:
    | 'general'
    | 'gene_expression'
    | 'variant_data'
    | 'pathway_data'
    | 'sequence_data';
  sampleCount?: number;
  featureCount?: number;
  significantFeatures?: string[];
  pathways?: string[];
}

export function extractBioMetadata(data: string): BioMetadata {
  const metadata: BioMetadata = {
    dataType: 'general',
  };

  try {
    const parsed = parse<CSVRow>(data, { header: true });
    if (
      !parsed.meta ||
      !parsed.meta.fields ||
      !parsed.data ||
      parsed.data.length === 0
    ) {
      return metadata;
    }

    const fields = parsed.meta.fields;
    const sampleSize = parsed.data.length;

    // Detect data type
    const fieldsLower = fields.map((f) => f.toLowerCase());

    if (
      fieldsLower.some((f) =>
        /^(log2fc|log2_fold_change|fold_change|foldchange)$/.test(f),
      ) &&
      fieldsLower.some((f) => /^(pvalue|p_value|padj|fdr|adj\.p)$/.test(f))
    ) {
      metadata.dataType = 'gene_expression';
    } else if (
      fieldsLower.some((f) => /^(chrom|chr|chromosome)$/.test(f)) &&
      fieldsLower.some((f) => /^(pos|position|start)$/.test(f)) &&
      fieldsLower.some((f) => /^(ref|reference)$/.test(f)) &&
      fieldsLower.some((f) => /^(alt|alternate|variant)$/.test(f))
    ) {
      metadata.dataType = 'variant_data';
    } else if (
      fieldsLower.some((f) => /^(pathway|term|function|process)$/.test(f)) &&
      fieldsLower.some((f) =>
        /^(pvalue|p_value|padj|fdr|adj\.p|enrichment)$/.test(f),
      )
    ) {
      metadata.dataType = 'pathway_data';
    } else if (
      fieldsLower.some((f) =>
        /^(sequence|seq|dna|rna|protein|peptide)$/.test(f),
      )
    ) {
      metadata.dataType = 'sequence_data';
    }

    // Add sample and feature counts
    metadata.sampleCount = sampleSize;
    metadata.featureCount = fields.length;

    // For gene expression data, extract significant features if available
    if (metadata.dataType === 'gene_expression') {
      const pValueField = fields.find((f) =>
        /^(pvalue|p_value|padj|fdr|adj\.p)$/i.test(f.toLowerCase()),
      );

      const geneIdField = fields.find((f) =>
        /^(gene|gene_id|gene_name|symbol|gene_symbol)$/i.test(f.toLowerCase()),
      );

      if (pValueField && geneIdField) {
        const significantGenes = parsed.data
          .filter((row) => {
            const pValue = Number.parseFloat(String(row[pValueField]));
            return !Number.isNaN(pValue) && pValue < 0.05;
          })
          .map((row) => String(row[geneIdField]))
          .slice(0, 20); // Limit to first 20

        if (significantGenes.length > 0) {
          metadata.significantFeatures = significantGenes;
        }
      }
    }

    // For pathway data, extract pathway names
    if (metadata.dataType === 'pathway_data') {
      const pathwayField = fields.find((f) =>
        /^(pathway|term|function|process)$/i.test(f.toLowerCase()),
      );

      if (pathwayField) {
        const pathways = parsed.data
          .map((row) => String(row[pathwayField]))
          .filter((value, index, self) => self.indexOf(value) === index) // Unique values
          .slice(0, 20); // Limit to first 20

        if (pathways.length > 0) {
          metadata.pathways = pathways;
        }
      }
    }

    return metadata;
  } catch (e) {
    console.error('Failed to extract bioinformatics metadata', e);
    return metadata;
  }
}

/**
 * Utility to highlight genes in a dataset based on a pathway
 *
 * @param data CSV content to process
 * @param pathway Name of the pathway to highlight genes for
 * @returns Modified CSV with highlighted genes (additional column)
 */
export async function highlightPathwayGenes(
  data: string,
  pathway: string,
): Promise<string> {
  try {
    // In a real implementation, this would call an API to get genes in the pathway
    // For this implementation, we'll simulate by adding a column
    const parsed = parse<CSVRow>(data, { header: true });
    if (!parsed.data || !parsed.meta || !parsed.meta.fields) {
      return data;
    }

    // Find gene identifier column
    const geneIdField = parsed.meta.fields.find((f) =>
      /^(gene|gene_id|gene_name|symbol|gene_symbol)$/i.test(f.toLowerCase()),
    );

    if (!geneIdField) {
      return data;
    }

    // Add a new column for pathway membership
    const newData = parsed.data.map((row) => {
      // In a real implementation, this would check against an actual pathway database
      // Here we're just simulating by randomly marking ~10% of genes as in the pathway
      const inPathway = Math.random() < 0.1 ? 'Yes' : 'No';
      return {
        ...row,
        [`in_${pathway}_pathway`]: inPathway,
      };
    });

    // Convert back to CSV
    return unparse(newData);
  } catch (e) {
    console.error(`Error highlighting pathway ${pathway}:`, e);
    return data;
  }
}

/**
 * Filter bioinformatics data based on statistical significance
 *
 * @param data CSV content to filter
 * @param pValueThreshold P-value threshold for filtering (default: 0.05)
 * @param fcThreshold Optional fold change threshold
 * @returns Filtered CSV content
 */
export function filterSignificantResults(
  data: string,
  pValueThreshold = 0.05,
  fcThreshold?: number,
): string {
  try {
    const parsed = parse<CSVRow>(data, { header: true });
    if (!parsed.data || !parsed.meta || !parsed.meta.fields) {
      return data;
    }

    // Find p-value and fold change columns
    const pValueField = parsed.meta.fields.find((f) =>
      /^(pvalue|p_value|padj|fdr|adj\.p)$/i.test(f.toLowerCase()),
    );

    const fcField = fcThreshold
      ? parsed.meta.fields.find((f) =>
          /^(log2fc|log2_fold_change|fold_change|foldchange)$/i.test(
            f.toLowerCase(),
          ),
        )
      : null;

    if (!pValueField) {
      return data;
    }

    // Filter the data
    const newData = parsed.data.filter((row) => {
      const pValue = Number.parseFloat(String(row[pValueField]));

      if (Number.isNaN(pValue)) {
        return false;
      }

      if (fcField && fcThreshold) {
        const fc = Number.parseFloat(String(row[fcField]));
        return (
          !Number.isNaN(fc) &&
          pValue < pValueThreshold &&
          Math.abs(fc) > fcThreshold
        );
      }

      return pValue < pValueThreshold;
    });

    // Convert back to CSV
    return unparse(newData);
  } catch (e) {
    console.error('Error filtering significant results:', e);
    return data;
  }
}
