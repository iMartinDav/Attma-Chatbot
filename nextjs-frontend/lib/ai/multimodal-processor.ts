/**
 * Multi-Modal File Processing - PDFs, images, and bio file types
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

export interface ProcessedFile {
  type: 'image' | 'pdf' | 'data' | 'code' | 'unknown';
  originalName: string;
  size: number;
  mimeType: string;
  content?: string;           // For text-based files
  base64?: string;            // For binary files
  extractedText?: string;     // For PDFs (extracted)
  description?: string;       // AI-generated description
  metadata?: Record<string, unknown>;
}

export interface ImageAnalysis {
  description: string;
  type: 'figure' | 'chart' | 'diagram' | 'microscopy' | 'gel' | 'other';
  extractedData?: {
    labels?: string[];
    values?: number[];
    geneSymbols?: string[];
  };
}

/** Detect file type from MIME type or extension */
export function detectFileType(
  mimeType: string,
  filename: string
): ProcessedFile['type'] {
  // Images
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  
  // PDFs
  if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) {
    return 'pdf';
  }
  
  // Data files (bioinformatics)
  const dataExtensions = [
    '.csv', '.tsv', '.xlsx', '.xls',
    '.fastq', '.fasta', '.fa', '.fq',
    '.vcf', '.bed', '.gff', '.gtf', '.bam', '.sam',
    '.h5ad', '.loom', '.mtx',
  ];
  if (dataExtensions.some(ext => filename.toLowerCase().endsWith(ext))) {
    return 'data';
  }
  
  // Code files
  const codeExtensions = ['.py', '.r', '.R', '.ipynb', '.sh', '.bash'];
  if (codeExtensions.some(ext => filename.endsWith(ext))) {
    return 'code';
  }
  
  return 'unknown';
}

// ============================================================================
// Image Analysis
// ============================================================================

/**
 * Analyze an image using GPT-4 Vision to extract scientific content
 * 
 * @example
 * ```typescript
 * const analysis = await analyzeImage(base64Data, 'figure1.png');
 * console.log(analysis.description);
 * console.log(analysis.extractedData?.geneSymbols);
 * ```
 */
export async function analyzeImage(
  base64Data: string,
  filename: string,
  context?: string
): Promise<ImageAnalysis> {
  const openai = createOpenAI({});
  
  try {
    const result = await generateText({
      model: openai.chat('gpt-4o'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a bioinformatics expert analyzing a scientific image.
${context ? `Context: ${context}` : ''}

Analyze this image and provide:
1. A detailed description of what it shows
2. The type of visualization (figure, chart, diagram, microscopy, gel, other)
3. Any gene symbols, labels, or values you can extract

Respond in JSON format:
{
  "description": "detailed description",
  "type": "figure|chart|diagram|microscopy|gel|other",
  "extractedData": {
    "labels": ["label1", "label2"],
    "values": [1.5, 2.3],
    "geneSymbols": ["TP53", "BRCA1"]
  }
}`,
            },
            {
              type: 'image',
              image: base64Data,
            },
          ],
        },
      ],
    });

    // Parse the JSON response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ImageAnalysis;
    }
    
    return {
      description: result.text,
      type: 'other',
    };
  } catch (error) {
    console.error('Image analysis failed:', error);
    return {
      description: `Image: ${filename}`,
      type: 'other',
    };
  }
}

// ============================================================================
// PDF Processing
// ============================================================================

/**
 * Extract text from a PDF for context injection
 * Uses a simple approach - for production, consider pdf-parse or similar
 */
export async function extractPdfText(
  base64Data: string,
  maxChars: number = 10000
): Promise<string> {
  // For now, use the vision model to "read" the PDF pages
  // In production, use pdf-parse or pdfjs-dist for text extraction
  const openai = createOpenAI({});
  
  try {
    const result = await generateText({
      model: openai.chat('gpt-4o'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract and transcribe all text from this PDF document. 
Focus on:
- Title and authors
- Abstract
- Key findings and methods
- Gene names, pathways, and statistical results
- Figure legends

Provide a clean, structured transcription.`,
            },
            {
              type: 'file',
              data: base64Data,
              mimeType: 'application/pdf',
            } as any, // Cast to any to bypass type check if needed, or use correct type
          ],
        },
      ],
    });

    // Truncate if needed
    if (result.text.length > maxChars) {
      return result.text.slice(0, maxChars) + '\n\n[... content truncated ...]';
    }
    
    return result.text;
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    return '[PDF text extraction failed]';
  }
}

