/**
 * Reasoning Block Component - Shows AI thinking in collapsible format
 */

'use client';

import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, ChevronDown, Sparkles } from 'lucide-react';
import { memo, useState } from 'react';
import { Markdown } from './markdown';

export interface ReasoningBlockProps {
  /** The reasoning content to display */
  reasoning: string;
  /** Whether the reasoning is still being streamed */
  isStreaming?: boolean;
  /** Initial expanded state */
  defaultExpanded?: boolean;
  /** Custom className for the container */
  className?: string;
}

const containerVariants = {
  collapsed: {
    opacity: 1,
    height: 'auto',
  },
  expanded: {
    opacity: 1,
    height: 'auto',
  },
};

const contentVariants = {
  collapsed: {
    opacity: 0,
    height: 0,
    marginTop: 0,
  },
  expanded: {
    opacity: 1,
    height: 'auto',
    marginTop: 12,
  },
};

function ThinkingIndicator({ isStreaming }: { isStreaming: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'relative flex items-center justify-center',
          isStreaming && 'animate-pulse',
        )}
      >
        <Brain className="size-4 text-primary-ink" />
        {isStreaming && (
          <motion.div
            className="absolute inset-0 rounded-full bg-primary/20"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </div>
      <span
        className={cn(
          'text-sm font-medium',
          isStreaming ? 'text-primary-ink' : 'text-muted-foreground',
        )}
      >
        {isStreaming ? 'Thinking...' : 'Reasoning'}
      </span>
      {isStreaming && (
        <Sparkles className="size-3 text-primary-ink animate-pulse" />
      )}
    </div>
  );
}

/** Chevron with rotation animation */
function ExpandChevron({ isExpanded }: { isExpanded: boolean }) {
  return (
    <motion.div
      animate={{ rotate: isExpanded ? 180 : 0 }}
      transition={{ duration: 0.2 }}
    >
      <ChevronDown className="size-4 text-muted-foreground" />
    </motion.div>
  );
}

function PureReasoningBlock({
  reasoning,
  isStreaming = false,
  defaultExpanded = false,
  className,
}: ReasoningBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Don't render if there's no reasoning content
  if (!reasoning || reasoning.trim().length === 0) {
    return null;
  }

  return (
    <motion.div
      className={cn(
        'rounded-lg border border-border/50 bg-muted/30 backdrop-blur-sm',
        'transition-colors hover:border-border',
        className,
      )}
      variants={containerVariants}
      initial="collapsed"
      animate={isExpanded ? 'expanded' : 'collapsed'}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex w-full items-center justify-between px-3 py-2',
          'rounded-lg transition-colors',
          'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20',
        )}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Collapse reasoning' : 'Expand reasoning'}
      >
        <ThinkingIndicator isStreaming={isStreaming} />
        <ExpandChevron isExpanded={isExpanded} />
      </button>

      {/* Reasoning Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="reasoning-content"
            variants={contentVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'px-3 pb-3',
                'prose prose-sm dark:prose-invert max-w-none',
                'prose-p:text-muted-foreground prose-p:leading-relaxed',
                'prose-headings:text-foreground prose-headings:font-medium',
                'prose-code:text-xs prose-code:bg-muted prose-code:rounded',
                'prose-pre:bg-muted prose-pre:border prose-pre:border-border/50',
              )}
            >
              <div className="border-t border-border/30 pt-3">
                <Markdown>{reasoning}</Markdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export const ReasoningBlock = memo(PureReasoningBlock);

// Re-export for convenience
export type { ReasoningBlockProps as ReasoningBlockPropsType };
