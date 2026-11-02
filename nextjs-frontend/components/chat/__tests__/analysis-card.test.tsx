import { fireEvent, render, screen } from '@testing-library/react';
import type {
  AnalysisSnapshot,
  ChecklistItem,
  Fact,
  Report,
} from '@/lib/analysis/types';
import type { AnalysisCardData } from '../analysis-card';
import { AnalysisCard } from '../analysis-card';

const RESEARCH_LINE =
  'Research use only. Ranks evidence for a qualified reviewer; not a diagnosis.';

const checklist: ChecklistItem[] = [
  {
    id: 'c1',
    question: 'Does the top gene explain the phenotypes?',
    kind: 'phenotype_match',
    evidenceNeeded: 'Phenotype score.',
  },
  {
    id: 'c3',
    question: 'Is there counterevidence?',
    kind: 'counterevidence',
    evidenceNeeded: 'Conflicting calls.',
  },
];

const facts: Fact[] = [
  {
    id: 'f1',
    itemId: 'c1',
    ref: 'r1',
    path: 'variants[0].gene',
    value: 'SCN1A',
    recordedAt: '2026-11-02T00:00:00.000Z',
  },
];

const report: Report = {
  answer: 'SCN1A fits the phenotype. Counterevidence does not overturn it.',
  findings: [
    {
      itemId: 'c1',
      status: 'proven',
      text: 'SCN1A explains the phenotype.',
      factIds: ['f1'],
    },
    {
      itemId: 'c3',
      status: 'gap',
      text: 'No counterevidence was recorded.',
      factIds: [],
    },
  ],
  gaps: ['No literature was recorded.'],
};

function snapshot(partial: Partial<AnalysisSnapshot>): AnalysisSnapshot {
  return {
    results: {},
    checklist: null,
    facts: [],
    report: null,
    openInputRequest: null,
    refusals: 0,
    status: 'awaiting_review',
    ...partial,
  };
}

function cardData(partial: Partial<AnalysisCardData>): AnalysisCardData {
  return {
    status: 'awaiting_review',
    checklist,
    facts,
    report,
    openInputRequest: null,
    refusals: 0,
    snapshot: snapshot({ status: partial.status ?? 'awaiting_review' }),
    ...partial,
  };
}

describe('AnalysisCard', () => {
  it('awaiting_review with onReview: Approve calls onReview once and shows Decision sent', () => {
    const onReview = jest.fn();
    render(<AnalysisCard data={cardData({})} onReview={onReview} />);

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(onReview).toHaveBeenCalledTimes(1);
    expect(onReview).toHaveBeenCalledWith('approve');
    expect(screen.getByText('Decision sent.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Request changes' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(RESEARCH_LINE)).toBeInTheDocument();
  });

  it('Request changes opens textarea, send disabled while empty, then sends notes', () => {
    const onReview = jest.fn();
    render(<AnalysisCard data={cardData({})} onReview={onReview} />);

    fireEvent.click(screen.getByRole('button', { name: 'Request changes' }));

    expect(screen.getByLabelText('What should change?')).toBeInTheDocument();
    const send = screen.getByRole('button', {
      name: 'Send requested changes',
    });
    expect(send).toBeDisabled();

    fireEvent.change(screen.getByLabelText('What should change?'), {
      target: { value: 'Recheck the decoy.' },
    });
    expect(send).toBeEnabled();

    fireEvent.click(send);
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(onReview).toHaveBeenCalledWith('changes', 'Recheck the decoy.');
    expect(screen.getByText('Decision sent.')).toBeInTheDocument();
    expect(screen.getByText(RESEARCH_LINE)).toBeInTheDocument();
  });

  it('awaiting_review without onReview shows no buttons', () => {
    render(<AnalysisCard data={cardData({})} />);

    expect(screen.getByText('Awaiting your review')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Request changes' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(RESEARCH_LINE)).toBeInTheDocument();
  });

  it('needs_input shows the requested question', () => {
    render(
      <AnalysisCard
        data={cardData({
          status: 'needs_input',
          report: null,
          openInputRequest: {
            question: 'no phenotypes provided',
            itemId: 'c1',
            requestedAt: '2026-11-02T00:00:00.000Z',
          },
        })}
      />,
    );

    expect(screen.getByText('Needs input')).toBeInTheDocument();
    expect(screen.getByText('no phenotypes provided')).toBeInTheDocument();
    expect(screen.getByText(RESEARCH_LINE)).toBeInTheDocument();
  });

  it('escalated shows the last problems', () => {
    render(
      <AnalysisCard
        data={cardData({ status: 'escalated', refusals: 3 })}
        lastProblems={['Finding c2: number 28.1 has no cited fact.']}
      />,
    );

    expect(screen.getByText('Escalated to you')).toBeInTheDocument();
    expect(
      screen.getByText(/refused 3 times and needs your guidance/),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Finding c2: number 28.1 has no cited fact.'),
    ).toBeInTheDocument();
    expect(screen.getByText(RESEARCH_LINE)).toBeInTheDocument();
  });

  it('shows the checklist, cited facts and answer', () => {
    render(<AnalysisCard data={cardData({})} onReview={jest.fn()} />);
    expect(
      screen.getByText('Does the top gene explain the phenotypes?'),
    ).toBeInTheDocument();
    expect(screen.getByText('counterevidence')).toBeInTheDocument();
    expect(screen.getByText('Proven')).toBeInTheDocument();
    expect(
      screen.getByText('variants[0].gene = SCN1A (r1)'),
    ).toBeInTheDocument();
    expect(screen.getByText(/SCN1A fits the phenotype/)).toBeInTheDocument();
    expect(screen.getByText(RESEARCH_LINE)).toBeInTheDocument();
  });
});
