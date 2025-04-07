import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { user, passwordReset } from '@/lib/db/schema';
import { sendPasswordResetEmail } from '@/lib/email/services';
import { auth } from '@/app/(auth)/auth';

// Connect to database with proper typing
let db: NeonHttpDatabase | undefined;
try {
  const sql = neon(process.env.DATABASE_URL || '');
  db = drizzle(sql);
} catch (e) {
  console.error('Failed to initialize database connection:', e);
  // We'll handle this in the request handler
}

export async function POST(request: Request) {
  try {
    // Add CSRF protection
    const origin = request.headers.get('Origin') || '';
    const host = request.headers.get('Host') || '';
    const isValidOrigin =
      origin === process.env.NEXT_PUBLIC_APP_URL || origin.endsWith(host);

    if (!isValidOrigin) {
      return Response.json(
        { error: 'Invalid request origin' },
        { status: 403 },
      );
    }

    // Check if database connection is established
    if (!db) {
      throw new Error('Database connection failed');
    }

    // Parse the email from request
    let email: string;
    try {
      const body = await request.json();
      email = body.email;
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return Response.json(
        { error: 'Invalid request format' },
        { status: 400 },
      );
    }

    // Validate email format before proceeding
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json(
        { error: 'Valid email is required' },
        { status: 400 },
      );
    }

    // Optional: Add IP-based rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    // Implement IP-based rate limiting logic here

    // Find user by email
    let foundUser: typeof user.$inferSelect | null;
    try {
      const users = await db
        .select()
        .from(user)
        .where(eq(user.email, email))
        .limit(1);
      foundUser = users.length > 0 ? users[0] : null;
    } catch (dbQueryError) {
      console.error('Error querying user:', dbQueryError);
      return Response.json({ error: 'Database query failed' }, { status: 500 });
    }

    // Don't reveal if a user doesn't exist for security reasons
    if (!foundUser) {
      return Response.json(
        {
          success: true,
          message:
            'If an account exists, a reset link will be sent to this email.',
        },
        { status: 200 },
      );
    }

    // Extract username following the ChatGreeting pattern
    // ChatGreeting uses: const userName = currentUser?.name || 'Friend';
    // But for email, let's use the first part of the email (before @) as fallback
    const emailLocalPart = email.split('@')[0];

    // Format in a more user-friendly way (capitalized first letter)
    const formattedName =
      emailLocalPart.charAt(0).toUpperCase() + emailLocalPart.slice(1);

    // Get session (we might have a logged in user requesting password reset)
    const session = await auth();
    const userName = session?.user?.name || formattedName;

    // Generate token and process reset
    try {
      // Secure token generation with more entropy
      const tokenBuffer = randomBytes(64);
      const token = tokenBuffer.toString('hex');

      // Set expiration time to 1 hour from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      // First delete any existing tokens for this user
      await db
        .delete(passwordReset)
        .where(eq(passwordReset.userId, foundUser.id));

      // Create new token
      await db.insert(passwordReset).values({
        userId: foundUser.id,
        token,
        expiresAt,
        createdAt: new Date(),
      });

      // Create reset link with proper env variable handling
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000');

      const resetLink = `${baseUrl}/reset-password?token=${token}`;

      // Send password reset email with the extracted username
      await sendPasswordResetEmail({
        email: foundUser.email,
        username: userName,
        resetLink,
      });
    } catch (processError) {
      console.error('Error processing reset request:', processError);
      return Response.json(
        { error: 'Failed to process reset request' },
        { status: 500 },
      );
    }

    // Add secure headers to response
    return new Response(
      JSON.stringify({
        success: true,
        message:
          'If an account exists, a reset link will be sent to this email.',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      },
    );
  } catch (error) {
    console.error('Forgot password error:', error);
    return Response.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
