'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, useRef } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { signIn } from 'next-auth/react';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { EmailInput } from '@/components/auth/email-input';
import { PasswordInput } from '@/components/auth/password-input';
import { SubmitButton } from '@/components/submit-button';

export default function RegisterPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!formRef.current) return;

    const formData = new FormData(formRef.current);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    startTransition(async () => {
      try {
        // Register the user
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to create account. Please try again.');
          return;
        }

        // If registration successful, sign them in
        const signInResult = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });

        if (signInResult?.ok) {
          toast.success('Account created successfully!');
          router.push('/chat');
          router.refresh();
        } else {
          setError('Account created, but failed to sign in automatically.');
        }
      } catch (err) {
        console.error('Registration error:', err);
        setError('An unexpected error occurred. Please try again.');
      }
    });
  };

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-gradient-to-br from-white to-zinc-200 dark:from-black dark:to-zinc-900 text-black dark:text-white relative px-4">
      <div className="w-full max-w-sm md:max-w-md overflow-hidden rounded-2xl flex flex-col gap-8">
        {/* Logo and branding */}
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <div className="relative">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-black to-zinc-600 dark:from-white dark:to-zinc-400">
                Join
              </span>
            </h1>
            <div className="relative inline-flex items-center justify-center">
              <span
                className="text-7xl md:text-8xl font-black relative z-10
                bg-gradient-to-r from-[#25C6A3] via-[#4EF9DB] to-[#25C6A3] bg-clip-text text-transparent
                animate-text-shine tracking-tight"
              >
                Attma
              </span>
              <div className="absolute -inset-1 blur-sm bg-[#25C6A3] opacity-5" />
            </div>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-xs mx-auto">
            Create an account to get started
          </p>
        </div>

        {/* Form section */}
        <div className="backdrop-blur-sm rounded-xl overflow-hidden">
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex flex-col gap-6 p-6 md:p-8 rounded-xl bg-white/70 dark:bg-zinc-900/40 border border-zinc-300 dark:border-zinc-700/50 shadow-xl"
          >
            {/* Display any registration errors at the top of the form */}
            {error && (
              <div className="bg-[#25C6A3]/10 border border-[#25C6A3]/40 text-black dark:text-white p-4 rounded-md text-sm">
                <p className="text-[#25C6A3]">{error}</p>
              </div>
            )}

            {/* Google Sign-up button - Note this is type="button" */}
            <div className="flex flex-col gap-4">
              <GoogleSignInButton
                buttonText="Sign up with Google"
                callbackUrl="/chat"
              />

              <div className="relative flex items-center justify-center gap-2">
                <div className="flex-1 border-t border-dashed border-zinc-300 dark:border-zinc-700" />
                <span className="text-xs uppercase text-zinc-600 dark:text-zinc-400">
                  Or register with email
                </span>
                <div className="flex-1 border-t border-dashed border-zinc-300 dark:border-zinc-700" />
              </div>
            </div>

            {/* Email field */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-zinc-600 dark:text-zinc-300"
              >
                Email Address
              </label>
              <EmailInput id="email" name="email" required />
            </div>

            {/* Password field */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-zinc-600 dark:text-zinc-300"
              >
                Password
              </label>
              <PasswordInput
                id="password"
                name="password"
                required
                showStrengthIndicator
                autoComplete="new-password"
              />
            </div>

            {/* Submit button - Explicit type="submit" */}
            <SubmitButton
              type="submit"
              variant="default"
              isLoading={isPending}
              loadingText="Creating account..."
              disabled={isPending}
            >
              Create account
            </SubmitButton>

            {/* Sign in link */}
            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              {'Already have an account? '}
              <Link
                href="/login"
                className="font-semibold text-[#25C6A3] hover:text-black dark:hover:text-white transition-colors"
              >
                Log in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
