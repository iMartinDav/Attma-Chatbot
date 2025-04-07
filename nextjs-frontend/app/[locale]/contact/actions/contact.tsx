'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

// Define validation schema
const ContactFormSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  company: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  researchArea: z.string().optional(),
});

type ContactFormData = z.infer<typeof ContactFormSchema>;

export async function submitContactForm(formData: FormData) {
  // Get data from form submission
  const rawData = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    company: formData.get('company'),
    message: formData.get('message'),
    researchArea: formData.get('researchArea'),
  };

  try {
    // Validate form data
    const validatedData = ContactFormSchema.parse({
      firstName: rawData.firstName,
      lastName: rawData.lastName,
      email: rawData.email,
      company: rawData.company || '',
      message: rawData.message,
      researchArea: rawData.researchArea || '',
    });

    // In a production environment, you would send this data to your email service
    // For example using Resend, Sendgrid, etc.
    console.log('Form submission:', validatedData);

    // TODO: Add your email sending logic here
    // await sendEmail({...})

    // Set a cookie to show success message after redirect
    (
      await // TODO: Add your email sending logic here
      // await sendEmail({...})
      // Set a cookie to show success message after redirect
      cookies()
    ).set('contactSubmitted', 'true', {
      maxAge: 10, // Short-lived cookie
    });

    // Redirect to thank you page or back to contact with success parameter
    redirect('/contact?success=true');
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors);
      return {
        success: false,
        errors: error.errors,
        data: rawData,
      };
    }

    console.error('Form submission error:', error);
    return {
      success: false,
      message: 'An unexpected error occurred',
      data: rawData,
    };
  }
}
