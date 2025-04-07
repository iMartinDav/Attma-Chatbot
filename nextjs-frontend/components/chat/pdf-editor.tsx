'use client';

import React, { memo, useEffect, useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LoaderIcon } from '@/components/icons';

import 'react-pdf/dist/esm/Page/TextLayer.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import { TextShimmer } from '../ui/text-shimmer';

// Fix PDF.js worker configuration - use the bundled worker script
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url,
  ).toString();
}

type PdfEditorProps = {
  content: string;
  saveContent: (content: string, debounce: boolean) => void;
  status: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  isInline?: boolean;
};

const PurePdfEditor = ({
  content,
  status,
  isInline = false,
}: PdfEditorProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPageNumber(1);
    setError(null);
  }, [content]);

  // If React PDF fails, fall back to simple iframe
  const [useFallback, setUseFallback] = useState(false);

  const isValidBase64 = (str: string) => {
    try {
      return typeof str === 'string' && str.length > 0;
    } catch (e) {
      return false;
    }
  };

  const pdfData = useMemo(() => {
    if (!content || !isValidBase64(content)) {
      return null;
    }
    return `data:application/pdf;base64,${content}`;
  }, [content]);

  useEffect(() => {
    if (!content || !isValidBase64(content)) {
      setError('Invalid PDF content');
    }
  }, [content]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setError(null);
  };

  const onLoadError = (error: Error) => {
    console.error('PDF load error:', error);
    setError(`Failed to load PDF: ${error.message}`);
    setUseFallback(true);
  };

  if (status === 'streaming' || !content) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <LoaderIcon />
        <TextShimmer className="mt-2" duration={7}>
          Generating PDF...
        </TextShimmer>
      </div>
    );
  }

  if (error && !useFallback) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-500">
        <span>{error}</span>
        <pre className="text-xs mt-4 max-h-40 overflow-auto">
          {content.substring(0, 100)}...
        </pre>
      </div>
    );
  }

  // Fallback to iframe if react-pdf fails
  if (useFallback && pdfData) {
    return (
      <div className="size-full">
        <iframe
          src={pdfData}
          className="size-full border rounded"
          title="PDF document"
        />
      </div>
    );
  }

  return (
    <div
      className={cn('flex flex-col items-center p-4 h-full', {
        'max-h-[200px]': isInline,
      })}
    >
      {pdfData && (
        <Document
          file={pdfData}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onLoadError}
          loading={<LoaderIcon />}
          className={cn('border rounded shadow-lg', {
            'border-blue-500': status === 'streaming',
          })}
          options={{
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/', // Use the version matching your pdfjs-dist
            cMapPacked: true,
          }}
        >
          <Page
            pageNumber={pageNumber}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="max-w-full"
          />
        </Document>
      )}
      {numPages && numPages > 1 && (
        <div className="mt-4 flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {pageNumber} of {numPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pageNumber >= numPages}
            onClick={() =>
              setPageNumber((prev) => Math.min(prev + 1, numPages))
            }
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

function areEqual(prevProps: PdfEditorProps, nextProps: PdfEditorProps) {
  return (
    prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    prevProps.status === nextProps.status &&
    prevProps.content === nextProps.content
  );
}

export const PdfEditor = memo(PurePdfEditor, areEqual);
