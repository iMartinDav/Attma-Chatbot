import type { ClaimsCheckFindingInput } from './session';

// The meaning lines tell the claims judge what a tool's output establishes by construction, so restating that meaning is not treated as a new claim.
export const TOOL_MEANINGS: Record<string, string> = {
  rankDiagnoses:
    "diseases ranked by HPO similarity to the patient's phenotypes, plus variants ranked by combined phenotype and variant evidence",
  prioritizeVariants: 'variants ranked by VEP evidence without phenotypes',
  proteinStructure: 'UniProt features at the residue',
  reviewLiterature:
    "a sub-agent's grading of PubMed abstracts for the gene and disease",
  lookupGene: 'gene facts',
  predictVariantEffect: 'AlphaGenome predictions',
};

export function toolMeaningFor(toolName: string): string {
  // Unknown tools still carry their captured output, so the judge gets a neutral meaning instead of nothing.
  return TOOL_MEANINGS[toolName] ?? 'captured tool output';
}

export const CLAIMS_CHECK_INSTRUCTIONS =
  "You check whether cited facts support a finding. Judge only from the facts and tool meanings given for that finding. Do not use outside knowledge, and do not re-check arithmetic. A finding is unsupported only if it asserts something the cited facts contradict, or a specific new fact (a number, gene, variant, phenotype or citation) that no cited fact or tool meaning provides. Restating what a tool's output means is supported: for example, the top result of rankDiagnoses is phenotype-match evidence because that tool ranks diseases by HPO similarity to the patient's phenotypes. Return short reasons.";

export function buildClaimsCheckPrompt(
  findings: ClaimsCheckFindingInput[],
): string {
  return findings
    .map(
      (finding) =>
        `Finding ${finding.itemId}\nQuestion: ${finding.question}\nText: ${finding.text}\nFacts:\n${finding.facts
          .map(
            (fact) =>
              `- ${fact.path} = ${String(fact.value)} (from ${fact.toolName}: ${fact.toolMeaning})`,
          )
          .join('\n')}`,
    )
    .join('\n\n');
}
