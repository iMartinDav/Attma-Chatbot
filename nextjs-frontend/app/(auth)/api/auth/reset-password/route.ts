import { eq, gt, and } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { hash } from 'bcrypt-ts';
import { user, passwordReset } from '@/lib/db/schema';

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
    const { token, password } = await request.json();

    if (!token || typeof token !== 'string') {
      return Response.json(
        { error: 'Valid token is required' },
        { status: 400 },
      );
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return Response.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    // Find the password reset record by token and ensure it's not expired
    if (!db) {
      return Response.json(
        { error: 'Database connection is not initialized' },
        { status: 500 },
      );
    }

    const resetRecords = await db
      .select()
      .from(passwordReset)
      .where(
        and(
          eq(passwordReset.token, token),
          gt(passwordReset.expiresAt, new Date()),
        ),
      )
      .limit(1);

    const reset = resetRecords.length > 0 ? resetRecords[0] : null;

    // If no valid token found
    if (!reset) {
      return Response.json(
        {
          error:
            'Invalid or expired token. Please request a new password reset.',
        },
        { status: 400 },
      );
    }

    try {
      // Hash the new password
      const hashedPassword = await hash(password, 12);

      // Update the user's password
      await db
        .update(user)
        .set({ password: hashedPassword })
        .where(eq(user.id, reset.userId));

      // Delete all password reset tokens for this user
      await db
        .delete(passwordReset)
        .where(eq(passwordReset.userId, reset.userId));
    } catch (updateError) {
      console.error('Password reset update error:', updateError);
      return Response.json(
        { error: 'Failed to update password. Please try again.' },
        { status: 500 },
      );
    }

    return Response.json(
      {
        success: true,
        message:
          'Password reset successful. You can now log in with your new password.',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Reset password error:', error);
    return Response.json(
      { error: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
