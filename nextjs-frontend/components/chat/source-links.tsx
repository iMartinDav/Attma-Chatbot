'use client';

import { ExternalLinkIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

interface SourceLink {
  url: string;
  title: string;
}

export function SourceLinks({ sources }: { sources: SourceLink[] }) {
  if (!sources || sources.length === 0) return null;

  // Process and deduplicate sources
  const uniqueSources = sources
    .filter(
      (source) =>
        source.url &&
        typeof source.url === 'string' &&
        source.url.startsWith('http'),
    )
    .filter(
      (source, index, self) =>
        index === self.findIndex((s) => s.url === source.url),
    )
    .slice(0, 8); // Limit to 8 sources max

  if (uniqueSources.length === 0) return null;

  return (
    <motion.div
      className="flex flex-col w-full mt-3"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Sources
      </div>
      <div className="flex flex-wrap gap-2">
        {uniqueSources.map((source, index) => (
          <Tooltip key={source.url}>
            <TooltipTrigger asChild>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-normal 
                  rounded-full border border-zinc-200 dark:border-zinc-800 bg-background/80
                  hover:bg-accent/20 shadow-xs max-w-[200px] transition-colors no-underline text-foreground"
              >
                <span
                  className="inline-flex items-center justify-center size-4 mr-1 text-xs 
                  rounded-full bg-muted/50"
                >
                  [{index + 1}]
                </span>
                <span className="truncate">
                  {getDisplayTitle(source.title || getHostname(source.url))}
                </span>
                <ExternalLinkIcon className="size-3 opacity-70 shrink-0" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="max-w-xs">
              <p className="break-all text-xs">{source.url}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </motion.div>
  );
}

// Helper function to extract hostname from URL for better display
function getHostname(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname;
  } catch (e) {
    return 'Source';
  }
}

// Helper function to format title for display
function getDisplayTitle(title: string): string {
  if (!title) return 'Source';
  // Clean up and limit length
  const trimmedTitle = title.trim();
  return trimmedTitle.length > 30
    ? `${trimmedTitle.substring(0, 30)}...`
    : trimmedTitle;
}
