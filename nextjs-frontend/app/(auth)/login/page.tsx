'use client';

import { EmailInput } from '@/components/auth/email-input';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { PasswordInput } from '@/components/auth/password-input';
import { SubmitButton } from '@/components/ui/submit-button';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';
import { Suspense, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

// Only same-site paths are followed after sign-in.
const safeCallback = (value: string | null) =>
  value?.startsWith('/') && !value.startsWith('//') ? value : '/chat';

function LoginForm() {
  const router = useRouter();
  const callbackUrl = safeCallback(useSearchParams().get('callbackUrl'));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!formRef.current) return;

    const formData = new FormData(formRef.current);
    startTransition(async () => {
      try {
        // Remove debug logging in production
        const result = await signIn('credentials', {
          email: formData.get('email') as string,
          password: formData.get('password') as string,
          redirect: false,
        });

        if (result?.ok) {
          toast.success('Login successful!');
          // Replace setTimeout with a proper navigation after session is confirmed
          router.push(callbackUrl);
          router.refresh();
        } else {
          setError(
            result?.error || 'Invalid email or password. Please try again.',
          );
        }
      } catch (err) {
        console.error('Login error:', err);
        setError('An unexpected error occurred. Please try again.');
      }
    });
  };

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-linear-to-br from-white to-zinc-200 dark:from-black dark:to-zinc-900 text-black dark:text-white relative px-4">
      <div className="w-full max-w-sm md:max-w-md overflow-hidden rounded-2xl flex flex-col gap-8">
        {/* Logo and branding */}
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <div className="relative">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-2">
              <span className="bg-clip-text text-transparent bg-linear-to-r from-black to-zinc-600 dark:from-white dark:to-zinc-400">
                Welcome to
              </span>
            </h1>
            <div className="relative inline-flex items-center justify-center">
              <span
                className="text-7xl md:text-8xl font-black relative z-10
                bg-linear-to-r from-[#25C6A3] via-[#4EF9DB] to-[#25C6A3] bg-clip-text text-transparent
                animate-text-shine tracking-tight"
              >
                Attma
              </span>
              <div className="absolute -inset-1 blur-xs bg-[#25C6A3] opacity-5" />
            </div>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-xs mx-auto">
            Enter your credentials to access your account
          </p>
        </div>

        {/* Form section */}
        <div className="backdrop-blur-xs rounded-xl overflow-hidden">
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex flex-col gap-6 p-6 md:p-8 rounded-xl bg-white/70 dark:bg-zinc-900/40 border border-zinc-300 dark:border-zinc-700/50 shadow-xl"
          >
            {error && (
              <div className="bg-[#25C6A3]/10 border border-[#25C6A3]/40 text-black dark:text-white p-4 rounded-md text-sm">
                <p className="text-[#25C6A3]">{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <GoogleSignInButton
                buttonText="Continue with Google"
                callbackUrl={callbackUrl}
              />

              <div className="relative flex items-center justify-center gap-2">
                <div className="flex-1 border-t border-dashed border-zinc-300 dark:border-zinc-700" />
                <span className="text-xs uppercase text-zinc-600 dark:text-zinc-400">
                  Or continue with email
                </span>
                <div className="flex-1 border-t border-dashed border-zinc-300 dark:border-zinc-700" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-zinc-600 dark:text-zinc-300"
              >
                Email Address
              </label>
              <EmailInput id="email" name="email" required />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-zinc-600 dark:text-zinc-300"
              >
                Password
              </label>
              <PasswordInput id="password" name="password" required />
            </div>

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <SubmitButton
              type="submit"
              variant="default"
              isLoading={isPending}
              loadingText="Signing in..."
              disabled={isPending}
            >
              Log in
            </SubmitButton>

            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              {"Don't have an account? "}
              <Link
                href="/register"
                className="font-semibold text-[#25C6A3] hover:text-black dark:hover:text-white transition-colors"
              >
                Sign up
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary for the static render.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
