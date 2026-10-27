/**
 * Attma: one orchestrating agent (Muse Wonder) that turns a researcher's
 * question into a reproducible workflow. It plans, runs each step with the
 * tools of the connectors the user enabled (knowledge bases, a Python
 * workspace, AlphaGenome, Muse Spark sub-agents), checks the results, and
 * reports what the data show with the source behind each claim.
 */

import 'server-only';

import { CONNECTORS, type ConnectorId } from '@/lib/ai/connectors/catalog';
import { myProvider, webSearchTool } from '@/lib/ai/providers';
import {
  predictVariantEffectTool,
  runPythonTool,
} from '@/lib/ai/tools/compute';
import { enrichGenesTool } from '@/lib/ai/tools/enrichment';
import { pathwayTools } from '@/lib/ai/tools/pathway-tools';
import { proteinStructureTool } from '@/lib/ai/tools/proteins';
import {
  readClinicalDocument,
  readDocument,
  reviewLiterature,
} from '@/lib/ai/tools/subagents';
import {
  prioritizeVariantsTool,
  rankDiagnosesTool,
} from '@/lib/ai/tools/rare-disease';
import {
  geneLookupTool,
  pubmedSearchTool,
} from '@/lib/ai/tools/research-tools';
import {
  generateText,
  isStepCount,
  jsonSchema,
  NoSuchToolError,
  Output,
  ToolLoopAgent,
  type ToolCallRepairFunction,
  type ToolSet,
} from 'ai';

interface ConnectorContext {
  chatId: string;
}

/** Each connector's tools, and the playbook line that tells the agent when to use them. */
const CONNECTOR_TOOLS: Record<
  ConnectorId,
  { tools: (ctx: ConnectorContext) => ToolSet; playbook: string }
> = {
  phenotypes: {
    tools: () => ({ rankDiagnoses: rankDiagnosesTool }),
    playbook:
      'Patient phenotype (+/- variants): rankDiagnoses once with HPO-coded findings the patient HAS and every candidate variant (it annotates them too).',
  },
  variants: {
    tools: () => ({ prioritizeVariants: prioritizeVariantsTool }),
    playbook:
      'Variant list without phenotypes: prioritizeVariants (VEP with gnomAD, ClinVar, AlphaMissense, CADD). For a VCF, filter it in Python first, then annotate the shortlist.',
  },
  proteins: {
    tools: () => ({ proteinStructure: proteinStructureTool }),
    playbook:
      'Missense variant in a leading gene: proteinStructure with the residue number, to see the domain or functional region it hits.',
  },
  literature: {
    tools: () => ({
      reviewLiterature,
      searchPubMed: pubmedSearchTool,
    }),
    playbook:
      'Evidence for a gene-disease link: reviewLiterature (a sub-agent grades the abstracts); searchPubMed for general literature questions.',
  },
  pathways: {
    tools: () => ({
      lookupGene: geneLookupTool,
      enrichGenes: enrichGenesTool,
      searchReactome: pathwayTools.reactome_pathway_search,
      searchKEGG: pathwayTools.kegg_pathway_search,
      stringInteractions: pathwayTools.string_interactions,
    }),
    playbook:
      'Gene list (e.g. markers or DE genes): enrichGenes (GO, Reactome, KEGG, WikiPathways in one call), stringInteractions for networks; lookupGene for a single gene.',
  },
  web: {
    tools: () => ({ web_search: webSearchTool() }),
    playbook:
      'Recent tools, protocols, datasets or anything after your training: web_search, one or two focused searches, and cite the pages. Prefer the dedicated databases and Python for anything they cover.',
  },
  python: {
    tools: ({ chatId }) => ({ runPython: runPythonTool(chatId) }),
    playbook:
      'Data files (VCF, CSV/TSV, counts matrices, .h5ad, FASTA) or any statistic, plot or transformation: runPython, one focused step at a time. Single-cell: QC and filtering, normalization, HVGs, PCA, neighbors, Leiden, UMAP, marker genes, then cell type annotation from canonical markers; bulk RNA-seq: PyDESeq2 then enrichment.',
  },
  documents: {
    tools: () => ({ readClinicalDocument, readDocument }),
    playbook:
      'Attached PDFs or images: readClinicalDocument for clinical reports and letters (structured case), readDocument for papers, figures and tables. Read several in parallel.',
  },
  alphagenome: {
    tools: ({ chatId }) => ({
      predictVariantEffect: predictVariantEffectTool(chatId),
    }),
    playbook:
      'Non-coding, splice-region or synonymous variant: predictVariantEffect (AlphaGenome) for expression, chromatin and splicing effects.',
  },
};

