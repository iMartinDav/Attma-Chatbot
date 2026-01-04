/**
 * Self-Verifying Agent Pattern
 * Generate → Critique → Fix → Validate for high-accuracy responses.
 */

import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

import type { ValidationResult, VerificationStep } from './types';

const CritiqueSchema = z.object({
  overallQuality: z.number().min(1).max(10).describe('Overall quality score 1-10'),
  accuracy: z.number().min(1).max(10).describe('Factual accuracy score'),
  completeness: z.number().min(1).max(10).describe('Completeness of answer'),
  issues: z.array(z.object({
    type: z.enum(['factual_error', 'incomplete', 'unclear', 'missing_citation', 'outdated']),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    suggestedFix: z.string().optional(),
  })),
  claimsToVerify: z.array(z.object({
    claim: z.string(),
    geneSymbol: z.string().optional(),
    paperReference: z.string().optional(),
    verificationPriority: z.enum(['low', 'medium', 'high']),
  })),
  needsRevision: z.boolean(),
});

type Critique = z.infer<typeof CritiqueSchema>;

/** Validate a gene claim against MyGene.info */
async function validateGeneClaim(
  geneSymbol: string,
  claim: string
): Promise<ValidationResult> {
  try {
    const url = `https://mygene.info/v3/query?q=symbol:${geneSymbol}&species=9606&fields=symbol,name,summary,go,pathway`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.hits || data.hits.length === 0) {
      return {
        claim,
        isValid: false,
        confidence: 0,
        evidence: `Gene "${geneSymbol}" not found in database`,
      };
    }

    const gene = data.hits[0];
    const summary = gene.summary?.toLowerCase() || '';
    const claimLower = claim.toLowerCase();

    // Simple keyword matching for validation
    const keywords = claimLower.split(/\s+/).filter(w => w.length > 3);
    const matchCount = keywords.filter(k => summary.includes(k)).length;
    const matchRatio = matchCount / keywords.length;

    return {
      claim,
      isValid: matchRatio > 0.3,
      confidence: matchRatio,
      evidence: gene.summary,
      source: {
        type: 'database',
        title: `MyGene.info - ${geneSymbol}`,
        url: `https://www.ncbi.nlm.nih.gov/gene/${gene.entrezgene}`,
      },
    };
  } catch {
    return {
      claim,
      isValid: false,
      confidence: 0,
      evidence: 'Validation failed due to API error',
    };
  }
}

/** Validate a claim against PubMed */
async function validatePaperClaim(
  claim: string,
  searchTerms: string
): Promise<ValidationResult> {
  try {
    const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    const searchUrl = `${baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerms)}&retmax=3&retmode=json`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    const ids = data.esearchresult?.idlist || [];

    if (ids.length === 0) {
      return {
        claim,
        isValid: false,
        confidence: 0.3,
        evidence: 'No supporting papers found in PubMed',
      };
    }

    // Found papers - get titles
    const summaryUrl = `${baseUrl}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
    const summaryResponse = await fetch(summaryUrl);
    const summaryData = await summaryResponse.json();

    const papers = ids.map((id: string) => ({
      pmid: id,
      title: summaryData.result?.[id]?.title || 'Unknown',
    }));

    return {
      claim,
      isValid: true,
      confidence: 0.7,
      evidence: `Found ${papers.length} supporting papers: ${papers.map((p: { title: string }) => p.title).join('; ')}`,
      source: {
        type: 'paper',
        title: papers[0]?.title,
        pmid: ids[0],
        url: `https://pubmed.ncbi.nlm.nih.gov/${ids[0]}/`,
      },
    };
  } catch {
    return {
      claim,
      isValid: false,
      confidence: 0,
      evidence: 'Validation failed due to API error',
    };
  }
}

