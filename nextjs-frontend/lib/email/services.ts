import type { ReactElement } from 'react';
import { resend, defaultFrom } from './resend';
import { NotionMagicLinkEmail } from '@/emails/notion-magic-link';
import { ResetPasswordEmail } from '@/emails/reset-password';
import { WelcomeEmail } from '@/emails/welcome';

// Define error type to include message property
type EmailError = {
  message: string;
  statusCode?: number;
  [key: string]: any;
};

// Add logging and rate tracking
const EMAIL_RATE_LOG = new Map<string, { count: number; lastSent: number }>();
const MAX_EMAILS_PER_HOUR = 5;

// Improved email sending function with rate limiting
export async function sendEmail({
  to,
  subject,
  react,
  from = defaultFrom,
}: {
  to: string | string[];
  subject: string;
  react: ReactElement;
  from?: string;
}) {
  try {
    // Apply rate limiting for single email addresses
    if (typeof to === 'string') {
      // Check rate limiting (basic implementation)
      const now = Date.now();
      const rateData = EMAIL_RATE_LOG.get(to) || { count: 0, lastSent: now };

      // Reset counter if it's been over an hour
      if (now - rateData.lastSent > 3600000) {
        rateData.count = 0;
      }

      // Check if rate limit exceeded
      if (rateData.count >= MAX_EMAILS_PER_HOUR) {
        console.warn(`Rate limit exceeded for email: ${to}`);
        return {
          error: { message: 'Rate limit exceeded. Try again later.' },
          data: null,
        };
      }

      // Update rate tracking
      EMAIL_RATE_LOG.set(to, {
        count: rateData.count + 1,
        lastSent: now,
      });
    }

    // Sanitize inputs
    const sanitizedSubject = subject.replace(/[^\w\s.,!?@:;()\[\]{}\-]/g, '');

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: sanitizedSubject,
      react,
    });

    if (error) {
      console.error('Error sending email:', error);
      // Convert to our EmailError type with a guaranteed message property
      const emailError: EmailError = {
        message:
          typeof error === 'object' && error !== null && 'message' in error
            ? String(error.message)
            : 'Unknown email sending error',
      };
      return { error: emailError, data: null };
    }

    // Add logging
    console.info(
      `Email sent successfully to: ${typeof to === 'string' ? to : 'multiple recipients'}`,
    );

    return { error: null, data };
  } catch (error: unknown) {
    console.error('Exception sending email:', error);
    // Handle any caught exceptions by converting to our EmailError type
    const emailError: EmailError = {
      message:
        error instanceof Error
          ? error.message
          : 'Unknown exception during email sending',
    };
    return { error: emailError, data: null };
  }
}

// Specific function for sending magic link emails
export async function sendMagicLinkEmail({
  email,
  loginCode,
}: {
  email: string;
  loginCode: string;
}) {
  return sendEmail({
    to: email,
    subject: 'Your magic link for login',
    react: NotionMagicLinkEmail({ loginCode }),
  });
}

// Updated password reset email function to better handle username
export async function sendPasswordResetEmail({
  email,
  username,
  resetLink,
}: {
  email: string;
  username?: string; // Username may come from session
  resetLink: string;
}) {
  // Format username like in ChatGreeting.tsx
  const formattedUsername = username || email.split('@')[0];

  return sendEmail({
    to: email,
    subject: 'Reset your Attma password',
    react: ResetPasswordEmail({
      username: formattedUsername,
      resetLink,
    }),
  });
}

// New function for sending welcome emails
export async function sendWelcomeEmail({
  email,
  username,
  signupMethod = 'email',
}: {
  email: string;
  username?: string;
  signupMethod?: 'email' | 'google';
}) {
  return sendEmail({
    to: email,
    subject: 'Welcome to Attma! 🧞‍♂️ 🧬',
    react: WelcomeEmail({
      username,
      userEmail: email,
      signupMethod,
    }),
  });
}
