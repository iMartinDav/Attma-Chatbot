// Images for the landing page workflow cards, by dictionary item id. Made
// with Muse Image from the original genomic photo, so the set stays in one
// style.
export const CASE_STUDY_IMAGES: Record<string, string> = {
  'rare-diseases': '/images/case-rare-disease.jpg',
  'single-cell': '/images/case-single-cell.jpg',
  'variant-structure': '/images/case-protein.jpg',
};

export const DEFAULT_CASE_IMAGE = '/images/case-rare-disease.jpg';

// Used only if a dictionary lacks the section's text.
export const DEFAULT_CASE_TEXT = {
  title: 'Workflows You Can Run Today',
  subtitle:
    'Each one runs end to end in a single conversation, in about a minute or two.',
  viewAll: 'Talk to us about your data',
  readCase: 'Try this workflow',
};