/**
 * Analyze a scientific PDF and extract structured information
 */
export async function analyzePdf(base64Data: string): Promise<{
  title?: string;
  authors?: string[];
  abstract?: string;
  keyFindings: string[];
  genesmentioned: string[];
  methods?: string;
}> {
  const openai = createOpenAI({});
  
  try {
    const result = await generateText({
      model: openai.chat('gpt-4o'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this scientific paper and extract:
1. Title
2. Authors (list)
3. Abstract
4. Key findings (bullet points)
5. Genes/proteins mentioned
6. Main methods used

Respond in JSON format.`,
            },
            {
              type: 'file',
              data: base64Data,
              mimeType: 'application/pdf',
            } as any,
          ],
        },
      ],
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { keyFindings: [], genesmentioned: [] };
  } catch (error) {
    console.error('PDF analysis failed:', error);
    return { keyFindings: [], genesmentioned: [] };
  }
}

// ============================================================================
// Bioinformatics Data File Processing
// ============================================================================

/**
 * Detect bioinformatics data type from file content
 */
export function detectBioDataType(content: string, filename: string): {
  type: 'expression_matrix' | 'vcf' | 'fasta' | 'bed' | 'generic_tabular' | 'unknown';
  details?: string;
} {
  const lowerFilename = filename.toLowerCase();
  const firstLines = content.split('\n').slice(0, 10).join('\n');
  
  // VCF files
  if (lowerFilename.endsWith('.vcf') || firstLines.includes('##fileformat=VCF')) {
    return { type: 'vcf', details: 'Variant Call Format' };
  }
  
  // FASTA/FASTQ
  if (lowerFilename.match(/\.(fa|fasta|fq|fastq)$/)) {
    return { 
      type: 'fasta', 
      details: firstLines.startsWith('@') ? 'FASTQ reads' : 'FASTA sequences' 
    };
  }
  
  // BED files
  if (lowerFilename.endsWith('.bed')) {
    return { type: 'bed', details: 'Genomic regions' };
  }
  
  // Expression matrix (CSV/TSV with gene names)
  if (lowerFilename.match(/\.(csv|tsv|txt)$/)) {
    const hasGenePattern = /\b(ENSG|ENST|gene_id|Gene|Symbol)\b/i.test(firstLines);
    const hasNumbers = /\d+\.\d+/.test(firstLines);
    if (hasGenePattern && hasNumbers) {
      return { type: 'expression_matrix', details: 'Expression matrix' };
    }
  }
  
  // Generic tabular
  if (firstLines.includes('\t') || firstLines.includes(',')) {
    return { type: 'generic_tabular', details: 'Tabular data' };
  }
  
  return { type: 'unknown' };
}

// ============================================================================
// Message Preparation with Files
// ============================================================================

/**
 * Prepare a message with file attachments for the AI SDK
 * Following best practices from https://ai-sdk.dev/docs/guides/multi-modal
 */
export async function prepareMessageWithFiles(
  text: string,
  files: Array<{
    base64: string;
    mimeType: string;
    filename: string;
  }>
): Promise<Array<{ type: string; [key: string]: unknown }>> {
  const parts: Array<{ type: string; [key: string]: unknown }> = [];
  
  // Add text first
  if (text) {
    parts.push({ type: 'text', text });
  }
  
  // Process each file
  for (const file of files) {
    const fileType = detectFileType(file.mimeType, file.filename);
    
    if (fileType === 'image') {
      // Images go directly to the vision model
      parts.push({
        type: 'image',
        image: file.base64,
      });
    } else if (fileType === 'pdf') {
      // PDFs can be sent as files to GPT-4o
      parts.push({
        type: 'file',
        data: file.base64,
        mimeType: 'application/pdf',
      });
    } else if (fileType === 'data' || fileType === 'code') {
      // Text-based files: decode and include as text
      try {
        const decoded = atob(file.base64);
        const preview = decoded.slice(0, 2000);
        parts.push({
          type: 'text',
          text: `\n---\nFile: ${file.filename}\n\`\`\`\n${preview}${decoded.length > 2000 ? '\n... (truncated)' : ''}\n\`\`\`\n---\n`,
        });
      } catch {
        parts.push({
          type: 'text',
          text: `\n[File: ${file.filename} - could not decode]\n`,
        });
      }
    }
  }
  
  return parts;
}

// ============================================================================
// Export
// ============================================================================

export const multiModalProcessor = {
  detectFileType,
  analyzeImage,
  extractPdfText,
  analyzePdf,
  detectBioDataType,
  prepareMessageWithFiles,
};
