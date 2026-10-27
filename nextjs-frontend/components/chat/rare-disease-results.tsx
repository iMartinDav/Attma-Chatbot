'use client';

import type {
  DiagnosisRanking,
  RankedDisease,
  VariantCandidate,
  VariantPrioritization,
} from '@/lib/rare-disease/rank';
import { cn } from '@/lib/utils';
import { LoaderIcon } from '../icons';
import { StepError } from './agent-activity';
import { TextShimmer } from '../ui/text-shimmer';

type ToolState =
  'input-streaming' | 'input-available' | 'output-available' | 'output-error';

export const RARE_DISEASE_TOOLS = [
  'readClinicalDocument',
  'rankDiagnoses',
  'prioritizeVariants',
  'reviewLiterature',
] as const;
export type RareDiseaseToolName = (typeof RARE_DISEASE_TOOLS)[number];

interface RareDiseaseResultProps {
  toolName: RareDiseaseToolName;
  state: ToolState;
  input?: {
    phenotypes?: unknown[];
    variants?: unknown[];
    name?: string;
    gene?: string;
  };
  output?: unknown;
  errorText?: string;
}

export function RareDiseaseResult({
  toolName,
  state,
  input,
  output,
  errorText,
}: RareDiseaseResultProps) {
  if (state === 'output-error') {
    return <StepError label={TITLES[toolName]} errorText={errorText} />;
  }

  if (state !== 'output-available' || !output) {
    const phenotypes = input?.phenotypes?.length ?? 0;
    const variants = input?.variants?.length ?? 0;
    const annotating = `annotating ${variants} variants with VEP, gnomAD, ClinVar and AlphaMissense`;
    const messages: Record<RareDiseaseToolName, string> = {
      readClinicalDocument: `Muse Spark is reading ${input?.name ?? 'the document'}…`,
      rankDiagnoses: `Comparing ${phenotypes || 'the'} phenotypes with 12,900 rare diseases${variants ? ` and ${annotating}` : ''}…`,
      prioritizeVariants: `A${annotating.slice(1)}…`,
      reviewLiterature: `Muse Spark is reviewing PubMed case reports for ${input?.gene ?? 'the gene'}…`,
    };
    const message = messages[toolName];
    return (
      <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
        <div className="animate-spin text-primary-ink">
          <LoaderIcon size={14} />
        </div>
        <TextShimmer duration={3}>{message}</TextShimmer>
      </div>
    );
  }

  if (toolName === 'readClinicalDocument') {
    return <DocumentCard extraction={output as DocumentExtraction} />;
  }
  if (toolName === 'reviewLiterature') {
    return <LiteratureCard review={output as LiteratureReview} />;
  }
  if (toolName === 'rankDiagnoses') {
    const { variantRanking, ...ranking } = output as DiagnosisRanking & {
      variantRanking?: VariantPrioritization;
    };
    return (
      <div className="flex w-full flex-col gap-3">
        <DiagnosisCard ranking={ranking} />
        {variantRanking && <VariantCard result={variantRanking} />}
      </div>
    );
  }

  return (
    <VariantCard
      result={
        output as VariantPrioritization & { topDiseases?: RankedDisease[] }
      }
    />
  );
}

const TITLES: Record<RareDiseaseToolName, string> = {
  readClinicalDocument: 'Clinical document',
  reviewLiterature: 'Literature review',
  rankDiagnoses: 'Differential diagnosis',
  prioritizeVariants: 'Candidate variants',
};

function Card({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex w-full flex-col gap-3 rounded-xl border bg-card p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
      </header>
      {children}
    </section>
  );
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div
      className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`Score ${value.toFixed(2)}`}
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.max(4, Math.min(value, 1) * 100)}%` }}
      />
    </div>
  );
}

function GenePill({ symbol }: { symbol: string }) {
  return (
    <a
      href={`https://www.genenames.org/tools/search/#!/?query=${symbol}`}
      target="_blank"
      rel="noreferrer"
      className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs italic hover:bg-primary/10"
    >
      {symbol}
    </a>
  );
}

