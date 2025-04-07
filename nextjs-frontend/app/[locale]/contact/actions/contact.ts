'use server';

import { z } from 'zod';
import { getDictionary } from '@/lib/internationalization/dictionaries';
import type { Locale } from '@/lib/internationalization/config';

// Define validation schema
const contactFormSchema = z.object({
  firstName: z.string().min(1, {
    message: 'required',
  }),
  lastName: z.string().min(1, {
    message: 'required',
  }),
  email: z.string().email({
    message: 'invalidEmail',
  }),
  company: z.string().optional(),
  message: z.string().min(10, {
    message: 'Message must be at least 10 characters',
  }),
  researchArea: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export async function submitContactForm(
  rawFormData: FormData,
  locale: Locale = 'en',
) {
  // Get dictionary for error messages
  const dictionary = await getDictionary(locale);
  const errorMessages = dictionary.contact?.errors || {
    required: 'This field is required',
    invalidEmail: 'Please enter a valid email',
    submission: 'There was an error submitting your form',
  };

  // Extract data from FormData
  const formData = {
    firstName: rawFormData.get('firstName') as string,
    lastName: rawFormData.get('lastName') as string,
    email: rawFormData.get('email') as string,
    company: rawFormData.get('company') as string,
    message: rawFormData.get('message') as string,
    researchArea: rawFormData.get('researchArea') as string,
  };

  // Validate data
  const result = contactFormSchema.safeParse(formData);

  if (!result.success) {
    // Map errors to translated messages
    const errors = result.error.errors.map((error) => {
      // Use the error code as a key to look up the translated message
      const message =
        errorMessages[error.message as keyof typeof errorMessages] ||
        error.message;
      return {
        path: error.path,
        message,
      };
    });

    return {
      success: false,
      message: errorMessages.submission,
      errors,
    };
  }

  try {
    // Process form data (e.g., send email, save to database)
    // ...existing implementation...

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: errorMessages.general,
    };
  }
}
