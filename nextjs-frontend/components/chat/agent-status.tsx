'use client';

/**
 * Agent Status Component - Shows current AI agent activity
 */

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  BookOpenIcon,
  BrainIcon,
  CodeIcon,
  FileIcon,
  ImageIcon,
  Loader2Icon,
  SearchIcon,
  SparklesIcon,
} from 'lucide-react';

import { TextShimmer } from '../ui/text-shimmer';
import { AttmaMark, useElapsedSeconds } from './attma-mark';

export interface AgentStatusProps {
  isActive: boolean;
  /** The running step in plain words, from describeStep. */
  currentAction?: string;
  model?: string;
  className?: string;
}

const TOOL_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  pubmed_search: SearchIcon,
  semantic_scholar: BookOpenIcon,
  gene_lookup: SparklesIcon,
  firecrawl_search: SearchIcon,
  create_code_artifact: CodeIcon,
  image_generation: ImageIcon,
  createDocument: FileIcon,
  default: BrainIcon,
};

function ToolIcon({ tool, className }: { tool?: string; className?: string }) {
  const Icon = (tool && TOOL_ICONS[tool]) || TOOL_ICONS.default;
  return <Icon className={className} />;
}

/**
 * The working pill above the composer: Attma's turning helix, the current step in plain words,
 * an elapsed timer and the model. It sits on a neutral surface, because in Attma only results
 * carry colour; the helix is the one accent and the only thing that moves.
 */
export function AgentStatus({
  isActive,
  currentAction,
  model,
  className,
}: AgentStatusProps) {
  // The pill mounts when a run starts, so time since mount is the run's elapsed time.
  const seconds = useElapsedSeconds();
  if (!isActive) return null;

  return (
    <div
      role="status"
      className={cn(
        'flex h-8 max-w-full items-center gap-2.5 rounded-full border border-border bg-popover/90 pl-2.5 pr-3 shadow-sm backdrop-blur-sm',
        'text-xs text-muted-foreground',
        className,
      )}
    >
      <AttmaMark working />
      <TextShimmer
        as="span"
        duration={2.5}
        className="max-w-[18rem] truncate font-medium"
      >
        {currentAction ?? 'Working'}
      </TextShimmer>
      <span className="tabular-nums">{seconds}s</span>
      {model && (
        <>
          <span aria-hidden className="size-0.5 rounded-full bg-border" />
          <span>{formatModelName(model)}</span>
        </>
      )}
    </div>
  );
}

function formatToolName(tool: string): string {
  const names: Record<string, string> = {
    pubmed_search: 'PubMed Search',
    semantic_scholar: 'Semantic Scholar',
    gene_lookup: 'Gene Lookup',
    firecrawl_search: 'Web Search',
    create_code_artifact: 'Code Generation',
    image_generation: 'Generating Image',
    createDocument: 'Creating Document',
  };
  return names[tool] || tool;
}

function formatModelName(model: string): string {
  const names: Record<string, string> = {
    'gpt-4o-mini': 'Fast',
    'gpt-4o': 'Advanced',
    'o3-mini': 'Reasoning',
    'chat-model': 'Muse Spark',
    'chat-model-standard': 'Muse Wonder',
    'chat-model-reasoning': 'Muse Wonder · deep',
  };
  return names[model] || model;
}

interface AgentAction {
  id: string;
  tool: string;
  status: 'running' | 'complete' | 'error';
  result?: string;
  duration?: number;
}

interface AgentActionsProps {
  actions: AgentAction[];
  className?: string;
}

export function AgentActions({ actions, className }: AgentActionsProps) {
  if (actions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        'flex flex-col gap-1 px-3 py-2 rounded-lg',
        'bg-muted/30 border border-muted',
        'text-xs',
        className,
      )}
    >
      {actions.map((action, index) => {
        return (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-2"
          >
            {action.status === 'running' ? (
              <Loader2Icon className="h-3 w-3 animate-spin text-blue-400" />
            ) : action.status === 'complete' ? (
              <ToolIcon tool={action.tool} className="h-3 w-3 text-green-400" />
            ) : (
              <ToolIcon tool={action.tool} className="h-3 w-3 text-red-400" />
            )}
            <span
              className={cn(
                action.status === 'running' && 'text-blue-300',
                action.status === 'complete' && 'text-muted-foreground',
                action.status === 'error' && 'text-red-400',
              )}
            >
              {formatToolName(action.tool)}
            </span>
            {action.duration && (
              <span className="text-muted-foreground ml-auto">
                {action.duration}ms
              </span>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export default AgentStatus;
