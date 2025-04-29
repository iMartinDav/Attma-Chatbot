import { Artifact } from '@/components/chat/create-artifact';
import {
  CopyIcon,
  LineChartIcon,
  RedoIcon,
  SparklesIcon,
  UndoIcon,
  FileIcon, // Changed from FilterIcon
  MenuIcon, // Changed from SearchIcon
  BarChartIcon,
  InfoIcon, // Changed from ZapIcon
} from '@/components/icons';
import { SpreadsheetEditor } from '@/components/chat/sheet-editor';
import { parse, unparse } from 'papaparse';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ArtifactToolbarContext } from '@/components/chat/create-artifact';

// Enhanced metadata for bioinformatics data
interface BioSheetMetadata {
  dataType?:
    | 'gene_expression'
    | 'sequence_data'
    | 'variant_data'
    | 'pathway_data'
    | 'general';
  organism?: string;
  sampleCount?: number;
  featureCount?: number;
  significantFeatures?: string[];
  pathways?: string[];
  filterHistory?: Array<{
    column: string;
    condition: string;
    value: string;
  }>;
  analysisNotes?: string;
}

// Type definition to fix the appendMessage error
interface ArtifactActionWithAppendMessage {
  content: string;
  appendMessage: (message: { role: string; content: string }) => void;
  handleVersionChange?: (direction: 'prev' | 'next') => void;
  currentVersionIndex?: number;
  isCurrentVersion?: boolean;
}

