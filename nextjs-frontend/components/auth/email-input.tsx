'use client';

import { useState, InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { isValidEmail } from '@/lib/utils';

interface EmailInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function EmailInput({ className = '', ...props }: EmailInputProps) {
  const [email, setEmail] = useState(props.defaultValue || '');
  const [isFocused, setIsFocused] = useState(false);

  const showValidIndicator =
    typeof email === 'string' && email.length > 0 && isValidEmail(email);

  return (
    <div className="relative w-full">
      <input
        type="email"
        className={`w-full px-3 py-2.5 rounded-md bg-white dark:bg-zinc-800 border 
          ${showValidIndicator ? 'border-green-500' : 'border-zinc-300 dark:border-zinc-700'}
          ${isFocused ? 'border-[#25C6A3]' : ''}
          pr-10 focus:outline-hidden transition-all duration-300 ${className}`}
        onChange={(e) => setEmail(e.target.value)}
        value={email}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
      {showValidIndicator && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <Check size={18} className="text-green-500" />
        </div>
      )}
    </div>
  );
}
