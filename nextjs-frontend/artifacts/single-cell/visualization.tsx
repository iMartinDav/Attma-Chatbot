// artifacts/single-cell/visualization.tsx
import { useEffect, useState } from 'react';
import { useArtifact } from '@/hooks/use-artifact';
import { Loader } from 'lucide-react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import './single-cell-visualization.css';

interface SingleCellVisualizationProps {
  title: string;
  content: string;
  mode: 'edit' | 'diff';
  status: 'streaming' | 'idle';
  currentVersionIndex: number;
  suggestions: string[];
  onSaveContent: (content: string, debounce: boolean) => void;
  isInline: boolean;
  isCurrentVersion: boolean;
  getDocumentContentById: (index: number) => string;
  isLoading: boolean;
  metadata: Record<string, unknown>;
  setMetadata: (metadata: Record<string, unknown>) => void;
}

export function SingleCellVisualization({
  content,
  metadata,
  setMetadata,
  isLoading,
  status,
}: SingleCellVisualizationProps) {
  const { artifact } = useArtifact();
  interface UMAPData {
    data: [number, number][];
  }
  
  interface PlotData {
    umap?: UMAPData;
    // Add other properties as needed
  }
  
    const [plotData, setPlotData] = useState<PlotData | null>(null);

  // Parse content when streaming is complete
  useEffect(() => {
    if (status === 'idle' && content) {
      try {
        const parsedData = JSON.parse(content);
        setPlotData(parsedData);
      } catch (error) {
        console.error('Error parsing single-cell data:', error);
        setPlotData(null);
      }
    } else {
      setPlotData(null);
    }
  }, [status, content]);

  // Handle streaming state
  if (status === 'streaming') {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="animate-spin mr-2" />
        <p>Processing single-cell data...</p>
      </div>
    );
  }

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="animate-spin" />
      </div>
    );
  }

  // Handle no data
  if (!plotData) {
    return <div>No data available for visualization.</div>;
  }

  // Prepare scatter plot data
  const umapData = plotData.umap;
  interface ScatterPoint {
    x: number;
    y: number;
  }

  let scatterData: ScatterPoint[] = [];
  if (umapData && Array.isArray(umapData.data)) {
    scatterData = umapData.data.map((point: [number, number]) => ({
      x: point[0],
      y: point[1],
    }));
  }

  return (
    <div className="h-full w-full p-4">
      <div className="grid grid-cols-2 gap-4 h-full">
        {/* QC Metrics */}
        <div className="bg-background p-4 rounded-lg shadow-sm">
          <h3 className="font-semibold mb-4 text-lg">Quality Control</h3>
          <p className="text-sm text-muted-foreground">
            Placeholder for QC metrics (e.g., violin plots, histograms).
          </p>
        </div>

        {/* Dimensionality Reduction */}
        <div className="bg-background p-4 rounded-lg shadow-sm">
          <h3 className="font-semibold mb-4 text-lg">
            Dimensionality Reduction
          </h3>
          <div className="h-[300px] w-full">
            {scatterData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="x" name="UMAP 1" stroke="var(--foreground)" />
                  <YAxis dataKey="y" name="UMAP 2" stroke="var(--foreground)" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Legend />
                  <Scatter
                    name="Cells"
                    data={scatterData}
                    fill="var(--primary)"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                No UMAP data available.
              </p>
            )}
          </div>
        </div>

        {/* Cluster Analysis */}
        <div className="col-span-2 bg-background p-4 rounded-lg shadow-sm">
          <h3 className="font-semibold mb-4 text-lg">Cluster Analysis</h3>
          <p className="text-sm text-muted-foreground">
            Placeholder for cluster analysis (e.g., marker gene expression,
            heatmaps).
          </p>
        </div>
      </div>
    </div>
  );
}
