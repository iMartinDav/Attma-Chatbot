import { hash } from 'bcrypt-ts';
import { createUser } from '@/lib/db/queries';
import { sendWelcomeEmail } from '@/lib/email/services';

export async function POST(request: Request) {
  try {
    // Parse the request body
    const { email, password, name } = await request.json();

    // Validate required fields
    if (!email || !password) {
      return Response.json(
        { error: 'Email and password are required' },
        { status: 400 },
      );
    }

    // Create a hashed password
    const hashedPassword = await hash(password, 12);

    // Create the user in the database
    const newUser = await createUser(email, hashedPassword);

    if (!newUser || newUser.length === 0) {
      return Response.json(
        { error: 'Failed to create user account' },
        { status: 500 },
      );
    }

    // Send welcome email
    try {
      await sendWelcomeEmail({
        email,
        username: name || email.split('@')[0], // Use name if provided, otherwise use email username part
        signupMethod: 'email',
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't block registration if email fails
    }

    return Response.json(
      { success: true, message: 'User created successfully' },
      { status: 201 },
    );
  } catch (error: any) {
    // Check for duplicate email error
    if (error.message?.includes('duplicate key')) {
      return Response.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      );
    }

    console.error('Registration error:', error);
    return Response.json(
      { error: 'Failed to create user account' },
      { status: 500 },
    );
  }
}
