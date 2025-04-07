import { sendMagicLinkEmail } from '@/lib/email/services';
import { auth } from '@/app/(auth)/auth';

export async function POST(request: Request) {
  try {
    // Check if request is authorized (if needed)
    const session = await auth();

    // Parse request body
    const { email, loginCode } = await request.json();

    // Validate inputs
    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!loginCode) {
      return Response.json(
        { error: 'Login code is required' },
        { status: 400 },
      );
    }

    // Send the email
    const { data, error } = await sendMagicLinkEmail({ email, loginCode });

    if (error) {
      // Use optional chaining and provide a fallback error message
      return Response.json(
        { error: error?.message || 'Failed to send email' },
        { status: 500 },
      );
    }

    return Response.json({ data }, { status: 200 });
  } catch (error: any) {
    console.error('Magic link email error:', error);
    return Response.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
