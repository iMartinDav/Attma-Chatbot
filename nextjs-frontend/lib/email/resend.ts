import { Resend } from 'resend';

// Security enhancement: Check for API key at startup
const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  // Don't throw here - instead log a warning
  console.error('CRITICAL: Missing RESEND_API_KEY environment variable');
}

// Initialize Resend with validated API key
export const resend = new Resend(RESEND_API_KEY || '');

// Default sender address with proper validation
const validateSender = () => {
  const configuredSender = process.env.EMAIL_FROM || 'no-reply@imartin.dev';
  // Ensure sender is a valid email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredSender)) {
    console.warn(
      `Invalid sender email format: ${configuredSender}, using fallback`,
    );
    return 'no-reply@imartin.dev';
  }
  return configuredSender;
};

export const defaultFrom = validateSender();
