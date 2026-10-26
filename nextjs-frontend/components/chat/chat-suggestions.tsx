'use client';

import { DEMO_CASES, demoPrompt } from '@/lib/rare-disease/demo-cases';
import { motion } from 'framer-motion';
import {
  AgentBioinformaticsIcon,
  AgentVariantIcon,
  PaperclipIcon,
} from '../icons';

interface ChatSuggestionsProps {
  onSelect: (text: string) => void;
  onUpload?: () => void;
}

export function ChatSuggestions({ onSelect, onUpload }: ChatSuggestionsProps) {
  const suggestions = [
    ...DEMO_CASES.map((demo) => ({
      label: demo.title,
      icon: (
        <div className="w-4 h-4 text-primary">
          <AgentVariantIcon />
        </div>
      ),
      action: () => onSelect(demoPrompt(demo)),
    })),
    {
      label: 'Find recent CRISPR papers',
      icon: (
        <div className="w-4 h-4 text-blue-400">
          <AgentBioinformaticsIcon />
        </div>
      ),
      action: () =>
        onSelect(
          'Search PubMed for recent CRISPR-Cas9 papers and summarize key findings',
        ),
    },
    {
      label: 'Upload PDF to analyze',
      icon: (
        <div className="w-4 h-4 text-orange-400">
          <PaperclipIcon />
        </div>
      ),
      action: onUpload,
    },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-2xl px-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
      {suggestions.map((suggestion, index) => (
        <motion.button
          key={index}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 * index }}
          onClick={suggestion.action}
          className="flex items-center gap-2 px-4 py-2 bg-muted/30 hover:bg-muted/60 border border-border/40 hover:border-border rounded-xl text-sm text-foreground/80 transition-all hover:scale-105"
        >
          {suggestion.icon}
          <span>{suggestion.label}</span>
        </motion.button>
      ))}
    </div>
  );
}
