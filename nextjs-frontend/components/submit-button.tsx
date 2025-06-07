'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 transition-all duration-300 relative overflow-hidden group',
  {
    variants: {
      variant: {
        default: 'bg-[#25C6A3] text-white hover:bg-[#25C6A3]/90',
        outline: 'border border-[#25C6A3] text-[#25C6A3] hover:bg-[#25C6A3]/10',
        ghost: 'text-[#25C6A3] hover:bg-[#25C6A3]/10',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface SubmitButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isSuccessful?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  successText?: string;
}

export function SubmitButton({
  className,
  variant,
  size,
  isSuccessful = false,
  isLoading = false,
  loadingText = 'Processing...',
  successText = 'Success!',
  children,
  disabled,
  ...props
}: SubmitButtonProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isSuccessful) {
      setShowSuccess(true);
      timeout = setTimeout(() => {
        setShowSuccess(false);
      }, 2000);
    }
    return () => clearTimeout(timeout);
  }, [isSuccessful]);

  return (
    <button
      className={cn(
        buttonVariants({ variant, size }),
        'w-full',
        { 'cursor-not-allowed': disabled || isLoading || showSuccess },
        className,
      )}
      disabled={disabled || isLoading || showSuccess}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" />
          {loadingText}
        </>
      ) : showSuccess ? (
        <>
          <CheckCircle2 className="mr-2 size-4 animate-appear" />
          {successText}
        </>
      ) : (
        <>
          {children}
          <span className="absolute inset-0 size-full bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </>
      )}
    </button>
  );
}
