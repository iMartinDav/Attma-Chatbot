import { DEMO_CASES, demoPrompt } from '@/lib/rare-disease/demo-cases';

export interface EvalCase {
  id: string;
  prompt: string;
  /** The session status that counts as success for this case. */
  expect: 'awaiting_review' | 'needs_input';
}

function demoCase(id: string) {
  const demo = DEMO_CASES.find((entry) => entry.id === id);
  if (!demo) throw new Error(`Demo case ${id} is missing.`);
  return demo;
}

const dravet = demoCase('dravet');

// The no-phenotypes case reuses the dravet variants, because the gate should ask for the missing findings instead of guessing.
export const EVAL_CASES: EvalCase[] = [
  ...DEMO_CASES.map((demo) => ({
    id: demo.id,
    prompt: demoPrompt(demo),
    expect: 'awaiting_review' as const,
  })),
  {
    id: 'dravet-no-phenotypes',
    prompt: `Exome candidate variants: ${dravet.variants.join(', ')}\nNo clinical findings are available for this patient.`,
    expect: 'needs_input',
  },
];
