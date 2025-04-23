'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useArtifact } from '@/hooks/use-artifact';
import { toast } from 'sonner';

interface AnalysisResultProps {
  taskId: string;
}

/**
 * Component that handles bioinformatics analysis results
 * It polls for completed analysis jobs and creates Sheet artifacts from the results
 */
export function AnalysisResultHandler({ taskId }: AnalysisResultProps) {
  const { setArtifact } = useArtifact();
  const [isPolling, setIsPolling] = useState(true);

  // Poll for analysis status
  const { data: statusData, error: statusError } = useSWR(
    isPolling ? `/api/bioflow/analysis/${taskId}/status` : null,
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch analysis status');
      return res.json();
    },
    { refreshInterval: 3000 }, // Poll every 3 seconds
  );

  // Fetch analysis result when completed
  const { data: resultData, error: resultError } = useSWR(
    statusData?.status === 'completed' && statusData?.result_id
      ? `/api/bioflow/analysis/result/${statusData.result_id}`
      : null,
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch analysis result');
      return res.json();
    },
  );

  useEffect(() => {
    // Handle analysis status updates
    if (statusData) {
      if (statusData.status === 'completed') {
        setIsPolling(false);
        toast.success('Analysis completed successfully');
      } else if (statusData.status === 'failed') {
        setIsPolling(false);
        toast.error(`Analysis failed: ${statusData.error || 'Unknown error'}`);
      }
    }

    if (statusError) {
      setIsPolling(false);
      toast.error(`Error checking analysis status: ${statusError.message}`);
    }
  }, [statusData, statusError]);

  useEffect(() => {
    // Create Sheet artifact from analysis result
    if (resultData) {
      try {
        // Convert analysis result to Sheet data format
        const sheetData = convertAnalysisToSheetData(resultData);

        // Create a new document with the Sheet artifact
        createSheetDocument(sheetData, resultData);
      } catch (error) {
        console.error('Error creating Sheet artifact:', error);
        toast.error('Failed to create visualization from analysis result');
      }
    }

    if (resultError) {
      toast.error(`Error fetching analysis result: ${resultError.message}`);
    }
  }, [resultData, resultError]);

  /**
   * Converts bioinformatics analysis results to Sheet data format
   */
  const convertAnalysisToSheetData = (analysisResult: AnalysisResult) => {
    let headers: string[] = [];
    let rows: string[][] = [];

    // Extract data based on analysis type
    if (analysisResult.analysis_type === 'matrix_structure') {
      // For matrix structure analysis
      const resultData = analysisResult.small_result || {};

      // Create headers
      headers = ['Property', 'Value'];

      // Create rows from matrix properties
      rows = [
        ['Data Type', String(resultData.data_type ?? 'Unknown')],
        ['Rows', String(resultData.num_rows ?? 'N/A')],
        ['Columns', String(resultData.num_columns ?? 'N/A')],
        ['File Type', String(resultData.file_type ?? 'Unknown')],
        ['Has Header Row', String(resultData.has_header_row ?? 'N/A')],
        ['Has Header Column', String(resultData.has_header_column ?? 'N/A')],
      ];

      if (resultData.has_subset) {
        rows.push(['Subset Available', 'Yes']);
      }
    } else if (
      analysisResult.analysis_type === 'zip_with_matrix' ||
      analysisResult.analysis_type === 'zip_with_h5ad'
    ) {
      // For matrix in zip files
      const resultData = analysisResult.small_result || {};

      headers = ['Property', 'Value'];
      rows = [
        ['Data Type', String(resultData.data_type ?? 'Unknown')],
        ['Matrix File', String(resultData.matrix_file ?? 'Unknown')],
        ['Rows', String(resultData.num_rows ?? 'N/A')],
        ['Columns', String(resultData.num_columns ?? 'N/A')],
      ];
    } else {
      // Generic format for other analysis types
      const resultData = analysisResult.small_result || {};

      headers = ['Property', 'Value'];

      // Convert all properties to rows
      rows = Object.entries(resultData).map(([key, value]) => {
        // Ensure value is converted to string, handling null/undefined
        return [key, String(value ?? 'N/A')];
      });
    }

    return {
      headers,
      rows,
      title: `Analysis Result: ${analysisResult.analysis_type}`,
      metadata: {
        analysisId: analysisResult.id,
        analysisType: analysisResult.analysis_type,
        timestamp: analysisResult.created_at,
      },
    };
  };

  // Define interfaces for better type safety
  interface SheetData {
    headers: string[];
    rows: string[][];
    title: string;
    metadata: {
      analysisId: string | number;
      analysisType: string;
      timestamp: string | Date;
    };
  }

  interface AnalysisResult {
    id: string | number;
    analysis_type: string;
    small_result?: Record<string, unknown>; // Keep flexible or define more specific types if possible
    created_at: string | Date;
    // Add other potential fields if known
  }

  /**
   * Creates a new Sheet document with the analysis data
   */
  const createSheetDocument = async (
    sheetData: SheetData,
    analysisResult: AnalysisResult,
  ) => {
    try {
      // Format sheet data for the Document API
      const documentData = {
        title: sheetData.title,
        content: JSON.stringify({
          headers: sheetData.headers,
          rows: sheetData.rows,
          metadata: sheetData.metadata,
        }),
        kind: 'sheet',
        analysisResultId: analysisResult.id,
      };

      // Create document via API
      const response = await fetch('/api/document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(documentData),
      });

      if (!response.ok) {
        throw new Error('Failed to create document');
      }

      const document = await response.json();

      // Set the artifact in context to show the new sheet
      setArtifact({
        documentId: document.id,
        title: document.title,
        content: document.content,
        kind: 'sheet',
        status: 'idle',
        isVisible: true,
        boundingBox: {
          top: 0,
          left: 0,
          width: 0,
          height: 0,
        },
      });

      toast.success('Analysis results visualized successfully');
    } catch (error) {
      console.error('Error creating document:', error);
      toast.error('Failed to create visualization');
    }
  };

  // This component doesn't render anything visible
  return null;
}
