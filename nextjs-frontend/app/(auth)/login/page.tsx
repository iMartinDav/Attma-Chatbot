'use client';

import { LogoGoogle } from '@/components/icons';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';
import { Suspense, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

// A static SVG helix replaces a Lottie player: same look on the login panel without a 300 KB runtime or a JSON fetch.
const HELIX_STEPS = Array.from({ length: 25 }, (_, i) => {
  const y = 40 + i * 13;
  const x = 80 * Math.sin(i * 0.5);
  return { y, left: 200 - x, right: 200 + x };
});
const strand = (side: 'left' | 'right') =>
  HELIX_STEPS.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[side]} ${p.y}`).join(
    ' ',
  );

function HelixArt() {
  return (
    <svg
      viewBox="0 0 400 400"
      aria-hidden="true"
      className="absolute inset-0 m-auto h-3/4 w-3/4 text-primary motion-safe:animate-pulse"
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        {HELIX_STEPS.map((p) => (
          <line
            key={p.y}
            x1={p.left}
            y1={p.y}
            x2={p.right}
            y2={p.y}
            strokeWidth={2}
            opacity={0.35}
          />
        ))}
        <path d={strand('left')} strokeWidth={4} />
        <path d={strand('right')} strokeWidth={4} opacity={0.6} />
      </g>
    </svg>
  );
}

// Only same-site paths are followed after sign-in.
const safeCallback = (value: string | null) =>
  value?.startsWith('/') && !value.startsWith('//') ? value : '/chat';

function LoginForm() {
  const router = useRouter();
  const callbackUrl = safeCallback(useSearchParams().get('callbackUrl'));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    startTransition(async () => {
      try {
        const result = await signIn('credentials', {
          email: formData.get('email') as string,
          password: formData.get('password') as string,
          redirect: false,
        });
        if (result?.ok) {
          toast.success('Login successful!');
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

  const handleGoogle = async () => {
    try {
      setIsGoogleLoading(true);
      await signIn('google', { callbackUrl });
    } catch (err) {
      console.error('Error signing in with Google:', err);
      toast.error('Failed to sign in with Google');
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-6xl overflow-hidden border-0 shadow-2xl md:border dark:border-gray-700 dark:bg-gray-900 transition-all duration-300 rounded-xl bg-card text-card-foreground">
        <div className="grid p-0 md:grid-cols-2">
          <div className="relative hidden bg-muted md:block dark:bg-gray-800">
            <div className="absolute inset-0 bg-gradient-to-br from-[#3DEFD6]/10 via-transparent to-transparent dark:from-[#3DEFD6]/20" />
            <HelixArt />
          </div>

          <div className="p-6 md:p-12">
            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="space-y-8"
              aria-labelledby="login-heading"
              data-testid="login-form"
            >
              <div className="flex flex-col items-center text-center">
                <h1
                  id="login-heading"
                  className="text-3xl font-bold tracking-tight bg-gradient-to-r from-[#3DEFD6] to-[#2BC4B8] bg-clip-text text-transparent"
                >
                  Welcome Back
                </h1>
                <div>
                  <span className="text-5xl font-black tracking-tight bg-gradient-to-r from-[#25C6A3] via-[#4EF9DB] to-[#25C6A3] bg-clip-text text-transparent">
                    Attma
                  </span>
                </div>
                <p className="mt-2 text-balance text-lg text-muted-foreground dark:text-gray-300">
                  Sign in to your account to continue
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive animate-in fade-in-50 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800"
                >
                  <AlertCircle
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    <strong className="block">Login Failed</strong>
                    {error}
                  </span>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium dark:text-gray-300"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    disabled={isPending}
                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3DEFD6] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-400 transition-all duration-300"
                    autoComplete="email"
                    aria-required="true"
                    data-testid="email-input"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center">
                    <label
                      htmlFor="password"
                      className="text-sm font-medium dark:text-gray-300"
                    >
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="ml-auto text-sm text-[#3DEFD6] hover:text-[#2CD9BA] hover:underline transition-colors"
                      aria-label="Forgot Password"
                      data-testid="forgot-password"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      disabled={isPending}
                      className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3DEFD6] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white pr-10 transition-all duration-300"
                      autoComplete="current-password"
                      aria-required="true"
                      data-testid="password-input"
                    />
                    <button
                      type="button"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent dark:hover:bg-transparent dark:text-gray-400 dark:hover:text-white inline-flex items-center justify-center rounded-md text-sm font-medium"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      data-testid="toggle-password-visibility"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full h-12 items-center justify-center rounded-md text-sm bg-gradient-to-r from-[#3DEFD6] to-[#2BC4B8] hover:opacity-90 transition-opacity duration-300 dark:text-gray-900 dark:hover:text-gray-900 dark:font-medium disabled:pointer-events-none disabled:opacity-50"
                  disabled={isPending}
                  data-testid="login-button"
                >
                  {isPending ? (
                    <span className="animate-pulse">Signing in...</span>
                  ) : (
                    'Sign in'
                  )}
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-gray-900 text-muted-foreground dark:text-gray-400">
                      Or continue with
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={isGoogleLoading || isPending}
                    aria-label="Sign in with Google"
                    data-testid="google-login"
                    className="inline-flex h-12 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-[#3DEFD6]/10 hover:border-[#3DEFD6] transition-all duration-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-[#3DEFD6]/20 dark:text-white dark:hover:text-[#3DEFD6] disabled:pointer-events-none disabled:opacity-50"
                  >
                    {isGoogleLoading ? (
                      <span className="animate-pulse">Opening...</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <LogoGoogle size={20} />
                        <span>Google</span>
                      </span>
                    )}
                  </button>
                </div>

                <p className="text-center text-sm text-muted-foreground dark:text-gray-400">
                  {"Don't have an account? "}
                  <Link
                    href="/register"
                    className="font-medium text-[#3DEFD6] hover:underline transition-all duration-300"
                    data-testid="signup-link"
                  >
                    Sign up
                  </Link>
                </p>
              </div>
            </form>
          </div>
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
