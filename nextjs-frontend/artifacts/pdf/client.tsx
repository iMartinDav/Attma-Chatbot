import { Artifact } from '@/components/chat/create-artifact';
import {
    DownloadIcon,
    FileIcon,
    LoaderIcon,
    RedoIcon,
    UndoIcon,
    ZoomInIcon,
    ZoomOutIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { cn } from '@/lib/utils';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

// **Interfaces**
interface PdfViewerProps {
  title: string;
  content: string;
  status: 'streaming' | 'idle';
  isInline: boolean;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  handleVersionChange?: (direction: 'prev' | 'next') => void;
}

interface PdfControlsProps {
  controlsVisible: boolean;
  pdfControls: ReturnType<typeof usePdfControls>;
  versionControls?: {
    currentVersionIndex: number;
    isCurrentVersion: boolean;
    handleVersionChange?: (direction: 'prev' | 'next') => void;
  };
}

// **PDF Utilities**
const downloadPDF = (content: string, title: string): void => {
  if (!content || content.length < 100) {
    toast.error('No PDF available to download');
    return;
  }

  try {
    const safeTitle = (title || 'document')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    const filename = `${safeTitle}.pdf`;
    const downloadLink = document.createElement('a');
    downloadLink.href = `data:application/pdf;base64,${content.replace(/[\r\n\s]+/g, '')}`;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    toast.success('PDF downloaded successfully!');
  } catch (err) {
    console.error('Download failed:', err);
    toast.error('Failed to download PDF');
  }
};

// **Custom Hooks**
const useWindowDimensions = () => {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return dimensions;
};

const useDynamicHeight = () => {
  const { height: windowHeight } = useWindowDimensions();
  const [height, setHeight] = useState('700px');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const calculateHeight = () => {
      const controlsHeight = 60;
      const spacing = 40;
      const availableHeight = windowHeight - controlsHeight - spacing;
      const safeHeight = Math.max(availableHeight, 400);
      setHeight(`${safeHeight}px`);
    };

    calculateHeight();
  }, [windowHeight]);

  return height;
};

const useControlsVisibility = (autoHideDelay = 3000) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleInteraction = () => {
      setVisible(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setVisible(false), autoHideDelay);
    };

    const events = ['mousemove', 'scroll', 'touchmove'];
    events.forEach((event) =>
      window.addEventListener(event, handleInteraction),
    );

    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, handleInteraction),
      );
      clearTimeout(timeoutId);
    };
  }, [autoHideDelay]);

  return visible;
};

const usePdfData = (content: string, status: string) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);

  useEffect(() => {
    if (!content || status === 'streaming') {
      setIsLoading(true);
      setPdfData(null);
      return;
    }

    try {
      const cleanedContent = content.replace(/\s/g, '').trim();
      const dataUrl = `data:application/pdf;base64,${cleanedContent}`;
      setPdfData(dataUrl);
      setNumPages(Math.max(1, Math.ceil(content.length / 20000))); // Estimate pages
      setIsLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error processing PDF content:', err);
      setError(`Failed to process PDF: ${(err as Error).message}`);
      setIsLoading(false);
    }
  }, [content, status]);

  return { isLoading, error, pdfData, numPages };
};

