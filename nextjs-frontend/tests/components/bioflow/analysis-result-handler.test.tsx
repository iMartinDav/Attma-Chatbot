import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AnalysisResultHandler } from '@/components/bioflow/analysis-result-handler';
import * as useArtifactModule from '@/hooks/use-artifact';
import { toast } from 'sonner';

// Mock dependencies
jest.mock('sonner', () => ({
  toast: {
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/hooks/use-artifact', () => {
  const actual = jest.requireActual('@/hooks/use-artifact');
  return {
    ...actual,
    useArtifactSelector: jest.fn(),
    useArtifact: jest.fn(),
  };
});

describe('AnalysisResultHandler', () => {
  // Mock task data
  const mockTasks = {
    'task-1': {
      taskId: 'task-1',
      status: 'processing',
      fileId: 'file-1',
      fileName: 'test.mtx',
      checked: true,
    },
  };

  // Setup mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the useArtifact hook
    (useArtifactModule.useArtifact as jest.Mock).mockReturnValue({
      createArtifact: jest.fn(),
      setArtifact: jest.fn(),
    });

    // Mock global fetch
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('/api/bioflow/analysis/task-1/status')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'task-1',
              status: 'completed',
              result_id: 'result-1',
            }),
        });
      }

      if (url.includes('/api/bioflow/analysis/result/result-1')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'result-1',
              analysis_type: 'matrix_structure',
              result_type: 'table',
              small_result: {
                data_type: 'numeric',
                num_rows: 100,
                num_columns: 50,
                column_names: ['cell1', 'cell2', 'cell3'],
                row_names: ['gene1', 'gene2', 'gene3'],
              },
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it('renders without crashing', () => {
    render(<AnalysisResultHandler tasks={mockTasks} interval={10000} />);
    // Component renders silently with no visible UI
    expect(document.body).toBeTruthy();
  });

  it('polls for analysis status and creates Sheet artifact when complete', async () => {
    const createArtifactMock = jest.fn();
    (useArtifactModule.useArtifact as jest.Mock).mockReturnValue({
      createArtifact: createArtifactMock,
      setArtifact: jest.fn(),
    });

    // Render component with task in processing state
    render(<AnalysisResultHandler tasks={mockTasks} interval={100} />);

    // Wait for polling to occur and artifact to be created
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/bioflow/analysis/task-1/status',
        expect.anything(),
      );
    });

    // Wait for result fetch and artifact creation
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/bioflow/analysis/result/result-1',
        expect.anything(),
      );
      expect(createArtifactMock).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'sheet',
          title: expect.stringContaining('test.mtx Analysis'),
        }),
      );
    });

    // Check if success toast was displayed
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('Analysis complete'),
    );
  });

  it('handles fetch errors gracefully', async () => {
    // Override fetch to simulate an error
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    // Mock console.error to check error logging
    const originalConsoleError = console.error;
    console.error = jest.fn();

    render(<AnalysisResultHandler tasks={mockTasks} interval={100} />);

    // Wait for error to be logged
    await waitFor(() => {
      expect(console.error).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Error checking analysis status'),
      );
    });

    // Restore console.error
    console.error = originalConsoleError;
  });

  it('ignores tasks that are still processing', async () => {
    // Mock a task that's still in processing state
    global.fetch = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'task-1',
            status: 'processing',
          }),
      });
    });

    const createArtifactMock = jest.fn();
    (useArtifactModule.useArtifact as jest.Mock).mockReturnValue({
      createArtifact: createArtifactMock,
      setArtifact: jest.fn(),
    });

    render(<AnalysisResultHandler tasks={mockTasks} interval={100} />);

    // Wait for polling to occur
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/bioflow/analysis/task-1/status',
        expect.anything(),
      );
    });

    // No artifact should be created for processing tasks
    expect(createArtifactMock).not.toHaveBeenCalled();
  });

  it('formats Sheet data correctly from analysis result', async () => {
    // Mock a detailed analysis result
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('/api/bioflow/analysis/task-1/status')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'task-1',
              status: 'completed',
              result_id: 'result-1',
            }),
        });
      }

      if (url.includes('/api/bioflow/analysis/result/result-1')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'result-1',
              analysis_type: 'matrix_structure',
              result_type: 'table',
              small_result: {
                data_type: 'numeric',
                num_rows: 3,
                num_columns: 2,
                column_names: ['cell1', 'cell2'],
                row_names: ['gene1', 'gene2', 'gene3'],
                data: [
                  [1.1, 1.2],
                  [2.1, 2.2],
                  [3.1, 3.2],
                ],
              },
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    const createArtifactMock = jest.fn();
    (useArtifactModule.useArtifact as jest.Mock).mockReturnValue({
      createArtifact: createArtifactMock,
      setArtifact: jest.fn(),
    });

    render(<AnalysisResultHandler tasks={mockTasks} interval={100} />);

    // Wait for artifact creation
    await waitFor(() => {
      expect(createArtifactMock).toHaveBeenCalled();

      // Check that the formatted data includes headers and correct structure
      const callArg = createArtifactMock.mock.calls[0][0];
      expect(callArg.content).toContain('"headers":["","cell1","cell2"]');
      expect(callArg.content).toContain('"gene1"');
      expect(callArg.content).toContain('1.1');
      expect(callArg.content).toContain('3.2');
    });
  });
});
