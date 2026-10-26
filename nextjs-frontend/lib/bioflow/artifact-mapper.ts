/**
 * BioFlow artifact mapper for connecting analysis results to appropriate artifacts
 */

/**
 * Maps analysis result types to appropriate artifact types
 */
export type AnalysisResultType =
  | 'gene_expression'
  | 'clustering'
  | 'pathway_enrichment'
  | 'variant_analysis'
  | 'sequence_analysis'
  | 'dimensionality_reduction'
  | 'qc_metrics'
  | 'differential_expression'
  | 'single_cell';

/**
 * Maps to available artifact types
 */
export type ArtifactType =
  'graph' | 'sheet' | 'code' | 'text' | 'image' | 'pdf';

/**
 * Parameter value types supported in artifact configurations
 */
export type ParameterValue = string | number | boolean | null | string[];

/**
 * Analysis result to artifact mapping
 */
export const analysisToArtifactMap: Record<
  AnalysisResultType,
  {
    primary: ArtifactType;
    alternative?: ArtifactType;
    parameters?: Record<string, ParameterValue>;
  }
> = {
  gene_expression: {
    primary: 'sheet',
    alternative: 'graph',
    parameters: {
      graphType: 'heatmap',
    },
  },
  clustering: {
    primary: 'graph',
    parameters: {
      graphType: 'scatter',
    },
  },
  pathway_enrichment: {
    primary: 'sheet',
    alternative: 'graph',
    parameters: {
      graphType: 'bar',
    },
  },
  variant_analysis: {
    primary: 'sheet',
  },
  sequence_analysis: {
    primary: 'text',
    alternative: 'sheet',
  },
  dimensionality_reduction: {
    primary: 'graph',
    parameters: {
      graphType: 'umap',
    },
  },
  qc_metrics: {
    primary: 'graph',
    parameters: {
      graphType: 'violin',
    },
  },
  differential_expression: {
    primary: 'graph',
    alternative: 'sheet',
    parameters: {
      graphType: 'volcano',
    },
  },
  single_cell: {
    primary: 'graph',
    alternative: 'sheet',
    parameters: {
      graphType: 'umap',
    },
  },
};

/**
 * Maps result content to the most appropriate artifact type
 *
 * @param resultType The type of analysis result
 * @param preferredArtifact Optional user preference for artifact type
 * @returns Information about the best artifact to use, including parameters
 */
export function mapResultToArtifact(
  resultType: AnalysisResultType,
  preferredArtifact?: ArtifactType,
): {
  artifactType: ArtifactType;
  parameters: Record<string, ParameterValue>;
} {
  const mapping = analysisToArtifactMap[resultType] || {
    primary: 'sheet',
    parameters: {},
  };

  // If user has a preference that's supported for this result type
  if (preferredArtifact) {
    if (
      preferredArtifact === mapping.primary ||
      preferredArtifact === mapping.alternative
    ) {
      return {
        artifactType: preferredArtifact,
        parameters: mapping.parameters || {},
      };
    }
  }

  // Default to primary artifact type
  return {
    artifactType: mapping.primary,
    parameters: mapping.parameters || {},
  };
}

/**
 * Represents analysis result data in various formats
 */
export type AnalysisResultData =
  string | Record<string, unknown> | Array<Record<string, unknown>>;

/**
 * Metadata for analysis results
 */
export type AnalysisMetadata = Record<string, ParameterValue>;

/**
 * Generates artifact creation parameters based on analysis result
 *
 * @param resultType Analysis result type
 * @param resultData The actual result data
 * @param metadata Additional metadata about the analysis
 * @returns Parameters for creating the appropriate artifact
 */
export function generateArtifactParams(
  resultType: AnalysisResultType,
  resultData: AnalysisResultData,
  metadata: AnalysisMetadata = {},
): {
  kind: ArtifactType;
  title: string;
  content: string;
  artifactMetadata: Record<string, ParameterValue>;
} {
  const { artifactType, parameters } = mapResultToArtifact(resultType);

  // Generate an appropriate title
  const title =
    (metadata.title as string) || `${resultType.split('_').join(' ')} result`;

  // Format the content based on the artifact type
  let content = '';
  const artifactMetadata: Record<string, ParameterValue> = { ...parameters };

  switch (artifactType) {
    case 'graph':
      // For graph artifacts, content might be a URL or data for visualization
      if (typeof resultData === 'string') {
        content = resultData; // Assume it's a URL or JSON string
      } else {
        content = JSON.stringify(resultData);
      }

      // Add graph-specific metadata
      artifactMetadata.graphType = parameters.graphType || 'scatter';
      artifactMetadata.title = title;
      break;

    case 'sheet':
      // For sheet artifacts, convert to CSV if not already
      if (typeof resultData === 'string') {
        content = resultData; // Assume it's already CSV
      } else if (Array.isArray(resultData)) {
        // Convert array data to CSV
        const headers =
          resultData.length > 0 ? Object.keys(resultData[0]).join(',') : '';
        const rows = resultData.map((row) => Object.values(row).join(','));
        content = [headers, ...rows].join('\n');
      } else {
        content = JSON.stringify(resultData);
      }
      break;

    case 'text':
    case 'code':
      // For text/code artifacts, convert to string if not already
      content =
        typeof resultData === 'string'
          ? resultData
          : JSON.stringify(resultData, null, 2);
      break;

    default:
      // For other artifact types
      content =
        typeof resultData === 'string'
          ? resultData
          : JSON.stringify(resultData);
  }

  return {
    kind: artifactType,
    title,
    content,
    artifactMetadata,
  };
}

/**
 * Creates a title for an artifact based on analysis metadata
 *
 * @param resultType Type of analysis result
 * @param metadata Analysis metadata
 * @returns Formatted title string
 */
export function createArtifactTitle(
  resultType: AnalysisResultType,
  metadata: AnalysisMetadata = {},
): string {
  const analysisName = resultType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Add specifics based on result type and available metadata
  let specifics = '';

  if (resultType === 'differential_expression' && metadata.comparison) {
    specifics = `: ${metadata.comparison}`;
  } else if (resultType === 'clustering' && metadata.method) {
    specifics = ` (${metadata.method})`;
  } else if (resultType === 'dimensionality_reduction' && metadata.method) {
    specifics = ` ${metadata.method}`;
  } else if (metadata.organism) {
    specifics = ` - ${metadata.organism}`;
  }

  return `${analysisName}${specifics} Results`;
}
