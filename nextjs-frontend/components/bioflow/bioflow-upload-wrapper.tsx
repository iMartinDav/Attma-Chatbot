'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AnalysisResultHandler } from './analysis-result-handler';

interface BioflowUploadWrapperProps {
  children: React.ReactNode;
}

/**
 * A wrapper component that augments the file upload process for bioinformatics files
 * It intercepts the upload response and handles analysis results
 */
export function BioflowUploadWrapper({ children }: BioflowUploadWrapperProps) {
  const [activeAnalysisTasks, setActiveAnalysisTasks] = useState<string[]>([]);

  // Intercept fetch calls to look for bioflow upload responses
  const originalFetch = global.fetch;

  // Replace the global fetch with our enhanced version
  if (typeof window !== 'undefined') {
    // Only replace fetch in browser environment
    global.fetch = async (...args) => {
      const [resource, config] = args;

      // Call the original fetch
      const response = await originalFetch(resource, config);

      try {
        // Clone the response so we can read its body without affecting the original
        const responseClone = response.clone();

        // Check if this is a response from our bioflow upload endpoint
        if (
          typeof resource === 'string' &&
          resource.includes('/api/bioflow/upload')
        ) {
          const data = await responseClone.json();

          // If it has an analysis task ID, add it to our active tasks
          if (data.analysis_task_id) {
            setActiveAnalysisTasks((prev) => [...prev, data.analysis_task_id]);
            toast.info('Bioinformatics file uploaded. Analysis started.');
          }
        }
      } catch (error) {
        // Silently ignore errors in our fetch handler
        console.debug('Error in fetch interceptor:', error);
      }

      // Always return the original response
      return response;
    };
  }

  return (
    <>
      {/* Render the children (upload component) */}
      {children}

      {/* Render analysis result handlers for each active task */}
      {activeAnalysisTasks.map((taskId) => (
        <AnalysisResultHandler key={taskId} taskId={taskId} />
      ))}
    </>
  );
}
