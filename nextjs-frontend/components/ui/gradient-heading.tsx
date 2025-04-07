'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { getTextGradient } from '@/lib/design-tokens';
import type { TEXT_GRADIENTS } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

interface GradientHeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  gradient?: keyof typeof TEXT_GRADIENTS;
  children: React.ReactNode;
}

export function GradientHeading({
  as: Component = 'h2',
  gradient = 'elegant',
  children,
  className,
  ...props
}: GradientHeadingProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Only show gradient after component has mounted on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Use a neutral color during SSR and initial mount
  const initialTextColor = 'text-foreground';

  // Calculate appropriate text color based on theme to ensure visibility
  const combinedClassName = cn(
    // Base styles that are consistent between SSR and CSR
    'transition-colors duration-200',
    // Use neutral color initially, then apply gradient after mount
    mounted
      ? getTextGradient(gradient, resolvedTheme as 'light' | 'dark')
      : initialTextColor,
    // Apply other classNames
    className,
  );

  return (
    <Component className={combinedClassName} {...props}>
      {children}
    </Component>
  );
}
