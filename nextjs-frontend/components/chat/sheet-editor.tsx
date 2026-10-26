'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { parse, unparse } from 'papaparse';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  type Row,
} from '@tanstack/react-table';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableFooter,
  TableHeader,
} from '../ui/table';

// Add a type for possible status values
type SheetStatus = 'idle' | 'loading' | 'streaming' | 'system';

type SheetEditorProps = {
  content: string;
  saveContent: (content: string, isCurrentVersion: boolean) => void;
  status: SheetStatus | string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
};

const MIN_ROWS = 50;
const MIN_COLS = 26;

interface SheetCell {
  value: string;
  column: string;
  row: number;
}

interface SheetRow {
  id: number;
  cells: Record<string, SheetCell>;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const PureSpreadsheetEditor = ({
  content,
  saveContent,
  status,
  isCurrentVersion,
}: SheetEditorProps) => {
  const { theme } = useTheme();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageSize, setPageSize] = useState(25);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    column: string;
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showHeaders, setShowHeaders] = useState(false);

  // Check if we're in system mode
  const isSystemMode = status === 'system';

  // Parse CSV content into structured data with padding
  const parseData = useMemo(() => {
    if (!content) return Array(MIN_ROWS).fill(Array(MIN_COLS).fill(''));

    const result = parse<string[]>(content, { skipEmptyLines: true });
    const paddedData = result.data.map((row) => {
      const paddedRow = [...row];
      while (paddedRow.length < MIN_COLS) paddedRow.push('');
      return paddedRow;
    });

    while (paddedData.length < MIN_ROWS) {
      paddedData.push(Array(MIN_COLS).fill(''));
    }

    return paddedData;
  }, [content]);

  // Convert parsed data to row objects for table
  const data = useMemo(
    () =>
      parseData.map((row, rowIndex) => {
        const rowData: SheetRow = {
          id: rowIndex,
          cells: {},
        };

        row.forEach((cell: string, colIndex: number) => {
          rowData.cells[colIndex.toString()] = {
            value: cell || '',
            column: String.fromCharCode(65 + colIndex),
            row: rowIndex,
          };
        });

        return rowData;
      }),
    [parseData],
  );

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const searchLower = searchTerm.toLowerCase();

    return data.filter((row) =>
      Object.values(row.cells).some((cell) =>
        cell?.value?.toString().toLowerCase().includes(searchLower),
      ),
    );
  }, [data, searchTerm]);

  // Get non-empty row count
  const nonEmptyRowCount = useMemo(
    () =>
      filteredData.filter((row) =>
        Object.values(row.cells).some((cell) => cell?.value?.trim() !== ''),
      ).length,
    [filteredData],
  );

  // Handle cell editing - move this function before it's used in the columns useMemo
  const handleCellEdit = useCallback(
    (rowIndex: number, colIndex: string): void => {
      if (!editingCell || isSystemMode) return; // Prevent edits in system mode

      const updatedData = [...data];
      if (!updatedData[rowIndex].cells[colIndex]) {
        updatedData[rowIndex].cells[colIndex] = {
          value: '',
          column: String.fromCharCode(65 + Number.parseInt(colIndex)),
          row: rowIndex,
        };
      }

      updatedData[rowIndex].cells[colIndex].value = editValue;

      // Convert back to CSV format
      const csvData = updatedData.map((row) =>
        Array.from(
          { length: MIN_COLS },
          (_, i) => row.cells[i.toString()]?.value || '',
        ),
      );

      saveContent(unparse(csvData), true);
      setEditingCell(null);
    },
    [data, editingCell, editValue, saveContent, isSystemMode],
  );

  // Define table columns with conditional row numbers
  const columns = useMemo<ColumnDef<SheetRow>[]>(() => {
    const columnsList: ColumnDef<SheetRow>[] = [];

    if (showHeaders) {
      // Row number column
      columnsList.push({
        id: 'rowNumber',
        header: '',
        cell: ({ row }) => row.index + 1,
        enableSorting: false,
      });
    }

    // Data columns
    Array.from({ length: MIN_COLS }, (_, i) => {
      const columnId = String.fromCharCode(65 + i);
      columnsList.push({
        id: i.toString(),
        header: showHeaders ? columnId : '',
        accessorFn: (row: SheetRow) => row.cells[i.toString()]?.value || '',
        cell: ({
          row,
          column,
        }: {
          row: Row<SheetRow>;
          column: { id: string };
        }) => {
          const colKey = column.id;
          const rowKey = row.index;
          const cellValue = row.original.cells[colKey]?.value || '';
          const isEditing =
            !isSystemMode && // Don't allow editing in system mode
            editingCell &&
            editingCell.row === rowKey &&
            editingCell.column === colKey;

          return isEditing ? (
            <CellEditor
              value={editValue}
              onChange={setEditValue}
              onSave={() => handleCellEdit(rowKey, colKey)}
            />
          ) : (
            <button
              type="button"
              aria-label={`Cell ${String.fromCharCode(65 + Number(colKey))}-${rowKey + 1}, value: ${cellValue || 'empty'}`}
              aria-disabled={isSystemMode}
              disabled={isSystemMode}
              className={cn(
                'min-w-[100px] min-h-[32px] p-2 truncate text-left bg-transparent border-none',
                isSystemMode
                  ? 'cursor-not-allowed bg-muted/50 text-muted-foreground'
                  : 'cursor-text focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-ring',
              )}
              onClick={() => {
                if (!isSystemMode) {
                  setEditingCell({ row: rowKey, column: colKey });
                  setEditValue(cellValue);
                }
              }}
              onKeyDown={(e) => {
                if (!isSystemMode && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  setEditingCell({ row: rowKey, column: colKey });
                  setEditValue(cellValue);
                }
              }}
            >
              {cellValue}
            </button>
          );
        },
      });
    });

    return columnsList;
  }, [editingCell, editValue, showHeaders, handleCellEdit, isSystemMode]);

  // Export CSV
  const exportCSV = useCallback(() => {
    const nonEmptyRows = data
      .filter((row) =>
        Object.values(row.cells).some((cell) => cell?.value?.trim() !== ''),
      )
      .map((row) =>
        Array.from(
          { length: MIN_COLS },
          (_, i) => row.cells[i.toString()]?.value || '',
        ),
      );

    const csv = unparse(nonEmptyRows);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'data_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up
  }, [data]);

  // Initialize table
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: { pageSize },
    },
  });

  // Update pagination when page size changes
  useEffect(() => {
    table.setPageSize(pageSize);
  }, [pageSize, table]);

  const currentPage = table.getState().pagination.pageIndex + 1;
  const totalPages = table.getPageCount();

  return (
    <div className="space-y-4">
      <div className="bg-background rounded-xl p-5">
        <div className="flex flex-col space-y-4 mb-6">
          {isSystemMode && (
            <div className="flex items-center gap-2 p-2 rounded-lg mb-2 bg-accent/20 text-accent-foreground">
              <Lock className="size-4" />
              <span>System mode - Read only data</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <ToggleHeadersButton
                showHeaders={showHeaders}
                onToggle={() => setShowHeaders(!showHeaders)}
              />

              <Button
                variant="outline"
                size="sm"
                onClick={exportCSV}
                className="rounded-full h-9 px-4 transition-all hover:bg-secondary"
              >
                <Download className="size-4 mr-2" />
                Export CSV
              </Button>

              <PageSizeSelector
                value={pageSize.toString()}
                onChange={(value) => setPageSize(Number(value))}
              />
            </div>
          </div>
        </div>

        <div
          className={cn(
            'p-[2px] rounded-xl bg-linear-to-r shadow-xl',
            isSystemMode
              ? 'from-amber-500/20 via-orange-500/20 to-yellow-500/20'
              : 'from-indigo-500/20 via-purple-500/20 to-pink-500/20',
          )}
        >
          <div className="bg-background rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                {showHeaders && (
                  <TableHeader className="bg-muted/50">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow
                        key={headerGroup.id}
                        className="hover:bg-muted/80 border-b border-border"
                      >
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            className={cn(
                              'px-2 py-3 font-semibold text-center',
                              header.id === 'rowNumber' && 'w-[50px] bg-muted',
                            )}
                          >
                            <div className="flex items-center justify-center space-x-1">
                              <span>
                                {header.isPlaceholder
                                  ? null
                                  : flexRender(
                                      header.column.columnDef.header,
                                      header.getContext(),
                                    )}
                              </span>
                              {header.id !== 'rowNumber' &&
                                header.column.getCanSort() && (
                                  <SortButton column={header.column} />
                                )}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                )}

                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && 'selected'}
                        className={cn(
                          'border-b border-border hover:bg-muted/30',
                          row.index % 2 === 0 ? 'bg-background' : 'bg-muted/10',
                        )}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              'p-0 text-left',
                              cell.column.id === 'rowNumber' &&
                                'bg-muted font-medium text-center w-[40px]',
                            )}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <EmptyTableRow colSpan={columns.length} />
                  )}
                </TableBody>

                <TableFooter className="bg-muted/50">
                  <TableRow className="hover:bg-muted/80">
                    <TableCell colSpan={columns.length} className="p-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          {filteredData.length > 0 &&
                            `${nonEmptyRowCount} rows`}
                        </div>

                        <PaginationControls
                          currentPage={currentPage}
                          totalPages={totalPages}
                          canPrevious={table.getCanPreviousPage()}
                          canNext={table.getCanNextPage()}
                          onFirst={() => table.setPageIndex(0)}
                          onPrevious={() => table.previousPage()}
                          onNext={() => table.nextPage()}
                          onLast={() =>
                            table.setPageIndex(table.getPageCount() - 1)
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Cell editor component
const CellEditor = ({
  value,
  onChange,
  onSave,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}) => (
  <Input
    autoFocus
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onBlur={onSave}
    onKeyDown={(e) => {
      if (e.key === 'Enter') onSave();
    }}
    className="w-full h-8 p-1 border-none focus:ring-0"
  />
);

// Search input component
const SearchInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => (
  <div className="relative w-full sm:w-auto sm:min-w-[320px]">
    <Input
      placeholder="Search data content..."
      value={value}
      onChange={onChange}
      className="pl-9 rounded-full border-border shadow-xs"
    />
    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
      <Search className="size-4" />
    </div>
  </div>
);

// Toggle headers button
const ToggleHeadersButton = ({
  showHeaders,
  onToggle,
}: {
  showHeaders: boolean;
  onToggle: () => void;
}) => (
  <Button
    variant="outline"
    size="sm"
    onClick={onToggle}
    className="rounded-full h-9 px-4 transition-all hover:bg-secondary"
  >
    {showHeaders ? (
      <>
        <EyeOff className="size-4 mr-2" />
        Hide Headers
      </>
    ) : (
      <>
        <Eye className="size-4 mr-2" />
        Show Headers
      </>
    )}
  </Button>
);

// Page size selector
const PageSizeSelector = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="h-9 w-[120px] rounded-full border-border shadow-xs">
      <SelectValue placeholder={`${value} rows`} />
    </SelectTrigger>
    <SelectContent className="rounded-xl border-border">
      {PAGE_SIZE_OPTIONS.map((size) => (
        <SelectItem key={size} value={size.toString()}>
          {size} rows
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

// Sort button component
const SortButton = ({ column }: { column: any }) => (
  <Button
    variant="ghost"
    size="sm"
    className="size-6 p-0 rounded-full ml-1 opacity-70 hover:opacity-100"
    onClick={column.getToggleSortingHandler()}
  >
    {column.getIsSorted() === 'asc' ? (
      <SortAsc className="size-3" />
    ) : column.getIsSorted() === 'desc' ? (
      <SortDesc className="size-3" />
    ) : (
      <SortAsc className="size-3 opacity-30" />
    )}
  </Button>
);

// Empty table row component
const EmptyTableRow = ({ colSpan }: { colSpan: number }) => (
  <TableRow>
    <TableCell colSpan={colSpan} className="h-32 text-center">
      <div className="flex flex-col items-center justify-center text-muted-foreground">
        <Filter className="size-8 mb-2 opacity-50" />
        <p>No results found</p>
        <p className="text-sm">Try adjusting your search</p>
      </div>
    </TableCell>
  </TableRow>
);

// Pagination controls
const PaginationControls = ({
  currentPage,
  totalPages,
  canPrevious,
  canNext,
  onFirst,
  onPrevious,
  onNext,
  onLast,
}: {
  currentPage: number;
  totalPages: number;
  canPrevious: boolean;
  canNext: boolean;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
}) => (
  <div className="flex items-center space-x-2">
    <Button
      variant="outline"
      size="sm"
      onClick={onFirst}
      disabled={!canPrevious}
      className="rounded-full size-8 p-0 border-border transition-colors"
    >
      <span className="sr-only">Go to first page</span>
      <ChevronsLeft className="size-4" />
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={onPrevious}
      disabled={!canPrevious}
      className="rounded-full size-8 p-0 border-border transition-colors"
    >
      <span className="sr-only">Go to previous page</span>
      <ChevronLeft className="size-4" />
    </Button>
    <span className="text-sm">
      Page <strong>{currentPage}</strong> of <strong>{totalPages || 1}</strong>
    </span>
    <Button
      variant="outline"
      size="sm"
      onClick={onNext}
      disabled={!canNext}
      className="rounded-full size-8 p-0 border-border transition-colors"
    >
      <span className="sr-only">Go to next page</span>
      <ChevronRight className="size-4" />
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={onLast}
      disabled={!canNext}
      className="rounded-full size-8 p-0 border-border transition-colors"
    >
      <span className="sr-only">Go to last page</span>
      <ChevronsRight className="size-4" />
    </Button>
  </div>
);

function areEqual(prevProps: SheetEditorProps, nextProps: SheetEditorProps) {
  // If we transition to or from system mode, we should re-render
  if ((prevProps.status === 'system') !== (nextProps.status === 'system')) {
    return false;
  }

  return (
    prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    !(prevProps.status === 'streaming' && nextProps.status === 'streaming') &&
    prevProps.content === nextProps.content &&
    prevProps.saveContent === nextProps.saveContent
  );
}

export const SpreadsheetEditor = memo(PureSpreadsheetEditor, areEqual);
