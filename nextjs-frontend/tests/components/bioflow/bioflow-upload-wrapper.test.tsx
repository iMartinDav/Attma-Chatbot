import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BioflowUploadWrapper } from '@/components/bioflow/bioflow-upload-wrapper';
import { SWRConfig } from 'swr';
import { toast } from 'sonner';

// Mock dependencies
jest.mock('sonner', () => ({
  toast: {
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

// Mock global fetch
const originalFetch = global.fetch;

describe('BioflowUploadWrapper', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore the original fetch
    global.fetch = originalFetch;
  });

  it('renders children correctly', () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <BioflowUploadWrapper>
          <div data-testid="test-child">Child component</div>
        </BioflowUploadWrapper>
      </SWRConfig>,
    );

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Child component')).toBeInTheDocument();
  });

  it('intercepts bioflow upload responses and tracks task IDs', async () => {
    // Mock global fetch to simulate a bioflow upload response
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('/api/bioflow/upload')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              file_id: 'test-file-id',
              analysis_task_id: 'test-analysis-task-id',
              original_name: 'test.mtx',
            }),
          clone: function () {
            return this;
          },
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        clone: function () {
          return this;
        },
      });
    });

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <BioflowUploadWrapper>
          <div data-testid="test-child">Child component</div>
        </BioflowUploadWrapper>
      </SWRConfig>,
    );

    // Trigger a mock upload
    await fetch('/api/bioflow/upload', {
      method: 'POST',
      body: new FormData(),
    });

    // Verify toast was called
    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        'Bioinformatics file uploaded. Analysis started.',
      );
    });
  });

  it('ignores non-bioflow upload responses', async () => {
    // Mock global fetch for a regular upload
    global.fetch = jest.fn().mockImplementation((url) => {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            file_id: 'test-file-id',
            original_name: 'test.jpg',
          }),
        clone: function () {
          return this;
        },
      });
    });

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <BioflowUploadWrapper>
          <div data-testid="test-child">Child component</div>
        </BioflowUploadWrapper>
      </SWRConfig>,
    );

    // Trigger a mock upload to a different endpoint
    await fetch('/api/upload', {
      method: 'POST',
      body: new FormData(),
    });

    // Verify toast was not called for bioflow notification
    await waitFor(() => {
      expect(toast.info).not.toHaveBeenCalled();
    });
  });

  it('handles fetch errors gracefully', async () => {
    // Mock global fetch to throw an error
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('/api/bioflow/upload')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.reject(new Error('Test error')),
          clone: function () {
            return this;
          },
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        clone: function () {
          return this;
        },
      });
    });

    // Mock console.debug to check for error logging
    const originalConsoleDebug = console.debug;
    console.debug = jest.fn();

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <BioflowUploadWrapper>
          <div data-testid="test-child">Child component</div>
        </BioflowUploadWrapper>
      </SWRConfig>,
    );

    // Trigger a mock upload that will fail
    await fetch('/api/bioflow/upload', {
      method: 'POST',
      body: new FormData(),
    });

    // Verify error was logged but didn't crash component
    await waitFor(() => {
      expect(console.debug).toHaveBeenCalled();
      expect(screen.getByTestId('test-child')).toBeInTheDocument();
    });

    // Restore console.debug
    console.debug = originalConsoleDebug;
  });
});