const usePdfControls = (
  pdfData: string | null,
  numPages: number | null,
  content: string,
  title: string,
) => {
  const [scale, setScale] = useState(1);
  const [pageNumber, setPageNumber] = useState(1);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const updateIframePageNumber = useCallback(
    (page: number) => {
      if (!iframeRef.current || !pdfData) return;
      try {
        const iframe = iframeRef.current;
        const currentSrc = iframe.src;
        iframe.src = currentSrc.includes('#page=')
          ? currentSrc.replace(/#page=\d+/, `#page=${page}`)
          : `${currentSrc}#page=${page}`;
      } catch (err) {
        console.error('Error updating page number:', err);
      }
    },
    [pdfData],
  );

  const goToPrevPage = useCallback(() => {
    if (pageNumber <= 1) return;
    const newPage = pageNumber - 1;
    setPageNumber(newPage);
    updateIframePageNumber(newPage);
  }, [pageNumber, updateIframePageNumber]);

  const goToNextPage = useCallback(() => {
    if (numPages && pageNumber >= numPages) return;
    const newPage = pageNumber + 1;
    setPageNumber(newPage);
    updateIframePageNumber(newPage);
  }, [pageNumber, numPages, updateIframePageNumber]);

  const handleZoomIn = useCallback(
    () => setScale((prev) => Math.min(prev + 0.2, 2)),
    [],
  );

  const handleZoomOut = useCallback(
    () => setScale((prev) => Math.max(prev - 0.2, 0.5)),
    [],
  );

  const handleDownload = useCallback(
    () => downloadPDF(content, title),
    [content, title],
  );

  return {
    scale,
    pageNumber,
    numPages,
    iframeRef,
    goToPrevPage,
    goToNextPage,
    handleZoomIn,
    handleZoomOut,
    handleDownload,
  };
};

// **Components**
const PdfControls: React.FC<PdfControlsProps> = ({
  controlsVisible,
  pdfControls,
  versionControls,
}) => {
  const {
    pageNumber,
    numPages,
    goToPrevPage,
    goToNextPage,
    scale,
    handleZoomIn,
    handleZoomOut,
    handleDownload,
  } = pdfControls;

  return (
    <div className="w-full flex justify-center py-2">
      <div
        className={cn(
          'bg-background/70 backdrop-blur-md rounded-full border border-border/50',
          'shadow-xs transition-all duration-300 px-4 py-2',
          controlsVisible ? 'opacity-100' : 'opacity-50 hover:opacity-100',
        )}
      >
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="h-6 w-px bg-border/40" />

          {/* Page Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full hover:bg-background/80 transition-all active:scale-95"
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              title="Previous page"
            >
              <ChevronLeftIcon size={20} />
            </Button>
            <div className="flex items-center gap-1.5 px-2 min-w-[70px] justify-center">
              <span className="text-sm font-semibold tabular-nums">
                {pageNumber}
              </span>
              <span className="text-xs text-muted-foreground">/</span>
              <span className="text-sm font-medium text-muted-foreground tabular-nums">
                {numPages || '?'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full hover:bg-background/80 transition-all active:scale-95"
              onClick={goToNextPage}
              disabled={pageNumber >= (numPages || 1)}
              title="Next page"
            >
              <ChevronRightIcon size={20} />
            </Button>
          </div>

          <div className="h-6 w-px bg-border/40" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full hover:bg-background/80 transition-all active:scale-95"
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              title="Zoom out"
            >
              <ZoomOutIcon size={20} />
            </Button>
            <span className="text-xs font-bold w-12 text-center tabular-nums bg-muted/50 py-1 rounded-md">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full hover:bg-background/80 transition-all active:scale-95"
              onClick={handleZoomIn}
              disabled={scale >= 2}
              title="Zoom in"
            >
              <ZoomInIcon size={20} />
            </Button>
          </div>

          <div className="h-6 w-px bg-border/40" />

          {/* Download Button */}
          <Button
            variant="default"
            size="sm"
            onClick={handleDownload}
            className="h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all active:scale-95 px-5 flex items-center gap-2"
          >
            <DownloadIcon size={18} />
            <span className="text-sm font-bold tracking-tight">Export</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

const LoadingView = ({ artifactKind }: { artifactKind: string }) => (
  <Card className="mx-auto w-full max-w-4xl bg-background/40 backdrop-blur-xs shadow-xl ring-1 ring-border/10 rounded-xl">
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="animate-spin mb-6 p-2 bg-primary/10 rounded-full text-primary">
        <LoaderIcon size={40} />
      </div>
      <TextShimmer className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
        {`Generating ${artifactKind.toUpperCase()}...`}
      </TextShimmer>
      <p className="text-muted-foreground mt-3 max-w-xs leading-relaxed">
        Our AI is crafting your document with precision. This may take a moment.
      </p>
    </div>
  </Card>
);

const ErrorView = ({ error }: { error: string }) => (
  <Card className="mx-auto w-full max-w-4xl bg-background/40 backdrop-blur-xs shadow-xl ring-1 ring-border/10 rounded-xl">
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-red-50 dark:bg-red-900/20 rounded-lg p-6">
      <div className="mb-4 text-red-500">
        <FileIcon size={48} />
      </div>
      <span className="text-red-600 dark:text-red-400 text-lg font-medium">
        Error Loading PDF
      </span>
      <p className="text-red-600 dark:text-red-400 mt-2 text-center max-w-sm">
        {error}
      </p>
      <Button 
        variant="outline" 
        className="mt-6 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/40"
        onClick={() => window.location.reload()}
      >
        Try Again
      </Button>
    </div>
  </Card>
);

export const PdfViewer: React.FC<PdfViewerProps> = ({
  content,
  title,
  status,
  isInline = false,
  currentVersionIndex,
  isCurrentVersion,
  handleVersionChange,
}) => {
  const { isLoading, error, pdfData, numPages } = usePdfData(content, status);
  const controlsVisible = useControlsVisibility();
  const pdfHeight = useDynamicHeight();
  const pdfControls = usePdfControls(pdfData, numPages, content, title);

  if (isLoading) {
    if (isInline) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-muted/30">
          <div className="animate-spin mb-4 text-primary">
            <LoaderIcon size={24} />
          </div>
          <TextShimmer className="text-sm font-medium">Generating PDF...</TextShimmer>
        </div>
      );
    }
    return <LoadingView artifactKind="pdf" />;
  }
  
  if (error) return <ErrorView error={error} />;

  if (isInline) {
    return (
      <div className="flex flex-col h-full w-full overflow-hidden bg-background/50 pointer-events-none rounded-b-xl">
        <div className="w-full grow overflow-hidden bg-transparent rounded-b-xl">
          {pdfData && (
            <iframe
              src={`${pdfData}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
              className="w-full h-full border-0 rounded-b-xl"
              title="PDF Preview"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <Card
      className={cn(
        'mx-auto w-full max-w-4xl relative overflow-hidden p-0',
        'bg-background/30 backdrop-blur-md shadow-2xl ring-1 ring-border/10 rounded-xl',
        'flex flex-col',
      )}
      style={{
        height: `calc(${pdfHeight} + 60px)`,
        maxHeight: '95vh',
      }}
    >
      <PdfControls
        controlsVisible={controlsVisible}
        pdfControls={pdfControls}
        versionControls={{
          currentVersionIndex,
          isCurrentVersion,
          handleVersionChange,
        }}
      />
      <div
        className="w-full bg-zinc-100 dark:bg-zinc-950 grow overflow-hidden"
        style={{ height: pdfHeight }}
      >
        {pdfData && (
          <iframe
            ref={pdfControls.iframeRef}
            src={`${pdfData}#page=${pdfControls.pageNumber}&toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full border-0 transition-transform duration-300"
            style={{
              transform: `scale(${pdfControls.scale})`,
              transformOrigin: 'top center',
              height: '100%',
              padding: 0,
              display: 'block',
            }}
            title="PDF Viewer"
          />
        )}
      </div>
    </Card>
  );
};

// **Artifact Export**
export const pdfArtifact = new Artifact<
  'pdf',
  { filename?: string; documentTitle?: string }
>({
  kind: 'pdf',
  description: 'Generate and view professional PDF documents with AI',
  initialize: async () => {},

  onStreamPart: ({ streamPart, setArtifact, setMetadata }) => {
    if (streamPart.type === 'data-pdfArtifact') {
      const data = (streamPart as any).data;
      if (typeof data === 'string' && data.length > 0) {
        const isProgressMessage =
          data.length < 100 && !data.includes('JVBERi');
        setArtifact((draft) => ({
          ...draft,
          content: isProgressMessage ? draft.content : data,
          isVisible: !isProgressMessage,
          status: 'streaming',
        }));
      }
    }

    if (streamPart.type === 'data-finish') {
      console.log('PDF generation complete');
      setArtifact((draft) => ({ ...draft, status: 'idle' }));
    }

    if (streamPart.type === 'data-title') {
      const docTitle = (streamPart as any).data as string;
      setMetadata((meta) => ({
        ...meta,
        documentTitle: docTitle,
        filename: `${docTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
      }));
    }
  },

  content: PdfViewer as any, // Use type assertion as temporary fix if needed

  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: 'Previous Version',
      onClick: ({ handleVersionChange }) => handleVersionChange('prev'),
      isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'Next Version',
      onClick: ({ handleVersionChange }) => handleVersionChange('next'),
      isDisabled: ({ isCurrentVersion }) => isCurrentVersion,
    },
    {
      icon: <DownloadIcon size={18} />,
      description: 'Download PDF',
      onClick: ({ content, metadata }) => {
        const documentTitle = metadata?.documentTitle || 'document';
        downloadPDF(content, documentTitle);
      },
    },
  ],

  toolbar: [
    {
      description: 'Enhance Document',
      icon: <FileIcon size={16} />,
      onClick: ({ sendMessage }) => {
        sendMessage({
          text:
            'Please enhance this PDF document with more detailed information and better formatting.',
        });
      },
    },
  ],
});