function DiagnosisCard({ ranking }: { ranking: DiagnosisRanking }) {
  const top = ranking.diseases[0]?.score || 1;
  return (
    <Card
      title="Differential diagnosis"
      meta={`HPO semantic similarity · ${ranking.phenotypes.length} terms · ${ranking.elapsedMs} ms`}
    >
      <ul className="flex flex-wrap gap-1.5" aria-label="HPO terms used">
        {ranking.phenotypes.map((p) => (
          <li key={p.id}>
            <a
              href={`https://hpo.jax.org/browse/term/${p.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
            >
              <span className="font-mono text-muted-foreground">{p.id}</span>
              {p.label}
            </a>
          </li>
        ))}
        {ranking.unresolved.map((label) => (
          <li
            key={label}
            className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground"
            title="No matching HPO term"
          >
            {label} (not mapped)
          </li>
        ))}
      </ul>

      {ranking.diseases.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No disease matched these phenotypes.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">#</th>
                <th className="py-1.5 pr-3 font-medium">Disease</th>
                <th className="py-1.5 pr-3 font-medium">Causal genes</th>
                <th className="py-1.5 font-medium">Match</th>
              </tr>
            </thead>
            <tbody>
              {ranking.diseases.slice(0, 8).map((d) => (
                <tr key={d.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                    {d.rank}
                  </td>
                  <td className="py-2 pr-3">
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {d.name}
                    </a>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {d.genes.length > 0 ? (
                        d.genes.map((g) => <GenePill key={g} symbol={g} />)
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          heterogeneous
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2">
                    <ScoreBar value={d.score / top} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function formatAf(af: number | null) {
  if (af == null) return 'absent';
  return af < 1e-3 ? af.toExponential(1) : af.toFixed(4);
}

function amTone(score: number) {
  if (score >= 0.564) return 'text-red-600 dark:text-red-400';
  if (score <= 0.34) return 'text-emerald-600 dark:text-emerald-400';
  return 'text-amber-600 dark:text-amber-400';
}

function clinvarLabel(clinvar: string[]) {
  const values = clinvar.filter((s) => s !== 'not_provided');
  if (values.length === 0) return '—';
  const pathogenic = values.some((s) => s.includes('pathogenic'));
  const benign = values.some((s) => s.includes('benign'));
  if (pathogenic && benign) return 'conflicting';
  return values[values.length - 1].replaceAll('_', ' ');
}

function VariantRow({ variant }: { variant: VariantCandidate }) {
  const change = variant.hgvsp?.split(':')[1] ?? variant.hgvsc?.split(':')[1];
  return (
    <tr className="border-b align-top last:border-0">
      <td className="py-2 pr-3 tabular-nums text-muted-foreground">
        {variant.rank}
      </td>
      <td className="py-2 pr-3">
        {variant.gene ? <GenePill symbol={variant.gene} /> : '—'}
      </td>
      <td className="py-2 pr-3">
        <details>
          <summary className="cursor-pointer font-mono text-xs">
            {change ?? variant.input}
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
            {variant.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      </td>
      <td className="py-2 pr-3 text-xs">
        {variant.consequence?.replaceAll('_', ' ') ?? '—'}
      </td>
      <td className="py-2 pr-3 font-mono text-xs tabular-nums">
        {formatAf(variant.gnomadAf)}
      </td>
      <td className="py-2 pr-3 font-mono text-xs tabular-nums">
        {variant.alphaMissense ? (
          <span className={amTone(variant.alphaMissense.score)}>
            {variant.alphaMissense.score.toFixed(2)}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="py-2 pr-3 text-xs">{clinvarLabel(variant.clinvar)}</td>
      <td className="py-2">
        <div className="flex items-center gap-2">
          <ScoreBar value={variant.combinedScore} />
          <span className="whitespace-nowrap font-mono text-xs tabular-nums">
            {variant.combinedScore.toFixed(2)}
          </span>
        </div>
      </td>
    </tr>
  );
}

function VariantCard({
  result,
}: {
  result: VariantPrioritization & { topDiseases?: RankedDisease[] };
}) {
  return (
    <Card
      title="Candidate variants"
      meta={`Ensembl VEP · gnomAD · ClinVar · AlphaMissense · ${(result.elapsedMs / 1000).toFixed(1)} s`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-1.5 pr-3 font-medium">#</th>
              <th className="py-1.5 pr-3 font-medium">Gene</th>
              <th className="py-1.5 pr-3 font-medium">Variant</th>
              <th className="py-1.5 pr-3 font-medium">Consequence</th>
              <th className="py-1.5 pr-3 font-medium">gnomAD AF</th>
              <th className="py-1.5 pr-3 font-medium">AlphaMissense</th>
              <th className="py-1.5 pr-3 font-medium">ClinVar</th>
              <th className="py-1.5 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {result.variants.map((v) => (
              <VariantRow key={v.input} variant={v} />
            ))}
          </tbody>
        </table>
      </div>
      {result.notAnnotated.length > 0 && (
        <p className={cn('text-xs text-muted-foreground')}>
          Could not annotate: {result.notAnnotated.join(', ')}. Use HGVS with a
          transcript, an rsID or chr-pos-ref-alt on GRCh38.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Score combines variant evidence with how well the gene explains the
        phenotypes. Research use; confirm in an accredited laboratory.
      </p>
    </Card>
  );
}

interface DocumentExtraction {
  documentType: string;
  sex: string;
  age: string;
  presentFindings: { label: string; hpoId: string | null }[];
  absentFindings: string[];
  variants: {
    notation: string;
    gene: string | null;
    zygosity: string;
    inheritance: string;
    reportedClassification: string | null;
  }[];
  familyHistory: string;
  elapsedMs: number;
}

function DocumentCard({ extraction }: { extraction: DocumentExtraction }) {
  return (
    <Card
      title={`Read: ${extraction.documentType}`}
      meta={`Muse Spark sub-agent · ${(extraction.elapsedMs / 1000).toFixed(1)} s`}
    >
      <p className="text-xs text-muted-foreground">
        {extraction.sex} · {extraction.age} · family history:{' '}
        {extraction.familyHistory}
      </p>
      <ul className="flex flex-wrap gap-1.5" aria-label="Findings present">
        {extraction.presentFindings.map((f) => (
          <li key={f.label} className="rounded-full border px-2 py-0.5 text-xs">
            {f.label}
          </li>
        ))}
        {extraction.absentFindings.map((f) => (
          <li
            key={f}
            className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground line-through"
            title="Reported absent"
          >
            {f}
          </li>
        ))}
      </ul>
      {extraction.variants.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">Gene</th>
                <th className="py-1.5 pr-3 font-medium">Variant</th>
                <th className="py-1.5 pr-3 font-medium">Zygosity</th>
                <th className="py-1.5 pr-3 font-medium">Inheritance</th>
                <th className="py-1.5 font-medium">Reported as</th>
              </tr>
            </thead>
            <tbody>
              {extraction.variants.map((v) => (
                <tr key={v.notation} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    {v.gene ? <GenePill symbol={v.gene} /> : '—'}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{v.notation}</td>
                  <td className="py-2 pr-3 text-xs">{v.zygosity}</td>
                  <td className="py-2 pr-3 text-xs">{v.inheritance}</td>
                  <td className="py-2 text-xs">
                    {v.reportedClassification ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

interface LiteratureReview {
  gene: string;
  verdict: 'strong' | 'moderate' | 'limited' | 'none';
  summary: string;
  articles: {
    pmid: string;
    supports: 'supports' | 'neutral' | 'against';
    finding: string;
    title: string;
    year: string;
    journal: string;
    url: string;
  }[];
  elapsedMs: number;
}

const VERDICT_TONE: Record<LiteratureReview['verdict'], string> = {
  strong: 'text-emerald-600 dark:text-emerald-400',
  moderate: 'text-amber-600 dark:text-amber-400',
  limited: 'text-muted-foreground',
  none: 'text-muted-foreground',
};

const VERDICT_LABEL: Record<LiteratureReview['verdict'], string> = {
  strong: 'Strong evidence',
  moderate: 'Moderate evidence',
  limited: 'Limited evidence',
  none: 'No supporting evidence',
};

const SUPPORT_MARK: Record<
  LiteratureReview['articles'][number]['supports'],
  string
> = {
  supports: '✓',
  neutral: '·',
  against: '✗',
};

function LiteratureCard({ review }: { review: LiteratureReview }) {
  return (
    <Card
      title={`Literature: ${review.gene}`}
      meta={`PubMed · Muse Spark sub-agent · ${(review.elapsedMs / 1000).toFixed(1)} s`}
    >
      <p className="text-sm">
        <span className={cn('font-medium', VERDICT_TONE[review.verdict])}>
          {VERDICT_LABEL[review.verdict]}.
        </span>{' '}
        {review.summary}
      </p>
      <ul className="flex flex-col gap-2">
        {review.articles.map((a) => (
          <li key={a.pmid} className="flex gap-2 text-sm">
            <span
              className="w-4 shrink-0 text-center text-muted-foreground"
              title={a.supports}
              aria-label={a.supports}
            >
              {SUPPORT_MARK[a.supports]}
            </span>
            <div className="min-w-0">
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {a.title}
              </a>
              <p className="text-xs text-muted-foreground">
                {a.journal} {a.year} · PMID {a.pmid} · {a.finding}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
