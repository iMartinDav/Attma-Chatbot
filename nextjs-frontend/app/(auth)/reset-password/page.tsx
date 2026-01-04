'use client';

import { PasswordInput } from '@/components/auth/password-input';
import { SubmitButton } from '@/components/ui/submit-button';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';
import { Suspense, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

// Loading component to show while suspense is active
function LoadingState() {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-linear-to-br from-white to-zinc-200 dark:from-black dark:to-zinc-900">
      <div className="text-center">
        <div className="size-16 border-4 border-t-[#25C6A3] border-x-transparent border-b-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    </div>
  );
}

// Separate component for the password reset form
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Redirect if no token is provided
  useEffect(() => {
    if (!token) {
      router.push('/forgot-password');
    }
  }, [token, router]);

  // Don't render the form if there's no token
  if (!token) {
    return null;
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!formRef.current) return;

    const formData = new FormData(formRef.current);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            password,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          toast.success('Password reset successful!');
          router.push('/login');
        } else {
          setError(data.error || 'Failed to reset password. Please try again.');
        }
      } catch (err) {
        console.error('Password reset error:', err);
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
                Create New
              </span>
            </h1>
            <div className="relative inline-flex items-center justify-center">
              <span
                className="text-7xl md:text-8xl font-black relative z-10
                bg-linear-to-r from-[#25C6A3] via-[#4EF9DB] to-[#25C6A3] bg-clip-text text-transparent
                animate-text-shine tracking-tight"
              >
                Password
              </span>
              <div className="absolute -inset-1 blur-xs bg-[#25C6A3] opacity-5" />
            </div>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-xs mx-auto">
            Enter your new password below
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

            <div className="flex flex-col gap-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-zinc-600 dark:text-zinc-300"
              >
                New Password
              </label>
              <PasswordInput id="password" name="password" required />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="confirmPassword"
                className="text-sm font-medium text-zinc-600 dark:text-zinc-300"
              >
                Confirm Password
              </label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                required
              />
            </div>

            <SubmitButton
              type="submit"
              variant="default"
              isLoading={isPending}
              loadingText="Resetting..."
              disabled={isPending}
            >
              Reset Password
            </SubmitButton>

            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              <Link
                href="/login"
                className="font-semibold text-[#25C6A3] hover:text-black dark:hover:text-white transition-colors"
              >
                Back to login
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

// Main component with Suspense boundary
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
