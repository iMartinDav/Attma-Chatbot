'use client';

/**
 * The new-chat screen: a quiet double helix behind the greeting, and starter
 * workflows that say what will run (which Muse model, which data source), so
 * the first click already shows how Attma works.
 */

import { DEMO_CASES, demoPrompt } from '@/lib/rare-disease/demo-cases';
import { cn } from '@/lib/utils';
import {
  BoxesIcon,
  DnaIcon,
  type LucideIcon,
  MicroscopeIcon,
  UploadIcon,
} from 'lucide-react';
import { motion } from 'motion/react';

// Two full turns fill the view; a third is drawn off-screen so sliding the
// helix left by one turn (the attma-helix animation) loops without a seam.
const WIDTH = 640;
const HEIGHT = 120;
const TURN = WIDTH / 2;
const AMPLITUDE = 34;
const RUNGS_PER_TURN = 11;

// Rounded so the server and the browser render identical markup: their
// Math.sin can differ in the last digits, which breaks hydration.
const round = (n: number) => Math.round(n * 100) / 100;

const yAt = (x: number, phase: number) =>
  round(HEIGHT / 2 + AMPLITUDE * Math.sin((x / TURN) * Math.PI * 2 + phase));

/** A double helix drawn as two phase-shifted sine strands with base pairs. */
function Helix({ className }: { className?: string }) {
  const drawn = WIDTH + TURN;
  const strand = (phase: number) =>
    Array.from({ length: 121 }, (_, i) => {
      const x = (i / 120) * drawn;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${yAt(x, phase).toFixed(1)}`;
    }).join(' ');
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={cn('pointer-events-none overflow-hidden', className)}
      aria-hidden
    >
      <g className="attma-helix">
        {Array.from({ length: RUNGS_PER_TURN * 3 }, (_, i) => {
          const x = round(((i + 0.5) / RUNGS_PER_TURN) * TURN);
          const t = (x / TURN) * Math.PI * 2;
          const y1 = yAt(x, 0);
          const y2 = yAt(x, Math.PI);
          return (
            <line
              key={x}
              x1={x}
              x2={x}
              y1={y1}
              y2={y2}
              stroke="currentColor"
              strokeOpacity={round(0.18 + 0.22 * Math.abs(Math.cos(t)))}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
        <path
          d={strand(0)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.6}
          strokeWidth={2.5}
        />
        <path
          d={strand(Math.PI)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeWidth={2.5}
        />
      </g>
    </svg>
  );
}

export function Greeting({ name }: { name: string }) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <div className="relative mb-8 flex flex-col items-center text-center">
      <Helix className="absolute -top-6 w-[min(640px,92vw)] text-primary-ink opacity-60 [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]" />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative pt-16"
      >
        {/* The hour comes from the server on first render and the browser after. */}
        <h1
          suppressHydrationWarning
          className="text-3xl font-light tracking-tight text-foreground md:text-4xl"
        >
          {greeting}, <span className="font-normal">{name}</span>
        </h1>
        <p className="mt-3 max-w-md text-[15px] text-muted-foreground">
          Describe an analysis or attach your data. Attma plans the workflow,
          runs every step, and cites what it finds.
        </p>
      </motion.div>
    </div>
  );
}

interface Workflow {
  title: string;
  description: string;
  icon: LucideIcon;
  runs: string[];
  prompt?: string;
}

const WORKFLOWS: Workflow[] = [
  {
    title: 'Single-cell atlas',
    description: 'Cluster and annotate PBMC 3k, then enrich B cell markers',
    icon: MicroscopeIcon,
    runs: ['Muse Wonder', 'Python · scanpy', 'g:Profiler'],
    prompt:
      'Load the public PBMC 3k single-cell dataset, run QC, normalization, clustering and UMAP, find marker genes per cluster, annotate cell types from canonical markers, and run pathway enrichment on the B cell markers.',
  },
  {
    title: 'Undiagnosed patient',
    description: DEMO_CASES[0].title,
    icon: DnaIcon,
    runs: ['Muse Wonder', 'HPO · 12,900 diseases', 'VEP', 'Muse Spark'],
    prompt: demoPrompt(DEMO_CASES[0]),
  },
  {
    title: 'Variants, no findings yet',
    description: 'Asks for phenotypes before ranking anything',
    icon: DnaIcon,
    runs: ['Muse Wonder', 'Attma checks'],
    prompt: `Exome candidate variants for a patient, no clinical findings are available yet: ${DEMO_CASES[0].variants.slice(0, 3).join(', ')}. Which variant explains the case?`,
  },
  {
    title: 'Variant to structure',
    description: 'SCN1A p.Arg1648His: frequency, ClinVar, domain, literature',
    icon: BoxesIcon,
    runs: ['VEP · AlphaMissense', 'UniProt · AlphaFold', 'PubMed'],
    prompt:
      'Annotate the SCN1A variant ENSP00000501589.1:p.Arg1648His: population frequency, ClinVar, AlphaMissense and CADD, which protein domain it falls in and how confident the AlphaFold structure is there, and what the literature says about it.',
  },
  {
    title: 'Analyze your data',
    description: 'VCF, counts matrix, .h5ad, CSV or a PDF report',
    icon: UploadIcon,
    runs: ['Python sandbox', 'Muse Spark vision'],
  },
];

export function WorkflowCards({
  onSelect,
  onUpload,
}: {
  onSelect: (prompt: string) => void;
  onUpload: () => void;
}) {
  return (
    <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 px-4 sm:grid-cols-2">
      {WORKFLOWS.map((workflow, index) => {
        const Icon = workflow.icon;
        return (
          <motion.button
            key={workflow.title}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * index + 0.15 }}
            onClick={() =>
              workflow.prompt ? onSelect(workflow.prompt) : onUpload()
            }
            className="group flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/40 p-3.5 text-left transition-colors hover:border-primary/40 hover:bg-card"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Icon className="size-4 text-primary-ink" />
              {workflow.title}
            </span>
            <span className="text-[13px] leading-snug text-muted-foreground">
              {workflow.description}
            </span>
            <span className="flex flex-wrap gap-1">
              {workflow.runs.map((run) => (
                <span
                  key={run}
                  className={cn(
                    'rounded-full border px-1.5 py-px text-[10px]',
                    run.startsWith('Muse')
                      ? 'border-primary/30 bg-primary/10 text-primary-ink'
                      : 'text-muted-foreground',
                  )}
                >
                  {run}
                </span>
              ))}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
