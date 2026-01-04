import type { CaseStudyItem } from '../types';

// Map case study IDs to their respective images
export const CASE_STUDY_IMAGES: Record<string, string> = {
  'genomic-research': '/images/case-genomic.jpg',
  'drug-development': '/images/case-drug.jpg',
  'disease-monitoring': '/images/case-covid.jpg',
  'rare-diseases': '/images/case-genomic.jpg',
  'drug-discovery': '/images/case-drug.jpg',
  'covid-tracking': '/images/case-covid.jpg',
};

// Default placeholder for missing images
export const DEFAULT_CASE_IMAGE = '/images/placeholder-case.jpg';

// Default case studies when translations are not available
export const DEFAULT_CASE_STUDIES: CaseStudyItem[] = [
  {
    id: 'genomic-research',
    title: 'Accelerate Genomic Research',
    description:
      'Analyze genomic data faster and with greater accuracy. Identify variants and patterns within DNA sequences that may impact disease susceptibility and treatment outcomes.',
    image: CASE_STUDY_IMAGES['genomic-research'],
    tag: 'Research',
  },
  {
    id: 'drug-development',
    title: 'Streamline Drug Development',
    description:
      'Predict protein-ligand interactions and identify potential therapeutic compounds more efficiently, potentially reducing the drug discovery timeline from years to months.',
    image: CASE_STUDY_IMAGES['drug-development'],
    tag: 'Pharma',
  },
  {
    id: 'disease-monitoring',
    title: 'Disease Variant Monitoring',
    description:
      'Track and predict pathogen mutations in real-time, helping predict outbreaks and develop targeted interventions before they become widespread health concerns.',
    image: CASE_STUDY_IMAGES['disease-monitoring'],
    tag: 'Public Health',
  },
];

// Default text content when translations are not available
export const DEFAULT_CASE_TEXT = {
  title: 'Potential Applications',
  subtitle:
    'Discover how Attma can revolutionize your research workflows and accelerate scientific discoveries.',
  viewAll: 'Join the beta program',
  readCase: 'Learn more',
};
