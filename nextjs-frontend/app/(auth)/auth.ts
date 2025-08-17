import { createUser, getUser, linkUserChats } from '@/lib/db/queries';
import { sendWelcomeEmail } from '@/lib/email/services'; // Direct import
import { compare } from 'bcrypt-ts';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { authConfig } from './auth.config';

// Export UserType for use in other modules
export type UserType = 'free' | 'pro' | 'enterprise';

// Define explicit types that match our database schema
interface UserData {
  id: string;
  email: string;
  password: string | null;
  // No name and image fields
}

interface GoogleProfile {
  sub: string;
  name?: string;
  email: string;
  picture?: string;
}

// Validate environment variables
const getEnvVariable = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const GOOGLE_CLIENT_ID = getEnvVariable('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = getEnvVariable('GOOGLE_CLIENT_SECRET');

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    GoogleProvider({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: 'select_account',
          access_type: 'offline',
          response_type: 'code',
          scope: 'openid email profile',
        },
      },
      profile(profile: GoogleProfile) {
        return {
          id: profile.sub,
          name: profile.name ?? '',
          email: profile.email,
          image: profile.picture ?? '',
        };
      },
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const { email, password } = credentials as {
          email: string;
          password: string;
        };

        if (!email || !password) {
          throw new Error('Email and password are required');
        }

        const users = await getUser(email);
        if (users.length === 0) return null;

        const user = users[0] as UserData;
        if (!user.password) {
          throw new Error('User password is missing');
        }

        const passwordsMatch = await compare(password, user.password);
        if (!passwordsMatch) return null;

        return {
          id: user.id,
          email: user.email,
          // Use empty strings for name and image since they don't exist in DB
          name: '',
          image: '',
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === 'google' && profile) {
        if (!profile.email) {
          return false;
        }

        // Check if user exists
        const existingUsers = await getUser(profile.email);

        // This is a new user, we should send a welcome email
        const isNewUser = existingUsers.length === 0;

        if (isNewUser) {
          // Create new user for Google sign-in without storing name/image
          const newUserResult = await createUser(profile.email, null);

          // Type-safe way to handle the database result
          if (newUserResult && newUserResult.length > 0) {
            const newUser = newUserResult[0];
            // Update the user.id to the newly created database user ID
            user.id = newUser.id;

            // Try sending welcome email directly
            try {
              await sendWelcomeEmail({
                email: profile.email,
                username: profile.name || profile.email.split('@')[0],
                signupMethod: 'google',
              });
            } catch (emailError) {
              console.error(
                'Failed to send welcome email directly:',
                emailError,
              );

              // Fallback to API route if direct sending fails
              try {
                const baseUrl =
                  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
                await fetch(`${baseUrl}/api/email/welcome`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: profile.email,
                    username: profile.name || profile.email.split('@')[0],
                    signupMethod: 'google',
                  }),
                });
              } catch (fetchError) {
                console.error(
                  'Failed to send welcome email via API:',
                  fetchError,
                );
              }
            }
          } else {
            throw new Error('Failed to create user: Invalid database response');
          }
        } else if (
          existingUsers.length > 0 &&
          user.id !== existingUsers[0].id
        ) {
          // If user exists with same email but different ID,
          // we need to update chats to point to the existing user account

          // Use a direct database query to update chats' user_id
          if (user.id) {
            await linkUserChats(user.id, existingUsers[0].id);
          } else {
            throw new Error('User ID is undefined');
          }

          // Update the user ID to the existing one
          user.id = existingUsers[0].id;
          // The profile name/image stay in the user object from Google's profile data
        }
        return true;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        // Initial sign-in
        token.id = user.id;
        token.email = user.email;
        token.name = user.name ?? ''; // From OAuth profile or empty string
        token.image = user.image ?? ''; // From OAuth profile or empty string
      }
      if (account?.provider === 'google') {
        token.provider = 'google';
        token.accessToken = account.access_token ?? '';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string; // From token, not DB
        session.user.image = token.image as string; // From token, not DB
        session.user.provider = token.provider as string | undefined;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt', // Use JWT for session management
  },
  secret: getEnvVariable('AUTH_SECRET'), // Ensure a secure secret is set
  debug: process.env.NODE_ENV === 'development', // Enable debug mode in development
});

// Auth middleware function to use in our main middleware
export async function authMiddleware(request: NextRequest) {
  const session = await auth();

  // If the user is not authenticated and trying to access a protected route
  if (!session) {
    const url = new URL('/api/auth/signin', request.url);
    url.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Re-export the auth configuration
export const config = authConfig;
