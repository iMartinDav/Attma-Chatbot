'use client';

import { EmailInput } from '@/components/auth/email-input';
import { SubmitButton } from '@/components/ui/submit-button';
import Link from 'next/link';
import type { FormEvent } from 'react';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!formRef.current) return;

    const formData = new FormData(formRef.current);
    const email = formData.get('email') as string;

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (response.ok) {
          setSuccess(true);
          toast.success('Password reset link sent to your email!');
        } else {
          setError(
            data.error || 'Failed to send reset link. Please try again.',
          );
        }
      } catch (err) {
        console.error('Reset password error:', err);
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
                Reset Password
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
            Enter your email to receive a password reset link
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

            {success ? (
              <div className="bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-800 text-black dark:text-white p-4 rounded-md text-sm">
                <p className="text-green-700 dark:text-green-400">
                  Reset link sent! Please check your email inbox.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-zinc-600 dark:text-zinc-300"
                  >
                    Email Address
                  </label>
                  <EmailInput id="email" name="email" required />
                </div>

                <SubmitButton
                  type="submit"
                  variant="default"
                  isLoading={isPending}
                  loadingText="Sending..."
                  disabled={isPending}
                >
                  Send Reset Link
                </SubmitButton>
              </>
            )}

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
