'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { LogoGoogle } from '../icons';

interface GoogleSignInButtonProps {
  className?: string;
  callbackUrl?: string;
  buttonText?: string;
}

export function GoogleSignInButton({
  className = '',
  callbackUrl = '/chat',
  buttonText = 'Continue with Google',
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    // Prevent form submission
    e.preventDefault();

    try {
      setIsLoading(true);
      await signIn('google', { callbackUrl });
    } catch (error) {
      console.error('Error signing in with Google:', error);
      toast.error('Failed to sign in with Google');
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      // Explicitly make this NOT a submit button
      type="button"
      className={`flex h-10 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 text-sm font-medium text-zinc-600 dark:text-zinc-200 transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#25C6A3] focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-900 disabled:opacity-70 disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <div className="size-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <LogoGoogle size={18} />
      )}
      <span>{buttonText}</span>
    </button>
  );
}