export function availableConnectors(): ConnectorId[] {
  return CONNECTORS.filter((c) => !c.requires || process.env[c.requires]).map(
    (c) => c.id,
  );
}

function instructions(enabled: ConnectorId[], artifacts: boolean) {
  const playbooks = enabled.map((id) => `- ${CONNECTOR_TOOLS[id].playbook}`);
  return `You are Attma, the bioinformatics agent of attma.bio. You run on Meta's Muse models, but your name is Attma: when asked who you are, say you are Attma and, in a sentence, what you can do with the sources enabled here.

You turn a researcher's question into a reproducible analysis. You plan it, run each step with your tools, check what comes back, and report what the data show, with the source of every claim.

How you work:
- For anything that takes more than one step, say the plan in one or two short lines first, then carry it out without waiting for approval. Ask a question only when an input is missing and cannot be inferred.
- Compute instead of recalling. If an identifier, frequency, score, ranking, p-value or citation can come from a tool or from code, get it there. Never invent identifiers, numbers or PMIDs.
- Run independent steps in parallel.
- Check each result for plausibility (sample sizes, units, genome build GRCh38, multiple-testing correction). If a step fails, read the error, fix it and retry once; otherwise say what failed.
- Tool results are shown to the user as cards, figures and tables, so do not repeat them. Interpret them.
- Finish with: what you did (the workflow, one line per step), the key findings with sources, the main caveats, and 2-4 next steps. Stay under 250 words unless asked for more. Answer in the language the user writes in.

Playbooks for the sources enabled in this chat:
${playbooks.join('\n')}
${artifacts ? '- A protocol, report, script or figure the user wants to keep and edit: createDocument (kind text, code, sheet, or image for an illustration made with Muse Image).\n' : ''}
If a request needs a source that is not enabled, say which one in the Sources menu would help.

Scope: research use. With patient data you prioritize hypotheses and evidence for a qualified clinician or geneticist; you do not diagnose or give treatment advice.`;
}

export function createAttmaAgent({
  chatId,
  connectors,
  model = 'agent-model',
  extraTools = {},
}: {
  chatId: string;
  connectors: ConnectorId[];
  model?: string;
  /** Tools that need the request's stream, such as createDocument. */
  extraTools?: ToolSet;
}) {
  const available = new Set(availableConnectors());
  const enabled = connectors.filter((id) => available.has(id));
  const tools: ToolSet = { ...extraTools };
  for (const id of enabled) {
    Object.assign(tools, CONNECTOR_TOOLS[id].tools({ chatId }));
  }
  return new ToolLoopAgent({
    model: myProvider.languageModel(model),
    instructions: instructions(enabled, 'createDocument' in extraTools),
    tools,
    stopWhen: isStepCount(24),
    repairToolCall,
  });
}

/**
 * Muse sometimes streams one of several parallel tool calls with empty
 * arguments. Rather than fail the step, Muse Spark rebuilds that call's input
 * from the conversation and the tool's schema; the call then runs as intended.
 */
const repairToolCall: ToolCallRepairFunction<ToolSet> = async ({
  toolCall,
  messages,
  inputSchema,
  error,
}) => {
  if (NoSuchToolError.isInstance(error)) return null;
  const schema = await inputSchema({ toolName: toolCall.toolName });
  const { output } = await generateText({
    model: myProvider.languageModel('subagent-model'),
    instructions:
      'You repair a tool call whose arguments were lost or invalid. Return the arguments the assistant meant to send, using only what the conversation states.',
    messages: [
      ...messages,
      {
        role: 'user',
        content: `The assistant called the tool "${toolCall.toolName}" with invalid arguments ${toolCall.input || '(empty)'}: ${error.message}\nReturn the arguments for this one call.`,
      },
    ],
    output: Output.object({ schema: jsonSchema(schema) }),
  });
  console.warn(`Repaired ${toolCall.toolName} input`, toolCall.input);
  return { ...toolCall, input: JSON.stringify(output) };
};
