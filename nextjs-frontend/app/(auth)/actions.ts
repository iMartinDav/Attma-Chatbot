'use server';

import { signIn } from '@/app/(auth)/auth';
import { createUser, getUser } from '@/lib/db/queries';
import { isValidEmail } from '@/lib/utils';
import { compare, hash } from 'bcrypt-ts';
import { z } from 'zod';

// Define action state types with proper error handling
export type RegisterActionState = {
  status: 'idle' | 'success' | 'failed' | 'user_exists' | 'invalid_data';
  error?: string;
};

export type LoginActionState = {
  status: 'idle' | 'success' | 'failed' | 'invalid_data';
  error?: string;
  debug?: string;
};

// Enhanced password validation schema
const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .refine((password) => /[A-Z]/.test(password), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((password) => /[a-z]/.test(password), {
    message: 'Password must contain at least one lowercase letter',
  })
  .refine((password) => /[0-9]/.test(password), {
    message: 'Password must contain at least one number',
  })
  .refine((password) => /[^A-Za-z0-9]/.test(password), {
    message: 'Password must contain at least one special character',
  });

// Less strict password schema to support existing passwords
const loginPasswordSchema = z.string().min(1, 'Password is required');

// User schema for validation
const userSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: passwordSchema,
});

// Login schema - less strict for existing accounts
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// Register action
export async function register(
  formData: FormData,
): Promise<RegisterActionState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    // Validate email format first
    if (!isValidEmail(email)) {
      return {
        status: 'invalid_data',
        error: 'Please enter a valid email address',
      };
    }

    // Validate password with schema for detailed error messages
    try {
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return {
          status: 'invalid_data',
          error: err.issues[0]?.message ?? 'Invalid data',
        };
      }
    }

    // Check if user exists
    const existingUsers = await getUser(email);
    if (existingUsers.length > 0) {
      return {
        status: 'user_exists',
        error: 'An account with this email already exists',
      };
    }

    // Hash password and create user
    const hashedPassword = await hash(password, 10);
    await createUser(email, hashedPassword);

    return { status: 'success' };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      status: 'failed',
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

// Login action with improved error handling and debugging
export async function login(formData: FormData): Promise<LoginActionState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    console.log(`Login attempt for email: ${email}`);

    // Basic validation
    if (!email || !password) {
      return {
        status: 'invalid_data',
        error: 'Email and password are required',
      };
    }

    if (!isValidEmail(email)) {
      return {
        status: 'invalid_data',
        error: 'Please enter a valid email address',
      };
    }

    // Check if user exists first
    const users = await getUser(email);
    if (users.length === 0) {
      console.log(`No user found with email: ${email}`);
      return {
        status: 'failed',
        error: 'No account found with this email',
      };
    }

    const user = users[0];
    console.log(`User found: ${user.id}, has password: ${!!user.password}`);

    if (!user.password) {
      console.log(`User ${email} has no password (social login only)`);
      return {
        status: 'failed',
        error: 'This account uses social login. Please sign in with Google.',
      };
    }

    // We're going to manually verify the password first for debugging
    let isPasswordValid = false;
    try {
      isPasswordValid = await compare(password, user.password);
      console.log(
        `Password comparison result: ${isPasswordValid ? 'Valid' : 'Invalid'}`,
      );

      if (!isPasswordValid) {
        return {
          status: 'failed',
          error: 'Invalid password. Please try again.',
        };
      }
    } catch (passwordErr) {
      console.error('Error during password comparison:', passwordErr);
      return {
        status: 'failed',
        error: 'Error verifying password',
        debug:
          passwordErr instanceof Error
            ? passwordErr.message
            : String(passwordErr),
      };
    }

    // Password is valid, now do the actual sign-in
    try {
      // Direct session creation approach
      console.log('Password valid, creating session for user:', user.id);

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      console.log(`Sign-in result:`, JSON.stringify(result, null, 2));

      // Check if there's an error in the result
      if (!result?.ok) {
        return {
          status: 'failed',
          error: `Login failed: ${result?.error || 'Unknown error'}`,
          debug: `Full result: ${JSON.stringify(result)}`,
        };
      }

      // Success case
      return {
        status: 'success',
        debug: `Authentication successful, user ID: ${user.id}`,
      };
    } catch (signInErr) {
      console.error('Error during sign-in:', signInErr);
      return {
        status: 'failed',
        error: 'Failed to sign in',
        debug:
          signInErr instanceof Error
            ? signInErr.stack || signInErr.message
            : String(signInErr),
      };
    }
  } catch (error) {
    console.error('Login error:', error);
    return {
      status: 'failed',
      error: 'An unexpected error occurred',
      debug:
        error instanceof Error ? error.stack || error.message : String(error),
    };
  }
}
