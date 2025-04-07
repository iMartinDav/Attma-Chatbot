import { sendWelcomeEmail } from '@/lib/email/services';

export async function POST(request: Request) {
  try {
    // Validate content type
    const contentType = request.headers.get('content-type');
    if (contentType !== 'application/json') {
      return Response.json(
        { error: 'Content-Type must be application/json' },
        { status: 415 },
      );
    }

    // Get origin for CSRF protection
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL,
      'https://imartin.dev',
      'https://www.imartin.dev',
    ].filter(Boolean);

    const isValidOrigin = !origin || allowedOrigins.includes(origin);
    if (!isValidOrigin) {
      return Response.json({ error: 'Invalid origin' }, { status: 403 });
    }

    // Parse request body safely
    let body: { email: string; username?: string; signupMethod?: string };
    try {
      body = await request.json();
    } catch (e) {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { email, username, signupMethod } = body;

    // Validate inputs with stronger validation
    if (
      !email ||
      typeof email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return Response.json(
        { error: 'Valid email is required' },
        { status: 400 },
      );
    }

    // Validate signup method
    if (signupMethod && !['email', 'google'].includes(signupMethod)) {
      return Response.json({ error: 'Invalid signup method' }, { status: 400 });
    }

    // Send the email
    const { data, error } = await sendWelcomeEmail({
      email,
      username,
      signupMethod: (signupMethod as 'email' | 'google') || 'email',
    });

    if (error) {
      console.error('Error sending welcome email:', error);
      return Response.json(
        { error: error?.message || 'Failed to send email' },
        { status: 500 },
      );
    }

    return Response.json({ success: true, data }, { status: 200 });
  } catch (error: any) {
    console.error('Welcome email error:', error);
    return Response.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