// Bio-specific filtering component
function BioFilterPanel({
  content,
  onApplyFilter,
  metadata,
}: {
  content: string;
  onApplyFilter: (filteredContent: string) => void;
  metadata: BioSheetMetadata;
}) {
  const [column, setColumn] = useState<string>('');
  const [condition, setCondition] = useState<string>('contains');
  const [value, setValue] = useState<string>('');
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);

  // Parse CSV to extract column names
  useState(() => {
    try {
      const parsed = parse(content, { header: true });
      if (parsed.meta?.fields) {
        setAvailableColumns(parsed.meta.fields);
      }
    } catch (e) {
      console.error('Failed to parse CSV for columns', e);
    }
  });

  const handleApplyFilter = () => {
    if (!column || !condition || !value) {
      toast.error('Please complete all filter fields');
      return;
    }

    try {
      // Parse the CSV data
      const parsed = parse(content, { header: true });

      // Apply the filter
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const filteredData = parsed.data.filter((row: any) => {
        const cellValue = String(row[column] || '').toLowerCase();
        const searchValue = value.toLowerCase();

        switch (condition) {
          case 'contains':
            return cellValue.includes(searchValue);
          case 'equals':
            return cellValue === searchValue;
          case 'startsWith':
            return cellValue.startsWith(searchValue);
          case 'greaterThan':
            return Number(cellValue) > Number(searchValue);
          case 'lessThan':
            return Number(cellValue) < Number(searchValue);
          default:
            return true;
        }
      });

      // Convert back to CSV
      const filteredContent = unparse(filteredData);

      // Apply the filter
      onApplyFilter(filteredContent);

      // Notify user
      toast.success(`Filter applied: ${column} ${condition} ${value}`);
    } catch (e) {
      toast.error('Error applying filter');
      console.error(e);
    }
  };

  return (
    <div className="p-4 space-y-4 border rounded-lg bg-muted/30">
      <h3 className="font-medium">Bioinformatics Data Filters</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Select value={column} onValueChange={setColumn}>
          <SelectTrigger>
            <SelectValue placeholder="Select column" />
          </SelectTrigger>
          <SelectContent>
            {availableColumns.map((col) => (
              <SelectItem key={col} value={col}>
                {col}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={condition} onValueChange={setCondition}>
          <SelectTrigger>
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contains">Contains</SelectItem>
            <SelectItem value="equals">Equals</SelectItem>
            <SelectItem value="startsWith">Starts with</SelectItem>
            <SelectItem value="greaterThan">Greater than</SelectItem>
            <SelectItem value="lessThan">Less than</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Filter value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>

      <Button onClick={handleApplyFilter}>Apply Filter</Button>

      {metadata?.filterHistory && metadata.filterHistory.length > 0 && (
        <div className="mt-2">
          <p className="text-sm text-muted-foreground">Applied filters:</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {metadata.filterHistory.map((filter) => (
              <Badge
                key={`${filter.column}-${filter.condition}-${filter.value}`}
                variant="outline"
              >
                {filter.column} {filter.condition} {filter.value}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Pathway highlighting component
function PathwayHighlighter({
  content,
  onHighlight,
}: {
  content: string;
  onHighlight: (highlightedContent: string) => void;
}) {
  const [pathway, setPathway] = useState<string>('');
  const [pathwayOptions, setPathwayOptions] = useState<string[]>([
    'Glycolysis',
    'Krebs cycle',
    'Apoptosis',
    'DNA repair',
    'Cell cycle',
    'Immune response',
  ]);

  const handleHighlight = async () => {
    try {
      // Call the backend API to highlight genes in the selected pathway
      const response = await fetch('/api/bioflow/highlight-pathway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, pathway }),
      });

      if (!response.ok) {
        throw new Error('Failed to highlight pathway');
      }

      const data = await response.json();
      onHighlight(data.highlightedContent);
      toast.success(`Highlighted genes in the ${pathway} pathway`);
    } catch (error) {
      console.error('Error highlighting pathway:', error);
      toast.error('Failed to highlight pathway');
    }
  };

  return (
    <div className="p-4 space-y-4 border rounded-lg bg-muted/30">
      <h3 className="font-medium">Pathway Highlighting</h3>
      <div className="flex gap-2">
        <Select value={pathway} onValueChange={setPathway}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select pathway" />
          </SelectTrigger>
          <SelectContent>
            {pathwayOptions.map((path) => (
              <SelectItem key={path} value={path}>
                {path}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleHighlight}>Highlight</Button>
      </div>
    </div>
  );
}

export const sheetArtifact = new Artifact<'sheet', BioSheetMetadata>({
  kind: 'sheet',
  description: 'Useful for working with spreadsheets and bioinformatics data',
  initialize: async ({ setMetadata }) => {
    // Initialize with default metadata for bio sheets
    setMetadata({
      dataType: 'general',
      filterHistory: [],
    });
  },
  onStreamPart: ({ setArtifact, streamPart, setMetadata }) => {
    if (streamPart.type === 'sheet-delta') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.content as string,
        isVisible: true,
        status: 'streaming',
      }));
    }

    // Handle bio-specific metadata updates
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    if (streamPart.type === ('bio-metadata' as any)) {
      setMetadata((metadata) => ({
        ...metadata,
        ...(streamPart.content as BioSheetMetadata),
      }));
    }
  },
  content: ({
    content,
    currentVersionIndex,
    isCurrentVersion,
    onSaveContent,
    status,
    metadata,
  }) => {
    const [showBioTools, setShowBioTools] = useState(false);
    const [bioDataDetected, setBioDataDetected] = useState(false);

    // Check if the content appears to be bioinformatics data
    useState(() => {
      if (!content) return;

      try {
        const parsed = parse(content, { header: true });
        const headers = parsed.meta?.fields || [];

        // Check for common bioinformatics column headers
        const bioinformaticsColumns = [
          'gene',
          'transcript',
          'chromosome',
          'position',
          'variant',
          'p_value',
          'log2fc',
          'padj',
          'fdr',
          'expression',
          'count',
          'ensembl',
          'entrez',
          'uniprot',
          'go_term',
          'pathway',
        ];

        const hasBioColumns = headers.some((header) =>
          bioinformaticsColumns.some((bioCol) =>
            header.toLowerCase().includes(bioCol.toLowerCase()),
          ),
        );

        setBioDataDetected(hasBioColumns);
      } catch (e) {
        console.error('Failed to parse CSV for bio detection', e);
      }
    });

    return (
      <div className="space-y-4">
        {bioDataDetected && (
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-green-800 dark:text-green-300 font-medium">
                  Bioinformatics data detected
                </h3>
                <p className="text-sm text-green-700 dark:text-green-400">
                  Specialized tools available for this dataset
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowBioTools(!showBioTools)}
              >
                {showBioTools ? 'Hide Tools' : 'Show Tools'}
              </Button>
            </div>
          </div>
        )}

        {showBioTools && bioDataDetected && (
          <div className="space-y-4">
            <BioFilterPanel
              content={content}
              metadata={metadata as BioSheetMetadata}
              onApplyFilter={(filteredContent) => {
                onSaveContent(filteredContent, false);
                // Update filter history in metadata
                const filterHistory = metadata?.filterHistory || [];
                const updatedHistory = [
                  ...filterHistory,
                  // This is simplified, in a real implementation we'd extract these values
                  {
                    column: 'selected_column',
                    condition: 'condition',
                    value: 'value',
                  },
                ];
                // This would need proper implementation with setMetadata
              }}
            />

            <PathwayHighlighter
              content={content}
              onHighlight={(highlightedContent) => {
                onSaveContent(highlightedContent, false);
              }}
            />
          </div>
        )}

        <SpreadsheetEditor
          content={content}
          currentVersionIndex={currentVersionIndex}
          isCurrentVersion={isCurrentVersion}
          saveContent={onSaveContent}
          status={status}
        />
      </div>
    );
  },
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
      icon: <CopyIcon />,
      description: 'Copy as .csv',
      onClick: ({ content }) => {
        const parsed = parse<string[]>(content, { skipEmptyLines: true });

        const nonEmptyRows = parsed.data.filter((row) =>
          row.some((cell) => cell.trim() !== ''),
        );

        const cleanedCsv = unparse(nonEmptyRows);

        navigator.clipboard.writeText(cleanedCsv);
        toast.success('Copied csv to clipboard!');
      },
    },
    {
      icon: <FileIcon size={18} />,
      description: 'Filter Genetic Data',
      onClick: ({ content }) => {
        // This action will be implemented differently
        toast.info('Filter functionality is available in the bio tools panel');
      },
    },
    {
      icon: <MenuIcon size={18} />,
      description: 'Search for gene',
      onClick: ({ content }) => {
        // This action will be implemented differently
        toast.info('Search functionality is available in the bio tools panel');
      },
    },
  ],
  toolbar: [
    {
      description: 'Format and clean data',
      icon: <SparklesIcon />,
      onClick: ({ appendMessage }: ArtifactToolbarContext) => {
        appendMessage({
          role: 'user',
          content: 'Can you please format and clean the data?',
        });
      },
    },
    {
      description: 'Analyze and visualize data',
      icon: <LineChartIcon />,
      onClick: ({ appendMessage }: ArtifactToolbarContext) => {
        appendMessage({
          role: 'user',
          content:
            'Can you please analyze and visualize the data by creating a new code artifact in python?',
        });
      },
    },
    {
      description: 'Generate Gene Expression Heatmap',
      icon: <BarChartIcon />,
      onClick: ({ appendMessage }: ArtifactToolbarContext) => {
        appendMessage({
          role: 'user',
          content:
            'Please create a heatmap visualization for this gene expression data',
        });
      },
    },
    {
      description: 'Perform Pathway Enrichment',
      icon: <InfoIcon />,
      onClick: ({ appendMessage }: ArtifactToolbarContext) => {
        appendMessage({
          role: 'user',
          content:
            'Can you perform pathway enrichment analysis on the significant genes in this dataset?',
        });
      },
    },
  ],
});
