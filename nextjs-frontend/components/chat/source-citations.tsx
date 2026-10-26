/**
 * Source Citation Components - Displays search sources and citations
 */

'use client';

import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ExternalLink, Globe, Link2 } from 'lucide-react';
import { memo, useMemo, useState } from 'react';

export interface Source {
  url: string;
  title?: string;
  type?: 'url' | 'document';
}

export interface SourceChipProps {
  source: Source;
  index?: number;
  className?: string;
}

export interface SourcePanelProps {
  sources: Source[];
  className?: string;
  defaultExpanded?: boolean;
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Gets a favicon URL for a domain
 */
function getFaviconUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?sz=32&domain=${hostname}`;
  } catch {
    return '';
  }
}

/**
 * Truncates text to a maximum length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function PureSourceChip({ source, index, className }: SourceChipProps) {
  const hostname = useMemo(() => getHostname(source.url), [source.url]);
  const faviconUrl = useMemo(() => getFaviconUrl(source.url), [source.url]);
  const displayTitle = source.title || hostname;

  return (
    <motion.a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full',
        'bg-muted/60 hover:bg-muted border border-border/50',
        'text-xs text-muted-foreground hover:text-foreground',
        'transition-all duration-200 hover:scale-105',
        'focus:outline-none focus:ring-2 focus:ring-primary/20',
        className,
      )}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: (index || 0) * 0.05 }}
      title={displayTitle}
    >
      {/* Favicon */}
      {faviconUrl ? (
        <img
          src={faviconUrl}
          alt=""
          className="size-3.5 rounded-sm"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <Globe className="size-3.5" />
      )}

      {/* Source number badge */}
      {typeof index === 'number' && (
        <span className="flex items-center justify-center size-4 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
          {index + 1}
        </span>
      )}

      {/* Hostname/Title */}
      <span className="max-w-[120px] truncate font-medium">
        {truncate(hostname, 20)}
      </span>

      <ExternalLink className="size-3 opacity-60" />
    </motion.a>
  );
}

export const SourceChip = memo(PureSourceChip);

function PureSourcePanel({
  sources,
  className,
  defaultExpanded = false,
}: SourcePanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Deduplicate sources by URL
  const uniqueSources = useMemo(() => {
    const seen = new Set<string>();
    return (sources ?? []).filter((source) => {
      if (seen.has(source.url)) return false;
      seen.add(source.url);
      return true;
    });
  }, [sources]);

  // Don't render if no sources
  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border/50 bg-muted/20',
        className,
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex w-full items-center justify-between px-3 py-2',
          'rounded-lg transition-colors',
          'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20',
        )}
      >
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Sources</span>
          <span className="text-xs text-muted-foreground">
            ({uniqueSources.length})
          </span>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="size-4 text-muted-foreground" />
        </motion.div>
      </button>

      {/* Collapsed Preview - show first 3 sources */}
      {!isExpanded && uniqueSources.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {uniqueSources.slice(0, 3).map((source, index) => (
            <SourceChip key={source.url} source={source} index={index} />
          ))}
          {uniqueSources.length > 3 && (
            <span className="flex items-center text-xs text-muted-foreground px-2">
              +{uniqueSources.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Expanded List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/30 px-3 py-2">
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {uniqueSources.map((source, index) => (
                  <SourceListItem
                    key={source.url}
                    source={source}
                    index={index}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const SourcePanel = memo(PureSourcePanel);

function SourceListItem({ source, index }: { source: Source; index: number }) {
  const hostname = getHostname(source.url);
  const faviconUrl = getFaviconUrl(source.url);

  return (
    <motion.a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-start gap-3 p-2 rounded-md',
        'hover:bg-muted/50 transition-colors group',
      )}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      {/* Index Badge */}
      <span className="flex-shrink-0 flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-xs font-medium">
        {index + 1}
      </span>

      {/* Favicon */}
      <div className="flex-shrink-0 size-4 mt-0.5">
        {faviconUrl ? (
          <img
            src={faviconUrl}
            alt=""
            className="size-full rounded-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '';
              (e.target as HTMLImageElement).className = 'hidden';
            }}
          />
        ) : (
          <Globe className="size-full text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {source.title || hostname}
        </p>
        <p className="text-xs text-muted-foreground truncate">{hostname}</p>
      </div>

      {/* External Link Icon */}
      <ExternalLink className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </motion.a>
  );
}

export interface InlineSourcesProps {
  sources: Source[];
  className?: string;
}

function PureInlineSources({ sources, className }: InlineSourcesProps) {
  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5 mt-3', className)}>
      {sources.map((source, index) => (
        <SourceChip key={source.url} source={source} index={index} />
      ))}
    </div>
  );
}

export const InlineSources = memo(PureInlineSources);

export type {
  SourceChipProps as SourceChipPropsType,
  SourcePanelProps as SourcePanelPropsType,
};
