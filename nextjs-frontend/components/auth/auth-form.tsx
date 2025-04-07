import type { ReactNode } from 'react';

interface AuthFormProps {
  action: (formData: FormData) => void;
  defaultEmail?: string;
  isRegister?: boolean;
  isLoading?: boolean;
  isSuccessful?: boolean;
  children?: ReactNode;
}

export function AuthForm({
  action,
  defaultEmail = '',
  isRegister = false,
  children,
}: AuthFormProps) {
  return (
    <form
      action={action}
      className="flex flex-col gap-6 px-6 py-8 sm:px-16 rounded-xl bg-zinc-800/70 dark:bg-zinc-900/40 backdrop-blur-sm border border-zinc-700/50 shadow-xl"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-zinc-300 dark:text-zinc-400">
          Email Address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="user@example.com"
          autoComplete="email"
          required
          defaultValue={defaultEmail}
          className="w-full px-3 py-2 rounded-md bg-zinc-900/50 dark:bg-zinc-800/50 border border-zinc-700 focus:border-[#25C6A3] focus:outline-none transition-all duration-300"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-zinc-300 dark:text-zinc-400">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          required
          minLength={8}
          className="w-full px-3 py-2 rounded-md bg-zinc-900/50 dark:bg-zinc-800/50 border border-zinc-700 focus:border-[#25C6A3] focus:outline-none transition-all duration-300"
        />
      </div>

      {children}
    </form>
  );
}