/** Run the full self-verification pipeline */
export async function verifySelfAnswer(
  options: VerificationOptions
): Promise<VerificationResult> {
  const { 
    query, 
    initialAnswer, 
    enableValidation = true,
    maxRevisions = 2 
  } = options;

  const steps: VerificationStep[] = [];
  const validations: ValidationResult[] = [];

  // Step 1: Generate initial answer (already provided)
  steps.push({
    type: 'generate',
    input: query,
    output: initialAnswer,
    confidence: 0.7,
  });

  // Step 2: Critique the answer
  const critique = await critiqueAnswer(query, initialAnswer);
  steps.push({
    type: 'critique',
    input: initialAnswer,
    output: JSON.stringify(critique),
    confidence: critique.accuracy / 10,
    issues: critique.issues.map(i => i.description),
  });

  // Step 3: Validate claims if enabled
  if (enableValidation && critique.claimsToVerify.length > 0) {
    for (const claim of critique.claimsToVerify.slice(0, 3)) {
      let result: ValidationResult;
      
      if (claim.geneSymbol) {
        result = await validateGeneClaim(claim.geneSymbol, claim.claim);
      } else {
        result = await validatePaperClaim(claim.claim, claim.claim);
      }
      
      validations.push(result);
    }

    steps.push({
      type: 'validate',
      input: critique.claimsToVerify.map(c => c.claim).join('; '),
      output: validations.map(v => `${v.claim}: ${v.isValid ? '✓' : '✗'}`).join('\n'),
      confidence: validations.reduce((acc, v) => acc + v.confidence, 0) / validations.length,
    });
  }

  // Step 4: Fix if needed
  let finalAnswer = initialAnswer;
  let wasRevised = false;

  if (critique.needsRevision || validations.some(v => !v.isValid)) {
    const fixedAnswer = await fixAnswer(query, initialAnswer, critique, validations);
    finalAnswer = fixedAnswer;
    wasRevised = true;

    steps.push({
      type: 'fix',
      input: `Issues: ${critique.issues.map(i => i.description).join('; ')}`,
      output: fixedAnswer,
      confidence: 0.85,
    });
  }

  // Calculate overall confidence
  const confidence = calculateConfidence(critique, validations, wasRevised);

  return {
    finalAnswer,
    steps,
    wasRevised,
    confidence,
    validations,
  };
}

export interface VerificationOptions {
  query: string;
  initialAnswer: string;
  enableValidation?: boolean;
  maxRevisions?: number;
}

export interface VerificationResult {
  finalAnswer: string;
  steps: VerificationStep[];
  wasRevised: boolean;
  confidence: number;
  validations: ValidationResult[];
}

/** Generate a critique of an answer */
async function critiqueAnswer(query: string, answer: string): Promise<Critique> {
  const result = await generateObject({
    model: openai.chat('gpt-4o'),
    schema: CritiqueSchema,
    prompt: `You are a senior bioinformatics expert reviewing an AI-generated answer.

QUESTION: ${query}

ANSWER TO REVIEW:
${answer}

Evaluate this answer for:
1. Factual accuracy - Are all statements correct?
2. Completeness - Does it fully answer the question?
3. Citations - Are claims properly supported?
4. Clarity - Is it clearly explained?

Identify specific claims that should be verified against databases.`,
  });

  return result.object;
}

/** Fix an answer based on critique and validation results */
async function fixAnswer(
  query: string,
  originalAnswer: string,
  critique: Critique,
  validations: ValidationResult[]
): Promise<string> {
  const invalidClaims = validations.filter(v => !v.isValid);
  const validClaims = validations.filter(v => v.isValid);

  const result = await generateText({
    model: openai.chat('gpt-4o'),
    prompt: `You are a senior bioinformatics expert. Fix the following answer based on the feedback.

ORIGINAL QUESTION: ${query}

ORIGINAL ANSWER:
${originalAnswer}

ISSUES FOUND:
${critique.issues.map(i => `- [${i.severity}] ${i.description}`).join('\n')}

INVALID CLAIMS (must be corrected or removed):
${invalidClaims.map(v => `- "${v.claim}" - ${v.evidence}`).join('\n') || 'None'}

VALIDATED CLAIMS (can be kept):
${validClaims.map(v => `- "${v.claim}" - Confirmed: ${v.evidence?.slice(0, 100)}...`).join('\n') || 'None'}

Provide a corrected answer that:
1. Fixes all identified issues
2. Removes or corrects invalid claims
3. Adds citations where available
4. Maintains scientific accuracy`,
  });

  return result.text;
}

/** Calculate overall confidence score */
function calculateConfidence(
  critique: Critique,
  validations: ValidationResult[],
  wasRevised: boolean
): number {
  let score = critique.accuracy / 10;

  // Factor in validations
  if (validations.length > 0) {
    const validRatio = validations.filter(v => v.isValid).length / validations.length;
    score = score * 0.6 + validRatio * 0.4;
  }

  // Boost if revised
  if (wasRevised) {
    score = Math.min(0.95, score * 1.1);
  }

  return Math.round(score * 100) / 100;
}
