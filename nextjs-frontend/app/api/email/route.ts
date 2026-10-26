import { sendEmail } from '@/lib/email/services';
import { auth } from '@/app/(auth)/auth';
import { NotionMagicLinkEmail } from '@/emails/notion-magic-link';
import { ResetPasswordEmail } from '@/emails/reset-password';
// Import the type directly
import type { ResetPasswordEmailProps } from '@/emails/reset-password';
import { WelcomeEmail } from '@/emails/welcome';
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export async function POST(request: Request) {
  try {
    // 1. Strict authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Rate limiting
    try {
      const identifier = session.user.id;
      await limiter.check(10, identifier); // 10 requests per minute per user
    } catch {
      return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // 3. Validate request body format
    let body: {
      to: string;
      subject: string;
      template: string;
      templateData: Record<string, unknown>;
    };
    try {
      body = await request.json();
    } catch (e) {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { to, subject, template, templateData } = body;

    // 4. Sanitize and validate inputs
    if (!to || !subject || !template) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // 5. Prevent sending emails to different domains in test/dev environments
    if (process.env.NODE_ENV !== 'production') {
      const allowedTestDomains = ['example.com', 'test.com'];
      if (
        typeof to === 'string' &&
        !allowedTestDomains.some((domain) => to.endsWith(domain))
      ) {
        console.warn(
          `Attempted to send email to ${to} in non-production environment`,
        );
        return Response.json(
          { success: true, data: { id: 'test-only' } },
          { status: 200 },
        );
      }
    }

    // Map template name to the actual React component
    let emailComponent: React.JSX.Element;
    switch (template) {
      case 'magic-link':
        emailComponent = NotionMagicLinkEmail(templateData);
        break;
      case 'reset-password': {
        if (
          !templateData.resetLink ||
          typeof templateData.resetLink !== 'string'
        ) {
          return Response.json(
            { error: 'Invalid or missing resetLink' },
            { status: 400 },
          );
        }
        const resetPasswordData: ResetPasswordEmailProps = {
          resetLink: templateData.resetLink,
          username:
            typeof templateData.username === 'string'
              ? templateData.username
              : undefined,
        };
        emailComponent = ResetPasswordEmail(resetPasswordData);
        break;
      }
      case 'welcome':
        emailComponent = WelcomeEmail(templateData);
        break;
      // Add other templates as needed
      default:
        return Response.json({ error: 'Invalid template' }, { status: 400 });
    }

    // Send the email
    const { data, error } = await sendEmail({
      to,
      subject,
      react: emailComponent,
    });

    if (error) {
      // Use optional chaining and provide a fallback error message
      return Response.json(
        { error: error?.message || 'Failed to send email' },
        { status: 500 },
      );
    }

    return Response.json({ data }, { status: 200 });
  } catch (error: unknown) {
    console.error('Email sending error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
