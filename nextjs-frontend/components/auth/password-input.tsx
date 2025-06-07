'use client';

import { useState, InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  showStrengthIndicator?: boolean;
}

export function PasswordInput({
  id,
  name,
  placeholder = '••••••••',
  required = false,
  minLength = 6,
  autoComplete = 'current-password',
  showStrengthIndicator = false,
  defaultValue = '',
  className = '',
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState(defaultValue);

  return (
    <div className="relative w-full">
      <input
        id={id}
        name={name} // Keep the name attribute here
        type={showPassword ? 'text' : 'password'}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className={`w-full px-3 py-2.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:border-[#25C6A3] pr-10 focus:outline-hidden transition-all duration-300 ${className}`}
        onChange={(e) => setPassword(e.target.value)}
        value={password}
        {...props}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-200 transition-colors"
        onClick={() => setShowPassword(!showPassword)}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
