'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { formatValue } from '@/lib/analysis/verify';
import type {
  AnalysisSnapshot,
  AnalysisStatus,
  ChecklistItem,
  Fact,
  InputRequest,
  Report,
} from '@/lib/analysis/types';
import { cn } from '@/lib/utils';
import { displayAnalysisStatus } from './step-labels';

export interface AnalysisCardData {
  status: AnalysisStatus;
  checklist: ChecklistItem[] | null;
  facts: Fact[];
  report: Report | null;
  openInputRequest: InputRequest | null;
  refusals: number;
  snapshot: AnalysisSnapshot;
}

export type AnalysisReviewDecision = 'approve' | 'changes';

const STATUS_LABELS: Record<AnalysisStatus | 'superseded', string> = {
  collecting: 'Collecting',
  needs_input: 'Needs input',
  awaiting_review: 'Awaiting your review',
  approved: 'Approved',
  escalated: 'Escalated to you',
  superseded: 'Superseded',
};

function kindLabel(kind: ChecklistItem['kind']): string {
  return kind.replace(/_/g, ' ');
}

/**
 * The trust gate for one analysis: what was asked, what the cited facts show,
 * and, when the report waits for a person, the approve and changes actions.
 */
export function AnalysisCard({
  data,
  lastProblems = [],
  disabled = false,
  onReview,
  isLatest = true,
}: {
  data: AnalysisCardData;
  /** Refusal problems from the last refused report in this message, shown when escalated. */
  lastProblems?: string[];
  disabled?: boolean;
  onReview?: (decision: AnalysisReviewDecision, notes?: string) => void;
  /** False for older cards in the chat, which read as superseded with no live status. */
  isLatest?: boolean;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [decided, setDecided] = useState(false);
  const factsById = new Map(data.facts.map((fact) => [fact.id, fact]));
  const findingsByItem = new Map(
    (data.report?.findings ?? []).map((finding) => [finding.itemId, finding]),
  );
  const requestedItem = data.openInputRequest?.itemId
    ? data.checklist?.find((item) => item.id === data.openInputRequest?.itemId)
    : undefined;
  const busy = disabled || decided;

  return (
    <section
      aria-label="Analysis"
      className="flex w-full min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">Analysis</h3>
        <Badge
          variant={
            isLatest && data.status === 'awaiting_review'
              ? 'default'
              : 'secondary'
          }
          className={cn(
            isLatest &&
              (data.status === 'needs_input' || data.status === 'escalated') &&
              'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200',
            isLatest && data.status === 'approved' && 'text-primary-ink',
          )}
        >
          {
            STATUS_LABELS[
              displayAnalysisStatus(
                data.status,
                isLatest,
              ) as keyof typeof STATUS_LABELS
            ]
          }
        </Badge>
      </div>

      {data.report ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{data.report.answer}</p>
          {data.report.gaps.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">Gaps</p>
              <ul className="list-disc pl-5 text-sm">
                {data.report.gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {data.checklist && data.checklist.length > 0 ? (
        <>
          <Separator />
          <ol className="flex flex-col gap-3">
            {data.checklist.map((item) => {
              const finding = findingsByItem.get(item.id);
              const cited = (finding?.factIds ?? [])
                .map((id) => factsById.get(id))
                .filter((fact): fact is Fact => fact !== undefined);
              return (
                <li key={item.id} className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 text-sm font-medium">
                      {item.question}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0',
                        item.kind === 'counterevidence' &&
                          'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200',
                      )}
                    >
                      {kindLabel(item.kind)}
                    </Badge>
                    {finding ? (
                      <Badge
                        variant="secondary"
                        className={cn(
                          finding.status === 'proven' && 'text-primary-ink',
                        )}
                      >
                        {finding.status === 'proven' ? 'Proven' : 'Gap'}
                      </Badge>
                    ) : null}
                  </div>
                  {finding ? (
                    <p className="text-sm text-muted-foreground">
                      {finding.text}
                    </p>
                  ) : null}
                  {cited.length > 0 ? (
                    <ul className="flex flex-col gap-0.5">
                      {cited.map((fact) => (
                        <li
                          key={fact.id}
                          className="font-mono text-xs break-all"
                        >
                          {fact.path} = {formatValue(fact.value)} ({fact.ref})
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      ) : null}

      {data.status === 'needs_input' && data.openInputRequest ? (
        <div className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <p className="text-sm font-medium">Still needed</p>
          <p className="text-sm">{data.openInputRequest.question}</p>
          {requestedItem ? (
            <p className="text-sm text-muted-foreground">
              For: {requestedItem.question}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Reply in the composer below.
          </p>
        </div>
      ) : null}

      {data.status === 'escalated' ? (
        <div className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <p className="text-sm font-medium">
            The agent was refused {data.refusals} times and needs your guidance.
          </p>
          {lastProblems.length > 0 ? (
            <ul className="list-disc pl-5 text-sm">
              {lastProblems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Reply in the composer below.
          </p>
        </div>
      ) : null}

      {data.status === 'awaiting_review' && onReview ? (
        <div className="flex flex-col gap-2">
          {decided ? (
            <p className="text-sm text-muted-foreground">Decision sent.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setDecided(true);
                    onReview('approve');
                  }}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  aria-expanded={showNotes}
                  onClick={() => setShowNotes((open) => !open)}
                >
                  Request changes
                </Button>
              </div>
              {showNotes ? (
                <div className="flex flex-col gap-2">
                  <label htmlFor="analysis-change-notes" className="text-sm">
                    What should change?
                  </label>
                  <Textarea
                    id="analysis-change-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Notes for the agent"
                    rows={3}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={busy || notes.trim().length === 0}
                      onClick={() => {
                        setDecided(true);
                        onReview('changes', notes.trim());
                      }}
                    >
                      Send requested changes
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setShowNotes(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Research use only. Ranks evidence for a qualified reviewer; not a
        diagnosis.
      </p>
    </section>
  );
}
