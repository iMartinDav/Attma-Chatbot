import {
  CASE_STUDY_IMAGES,
  DEFAULT_CASE_IMAGE,
  DEFAULT_CASE_TEXT,
} from '../constants/case-studies';
import type { CaseStudyItem, CasesProps } from '../types/component-types';

/**
 * Resolves the image path for a case study
 */
export const resolveCaseImage = (caseStudy: Partial<CaseStudyItem>): string => {
  // Check if image exists and is a valid URL or path
  if (
    caseStudy.image &&
    typeof caseStudy.image === 'string' &&
    caseStudy.image.trim() !== ''
  ) {
    return caseStudy.image;
  }

  // Resolve from ID-based mapping or use default
  return caseStudy.id && CASE_STUDY_IMAGES[caseStudy.id]
    ? CASE_STUDY_IMAGES[caseStudy.id]
    : DEFAULT_CASE_IMAGE;
};

/**
 * Prepares case studies data with proper image paths and defaults
 */
export const prepareCaseStudies = (dictionary?: CasesProps['dictionary']) => {
  const safeDict = dictionary || {};

  // Text content with defaults
  const textContent = {
    title: safeDict.title || DEFAULT_CASE_TEXT.title,
    subtitle: safeDict.subtitle || DEFAULT_CASE_TEXT.subtitle,
    viewAll: safeDict.viewAll || DEFAULT_CASE_TEXT.viewAll,
    readCase: safeDict.readCase || DEFAULT_CASE_TEXT.readCase,
  };

  // Case studies with images - ensure we have stable references
  const caseStudies =
    safeDict.items && safeDict.items.length > 0
      ? safeDict.items.map((item) => ({
          ...item,
          id: item.id || `case-${Math.random().toString(36).slice(2, 9)}`,
          image: resolveCaseImage(item),
        }))
      : [];

  return { textContent, caseStudies };
};
