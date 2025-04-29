import { Artifact } from '@/components/chat/create-artifact';
import { CopyIcon, RedoIcon, UndoIcon, DownloadIcon } from '@/components/icons';
import { toast } from 'sonner';
import { GraphEditor } from '@/components/chat/graph-editor';

// Define metadata structure for graph artifacts
interface GraphMetadata {
  graphType?: string;
  taskId?: string;
  status?: string;
  error?: string;
  graphUrl?: string;
  data_stats?: Record<string, string | number>;
  parameters?: Record<string, unknown>;
}

const downloadGraph = (title: string, content: string) => {
  try {
    const link = document.createElement('a');
    link.href = content;
    link.download = title ? `${title}.png` : 'graph-visualization.png';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.error('Error downloading graph:', error);
    return false;
  }
};

export const graphArtifact = new Artifact<'graph', GraphMetadata>({
  kind: 'graph',
  description: 'Interactive graph visualization for data analysis',
  initialize: ({ setMetadata }) => {
    setMetadata({
      graphType: 'umap',
    });
  },
  onStreamPart: ({ streamPart, setArtifact, setMetadata }) => {
    switch (streamPart.type) {
      case 'text-delta':
        try {
          // Try to parse as JSON in case it contains graph metadata
          if (typeof streamPart.content === 'string') {
            const parsedContent = JSON.parse(streamPart.content);
            if (parsedContent.metadata) {
              setMetadata((prevMetadata) => ({
                ...prevMetadata,
                ...parsedContent.metadata,
              }));
            }

            if (parsedContent.graphUrl) {
              setArtifact((prevArtifact) => ({
                ...prevArtifact,
                content: parsedContent.graphUrl,
                isVisible: true,
                status: 'streaming',
              }));
            }
          } else {
            // If not a string, treat as plain object or handle accordingly
            setArtifact((prevArtifact) => ({
              ...prevArtifact,
              content: '',
              isVisible: true,
              status: 'streaming',
            }));
          }
        } catch (e) {
          // If not JSON, treat as plain text/URL content
          setArtifact((prevArtifact) => ({
            ...prevArtifact,
            content:
              typeof streamPart.content === 'string' ? streamPart.content : '',
            isVisible: true,
            status: 'streaming',
          }));
        }
        break;

      case 'graph-delta':
        setArtifact((prevArtifact) => ({
          ...prevArtifact,
          content:
            typeof streamPart.content === 'string' ? streamPart.content : '',
          isVisible: true,
          status: 'streaming',
        }));
        break;
    }
  },
  content: (props) => <GraphEditor {...props} />,
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }
        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }
        return false;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy graph URL to clipboard',
      onClick: ({ content, metadata }) => {
        const graphUrl = metadata?.graphUrl || content;
        if (graphUrl) {
          navigator.clipboard.writeText(graphUrl);
          toast.success('Graph URL copied to clipboard!');
        } else {
          toast.error('No graph URL available');
        }
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: 'Download graph',
      onClick: ({ content, metadata }) => {
        const graphUrl = metadata?.graphUrl || content;
        if (!graphUrl) {
          toast.error('No graph available to download');
          return;
        }

        const title = metadata?.graphType || 'graph-visualization';
        const success = downloadGraph(title, graphUrl);
        if (success) {
          toast.success('Graph downloaded!');
        } else {
          toast.error('Failed to download graph');
        }
      },
    },
  ],
  toolbar: [],
});
