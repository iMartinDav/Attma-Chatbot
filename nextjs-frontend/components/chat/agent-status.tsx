'use client';

/**
 * Agent Status Component - Shows current AI agent activity
 */

import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
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

export interface AgentStatusProps {
  isActive: boolean;
  currentAction?: string;
  currentTool?: string;
  model?: string;
  step?: number;
  totalSteps?: number;
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

export function AgentStatus({
  isActive,
  currentAction,
  currentTool,
  model,
  step,
  totalSteps,
  className,
}: AgentStatusProps) {
  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full',
          'bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-teal-500/10',
          'border border-purple-500/20',
          'backdrop-blur-sm',
          'text-xs text-muted-foreground',
          className,
        )}
      >
        {/* Animated Icon */}
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0"
          >
            <div className="h-4 w-4 rounded-full border border-purple-500/30 border-t-purple-500" />
          </motion.div>
          <ToolIcon tool={currentTool} className="h-3 w-3 text-purple-400" />
        </div>

        {/* Status Text */}
        <span className="font-medium">
          {currentAction ||
            (currentTool
              ? `Using ${formatToolName(currentTool)}...`
              : 'Thinking...')}
        </span>

        {/* Step Counter */}
        {step !== undefined && totalSteps !== undefined && (
          <span className="text-muted-foreground/60 ml-1">
            Step {step}/{totalSteps}
          </span>
        )}

        {/* Model Badge */}
        {model && (
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300">
            {formatModelName(model)}
          </span>
        )}
      </motion.div>
    </AnimatePresence>
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
    'chat-model': 'Standard',
    'chat-model-standard': 'Advanced',
    'chat-model-reasoning': 'Reasoning',
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
              <span className="text-muted-foreground/50 ml-auto">
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
