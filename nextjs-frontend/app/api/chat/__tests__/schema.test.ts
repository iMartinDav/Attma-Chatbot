import { postRequestBodySchema } from '../schema';

const base = {
  id: 'new',
  message: {
    id: 'm1',
    role: 'user' as const,
    parts: [{ type: 'text' as const, text: 'Hello' }],
  },
  selectedChatModel: 'agent-model',
  selectedVisibilityType: 'private' as const,
};

describe('postRequestBodySchema review', () => {
  it('accepts a request without a review', () => {
    expect(postRequestBodySchema.safeParse(base).success).toBe(true);
  });

  it('accepts approve and changes with notes', () => {
    expect(
      postRequestBodySchema.safeParse({
        ...base,
        review: { decision: 'approve' },
      }).success,
    ).toBe(true);
    expect(
      postRequestBodySchema.safeParse({
        ...base,
        review: { decision: 'changes', notes: 'Check the second variant.' },
      }).success,
    ).toBe(true);
  });

  it('rejects unknown decisions and non-string notes', () => {
    expect(
      postRequestBodySchema.safeParse({
        ...base,
        review: { decision: 'reject' },
      }).success,
    ).toBe(false);
    expect(
      postRequestBodySchema.safeParse({
        ...base,
        review: { decision: 'changes', notes: 42 },
      }).success,
    ).toBe(false);
    expect(
      postRequestBodySchema.safeParse({ ...base, review: 'approve' }).success,
    ).toBe(false);
  });
});
