import { createDocumentHandler } from '@/lib/artifacts/server';

import { z } from 'zod';

// Define types for graph request parameters
const graphTypes = [
  'umap',
  'tsne',
  'pca',
  'heatmap',
  'violin',
  'scatter',
] as const;
const graphRequestSchema = z.object({
  visType: z.enum(graphTypes),
  parameters: z.record(z.string(), z.any()).optional(),
  dataDescription: z.string(),
  title: z.string().optional(),
});

export type GraphRequest = z.infer<typeof graphRequestSchema>;
export type GraphContent = {
  graphUrl?: string;
  taskId?: string;
  graphType?: string;
  title?: string;
  status?: string;
  parameters?: Record<string, any>;
  metadata?: Record<string, any>;
};

export const graphDocumentHandler = createDocumentHandler<'graph'>({
  kind: 'graph',
  onCreateDocument: async ({ id, title, session }) => {
    // Parse the title to extract visualization parameters
    const parsedTitle = parseGraphTitle(title);
    const visType = parsedTitle?.visType || 'umap';
    const parameters = parsedTitle?.parameters || {};
    const dataDescription = parsedTitle?.dataDescription || title;

    // Get the FastAPI backend URL from environment or use default
    const apiUrl = process.env.FASTAPI_URL ?? 'http://localhost:8000';

    try {
      // Call the FastAPI backend to create the visualization
      const response = await fetch(
        `${apiUrl}/api/bioflow/visualization/${visType}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Access token safely with optional chaining
            Authorization: `Bearer ${session?.user?.id || ''}`,
          },
          body: JSON.stringify({
            parameters,
            data_description: dataDescription,
            title,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error creating visualization:', errorData);
        throw new Error(
          `Failed to create visualization: ${errorData.detail || response.statusText}`,
        );
      }

      const data = await response.json();
      let result = '';

      // If the visualization was processed immediately
      if (data.status === 'completed' && data.url) {
        result = JSON.stringify({
          graphUrl: data.url,
          graphType: visType,
          title,
          metadata: data.metadata || {},
        });
      }

      // If the visualization is being processed in the background
      else if (data.status === 'processing' && data.task_id) {
        result = JSON.stringify({
          taskId: data.task_id,
          graphType: visType,
          title,
          status: 'processing',
          parameters,
        });
      }

      return result;
    } catch (error) {
      console.error('Error in graph artifact creation:', error);
      throw error;
    }
  },

  onUpdateDocument: async ({ document, description, session }) => {
    try {
      // Parse the existing document content
      let existingContent: GraphContent = {};
      try {
        existingContent = JSON.parse(document.content || '{}') as GraphContent;
      } catch (e) {
        // If parsing fails, use empty object
        console.error('Error parsing existing content:', e);
      }

      const taskId = existingContent?.taskId;
      const graphType = existingContent?.graphType || 'umap';

      // If we have a task ID, check its status
      if (taskId) {
        const apiUrl = process.env.FASTAPI_URL ?? 'http://localhost:8000';
        const response = await fetch(
          `${apiUrl}/api/bioflow/visualization/task/${taskId}`,
          {
            headers: {
              // Access token safely with optional chaining
              Authorization: `Bearer ${session?.user?.id || ''}`,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();

          if (data.status === 'completed' && data.result?.url) {
            const updatedContent = JSON.stringify({
              graphUrl: data.result.url,
              graphType,
              title: document.title,
              metadata: data.result.metadata || {},
            });

            return updatedContent;
          }
        }
      }

      // If we're updating with new parameters
      const parsedDescription = parseGraphDescription(description);
      if (parsedDescription) {
        // Create a new visualization with updated parameters
        const apiUrl = process.env.FASTAPI_URL ?? 'http://localhost:8000';
        const response = await fetch(
          `${apiUrl}/api/bioflow/visualization/${parsedDescription.visType || graphType}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Access token safely with optional chaining
              Authorization: `Bearer ${session?.user?.id || ''}`,
            },
            body: JSON.stringify({
              parameters: parsedDescription.parameters || {},
              data_description:
                parsedDescription.dataDescription || description,
              title: document.title,
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();

          if (data.status === 'completed' && data.url) {
            const updatedContent = JSON.stringify({
              graphUrl: data.url,
              graphType: parsedDescription.visType || graphType,
              title: document.title,
              metadata: data.metadata || {},
            });

            return updatedContent;
          }

          if (data.status === 'processing' && data.task_id) {
            const updatedContent = JSON.stringify({
              taskId: data.task_id,
              graphType: parsedDescription.visType || graphType,
              title: document.title,
              status: 'processing',
              parameters: parsedDescription.parameters || {},
            });

            return updatedContent;
          }
        }
      }

      // If we couldn't update, return the original content
      return document.content || '';
    } catch (error) {
      console.error('Error updating graph artifact:', error);
      return document.content || '';
    }
  },
});

// Helper function to parse graph title to extract visualization parameters
function parseGraphTitle(title: string): {
  visType: string;
  parameters: Record<string, any>;
  dataDescription: string;
} | null {
  // Try to extract visualization type from title
  const visTypeMatch = title.match(
    /\b(umap|tsne|pca|heatmap|violin|scatter)\b/i,
  );
  const visType = visTypeMatch ? visTypeMatch[0].toLowerCase() : 'umap';

  // Extract any parameters mentioned in the title
  const parameters: Record<string, any> = {};

  // Simple parameter extraction logic
  if (title.includes('resolution')) {
    const resMatch = title.match(/resolution\s*[=:]\s*(\d+\.?\d*)/i);
    if (resMatch?.[1]) {
      parameters.resolution = Number.parseFloat(resMatch[1]);
    }
  }

  if (title.includes('perplexity')) {
    const perpMatch: RegExpMatchArray | null = title.match(
      /perplexity\s*[=:]\s*(\d+\.?\d*)/i,
    );
    if (perpMatch?.[1]) {
      parameters.perplexity = Number.parseFloat(perpMatch[1]);
    }
  }

  return {
    visType: visType,
    parameters,
    dataDescription: title,
  };
}

// Helper function to parse graph description for updates
function parseGraphDescription(description: string): {
  visType?: string;
  parameters?: Record<string, any>;
  dataDescription?: string;
} | null {
  // Similar logic to parseGraphTitle but for description
  const visTypeMatch = description.match(
    /\b(umap|tsne|pca|heatmap|violin|scatter)\b/i,
  );
  const visType = visTypeMatch ? visTypeMatch[0].toLowerCase() : undefined;

  // Extract parameters
  const parameters: Record<string, any> = {};

  // Simple parameter extraction
  if (description.includes('resolution')) {
    const resMatch = description.match(/resolution\s*[=:]\s*(\d+\.?\d*)/i);
    if (resMatch?.[1]) {
      parameters.resolution = Number.parseFloat(resMatch[1]);
    }
  }

  if (description.includes('perplexity')) {
    const perpMatch: RegExpMatchArray | null = description.match(
      /perplexity\s*[=:]\s*(\d+\.?\d*)/i,
    );
    if (perpMatch?.[1]) {
      parameters.perplexity = Number.parseFloat(perpMatch[1]);
    }
  }

  return Object.keys(parameters).length > 0 || visType
    ? { visType, parameters, dataDescription: description }
    : null;
}

export const handler = graphDocumentHandler;
