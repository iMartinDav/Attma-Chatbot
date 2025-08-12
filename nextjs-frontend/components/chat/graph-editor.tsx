import cn from 'classnames';
import { RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { LoaderIcon } from '../icons';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { TextShimmer } from '../ui/text-shimmer';

interface GraphMetadata {
  graphType?: string;
  taskId?: string;
  status?: string;
  error?: string;
  graphUrl?: string;
  data_stats?: Record<string, string | number>;
  parameters?: Record<string, unknown>;
}

interface GraphEditorProps {
  title: string;
  content: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: string;
  isInline: boolean;
  isLoading?: boolean;
  metadata?: GraphMetadata;
  setMetadata?: (
    metadata: GraphMetadata | ((prevMetadata: GraphMetadata) => GraphMetadata),
  ) => void;
  onDownload?: (title: string, content: string) => void;
}

export function GraphEditor({
  title,
  content,
  status,
  isInline,
  isLoading = false,
  metadata,
  setMetadata,
}: GraphEditorProps) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing || !metadata?.taskId || !setMetadata) return;

    setIsRefreshing(true);
    try {
      const response = await fetch(
        `/api/artifacts/graph/status?taskId=${metadata.taskId}`,
      );
      const data = await response.json();

      if (data.status === 'completed' && data.content) {
        setMetadata({
          ...metadata,
          status: 'completed',
          graphUrl: data.content,
        });
      }
    } catch (error) {
      console.error('Error refreshing graph:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // If still loading or streaming
  if (isLoading || status === 'streaming') {
    return (
      <div
        className={cn('flex flex-col items-center justify-center w-full', {
          'min-h-[200px] max-h-[calc(100dvh-120px)]': !isInline,
          'min-h-[200px] md:min-h-[300px]': isInline,
        })}
      >
        <div className="flex flex-row gap-4 md:gap-6 items-center py-6 md:py-8">
          {!isInline && (
            <div className="animate-spin scale-100 md:scale-125">
              <LoaderIcon />
            </div>
          )}
          <TextShimmer
            className="text-base md:text-lg font-medium"
            duration={7}
          >
            Generating Graph...
          </TextShimmer>
        </div>
      </div>
    );
  }

  // If task is still processing
  if (
    metadata?.taskId &&
    (!metadata.status || metadata.status === 'processing')
  ) {
    return (
      <div className="flex flex-col items-center justify-center p-10">
        <Spinner className="h-8 w-8 mb-4" />
        <p className="text-sm text-muted-foreground mb-2">
          Processing visualization...
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Checking status...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Status
            </>
          )}
        </Button>
      </div>
    );
  }

  // If there's an error
  if (metadata?.error) {
    return (
      <div className="flex flex-col items-center justify-center p-10">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 p-4 rounded-md mb-4">
          <h3 className="font-medium">Error generating visualization</h3>
          <p className="text-sm mt-1">{metadata.error}</p>
        </div>
      </div>
    );
  }

  // If we have a completed graph to display
  const imageUrl = metadata?.graphUrl || content;

  if (imageUrl) {
    return (
      <div
        className={cn('flex flex-col items-center w-full', {
          'p-4': !isInline,
          'p-0': isInline,
        })}
      >
        <div
          className={cn('bg-background rounded-lg border w-full', {
            'p-4 max-w-5xl mx-auto': !isInline,
            'border-0': isInline,
          })}
        >
          <div
            className={cn('flex justify-between items-center', {
              'mb-4': !isInline,
              'mb-2 px-3 pt-2': isInline,
            })}
          >
            <div>
              <Badge variant="outline" className="mr-2">
                {metadata?.graphType || 'Graph'}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoomLevel(Math.max(25, zoomLevel - 25))}
                disabled={zoomLevel <= 25}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs font-mono">{zoomLevel}%</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))}
                disabled={zoomLevel >= 200}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div
            className={cn('overflow-auto border', {
              'rounded-md': !isInline,
              'rounded-t-xl border-0': isInline,
            })}
            style={{ maxHeight: isInline ? '500px' : '70vh' }}
          >
            <div
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top left',
                padding: '1rem',
              }}
            >
              <Image
                src={imageUrl}
                alt={title || 'Graph Visualization'}
                width={800}
                height={600}
                className={cn('max-w-full', {
                  'rounded-md': !isInline,
                  'rounded-t-xl': isInline,
                })}
                data-graph-title={title}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If no content is available
  return (
    <div className="flex flex-col items-center justify-center p-10">
      <p className="text-sm text-muted-foreground">
        No visualization available.
      </p>
    </div>
  );
}
