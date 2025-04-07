import { DEFAULT_CONTACT_CONTENT } from '../constants/contact-content';

/**
 * Prepares contact page content with proper defaults
 */
export const prepareContactContent = (dictionary: any) => {
  // Ensure contact section exists with default values
  const contactDictionary = dictionary.contact || {};

  return {
    title: contactDictionary.title || DEFAULT_CONTACT_CONTENT.title,
    subtitle: contactDictionary.subtitle || DEFAULT_CONTACT_CONTENT.subtitle,
    form: {
      firstName:
        contactDictionary.form?.firstName ||
        DEFAULT_CONTACT_CONTENT.form.firstName,
      lastName:
        contactDictionary.form?.lastName ||
        DEFAULT_CONTACT_CONTENT.form.lastName,
      email:
        contactDictionary.form?.email || DEFAULT_CONTACT_CONTENT.form.email,
      company:
        contactDictionary.form?.company || DEFAULT_CONTACT_CONTENT.form.company,
      researchArea:
        contactDictionary.form?.researchArea ||
        DEFAULT_CONTACT_CONTENT.form.researchArea,
      message:
        contactDictionary.form?.message || DEFAULT_CONTACT_CONTENT.form.message,
      submit:
        contactDictionary.form?.submit || DEFAULT_CONTACT_CONTENT.form.submit,
      policy:
        contactDictionary.form?.policy || DEFAULT_CONTACT_CONTENT.form.policy,
    },
    benefits: {
      expertSupport:
        contactDictionary.benefits?.expertSupport ||
        DEFAULT_CONTACT_CONTENT.benefits.expertSupport,
      research:
        contactDictionary.benefits?.research ||
        DEFAULT_CONTACT_CONTENT.benefits.research,
      response:
        contactDictionary.benefits?.response ||
        DEFAULT_CONTACT_CONTENT.benefits.response,
      privacy:
        contactDictionary.benefits?.privacy ||
        DEFAULT_CONTACT_CONTENT.benefits.privacy,
    },
    researchAreas:
      contactDictionary.researchAreas || DEFAULT_CONTACT_CONTENT.researchAreas,
    errors: contactDictionary.errors || DEFAULT_CONTACT_CONTENT.errors,
    success: contactDictionary.success || DEFAULT_CONTACT_CONTENT.success,
  };
};

/**
 * Generate metadata for the contact page
 */
export const getContactMetadata = (dictionary: any) => {
  const contactContent = prepareContactContent(dictionary);

  return {
    title: `${contactContent.title} | ${dictionary.meta?.title || 'Attma'}`,
    description: contactContent.subtitle,
  };
};
