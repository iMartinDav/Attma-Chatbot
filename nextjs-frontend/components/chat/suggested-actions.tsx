'use client';

import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import type { ChatRequestOptions, CreateMessage, Message } from 'ai';
import { memo } from 'react';
import {
  ChartScatter,
  Dna,
  Virus,
  Atom,
  Brain,
  Gauge,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { IconWeight } from '@phosphor-icons/react';

interface SuggestedActionsProps {
  chatId: string;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
}

interface SuggestedAction {
  title: string;
  label: string;
  action: string;
  icon: Icon;
  gradientFrom: string;
  gradientTo: string;
  iconWeight: IconWeight;
}

function PureSuggestedActions({ chatId, append }: SuggestedActionsProps) {
  const suggestedActions: SuggestedAction[] = [
    {
      title: 'Mitochondrial Analysis',
      label: 'Distribution of MT Genes',
      action:
        'Generate a violin plot showing the distribution of mitochondrial gene percentages across all cells, and highlight any potential outliers or patterns in the data.',
      icon: Atom,
      gradientFrom: 'from-emerald-500',
      gradientTo: 'to-teal-500',
      iconWeight: 'duotone',
    },
    {
      title: 'PCA Visualization',
      label: 'Principal Components',
      action:
        'Perform PCA analysis on the dataset, create visualization plots including the PCA scatter plot, heatmap, and elbow plot to show variance explained by principal components.',
      icon: ChartScatter,
      gradientFrom: 'from-violet-500',
      gradientTo: 'to-purple-500',
      iconWeight: 'fill',
    },
    {
      title: 'Quality Assessment',
      label: 'RNA & Feature Metrics',
      action:
        'Create a comprehensive quality assessment of the cells, including a scatter plot of RNA counts vs detected features, and highlight key quality metrics.',
      icon: Gauge,
      gradientFrom: 'from-sky-500',
      gradientTo: 'to-blue-500',
      iconWeight: 'duotone',
    },
    {
      title: 'Variable Genes',
      label: 'Feature Selection',
      action:
        'Identify and visualize highly variable genes in the dataset with appropriate scaling, and explain their biological significance.',
      icon: Dna,
      gradientFrom: 'from-amber-500',
      gradientTo: 'to-orange-500',
      iconWeight: 'duotone',
    },
    {
      title: 'Cluster Analysis',
      label: 'UMAP & Markers',
      action:
        'Generate UMAP visualization for dimensionality reduction, identify cell clusters, and analyze marker genes for each cluster.',
      icon: Brain,
      gradientFrom: 'from-rose-500',
      gradientTo: 'to-pink-500',
      iconWeight: 'duotone',
    },
    {
      title: 'Expression Patterns',
      label: 'Dot Plot View',
      action:
        'Create an informative dot plot to visualize gene expression patterns across different cell populations or conditions.',
      icon: Virus,
      gradientFrom: 'from-indigo-500',
      gradientTo: 'to-blue-500',
      iconWeight: 'duotone',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl mx-auto px-4">
      {suggestedActions.map((action, index) => (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${action.title}-${index}`}
        >
          <Button
            variant="ghost"
            onClick={() => {
              window.history.replaceState({}, '', `/chat/${chatId}`);
              append({
                role: 'user',
                content: action.action,
              });
            }}
            className="relative size-full min-h-[100px] p-4 overflow-hidden group
                     border border-primary/10 rounded-xl hover:border-primary/30
                     transition-all duration-300 ease-in-out"
          >
            {/* Improved gradient background with better opacity handling */}
            <div
              className={`absolute inset-0 opacity-5 bg-gradient-to-br ${action.gradientFrom} ${action.gradientTo} group-hover:opacity-10 transition-opacity duration-300 ease-in-out`}
            />

            <div className="relative flex flex-col items-start gap-2 text-left w-full">
              <div className="flex items-center gap-2">
                {/* Enhanced icon container with more sophisticated gradient */}
                <div
                  className={`p-1.5 rounded-md bg-gradient-to-br ${action.gradientFrom} ${action.gradientTo} shadow-sm`}
                >
                  <action.icon
                    className="size-4 text-white"
                    weight={action.iconWeight}
                    size={16}
                  />
                </div>
                <span className="font-semibold text-primary">
                  {action.title}
                </span>
              </div>
              <span className="text-xs text-muted-foreground line-clamp-2">
                {action.label}
              </span>
            </div>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions, () => true);
