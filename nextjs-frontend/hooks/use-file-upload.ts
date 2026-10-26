'use client';

import type { Attachment } from '@/lib/types';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

const BIOINFORMATICS_EXTENSIONS = [
  '.fastq', '.bam', '.vcf', '.mtx', '.h5ad', '.h5', '.hdf5', '.dgz',
];

const DOCUMENT_EXTENSIONS = ['.csv', '.tsv'];

interface UseFileUploadReturn {
  uploadFile: (file: File) => Promise<Attachment | undefined>;
  uploadQueue: string[];
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleFileDrop: (files: FileList) => Promise<void>;
}

function getUploadUrl(file: File): string {
  const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  const fileSizeMB = file.size / (1024 * 1024);

  const isZip = file.type === 'application/zip' || file.name.endsWith('.zip');
  const isGzip = file.type === 'application/gzip' || file.name.endsWith('.gz') || file.name.endsWith('.tgz');
  const isTar = file.name.endsWith('.tar');
  const isBioinformatics = BIOINFORMATICS_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
  const isDocument = DOCUMENT_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isText = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt') ||
    file.type === 'text/markdown' || file.name.toLowerCase().endsWith('.md');
  const isLarge = fileSizeMB > 5;

  if (file.type.startsWith('image/')) {
    return '/api/files/upload/image';
  }
  if (isPdf && fileSizeMB <= 10) {
    return '/api/files/upload/pdf';
  }
  if (isText && fileSizeMB <= 25) {
    return '/api/files/upload/text';
  }
  if (isZip || isGzip || isTar || isBioinformatics || isDocument || isLarge ||
      (isPdf && fileSizeMB > 10) || (isText && fileSizeMB > 25)) {
    return '/api/files/upload/bioflow/upload';
  }

  return '/api/files/upload';
}

export function useFileUpload(
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>,
): UseFileUploadReturn {
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);

  const uploadFile = useCallback(async (file: File): Promise<Attachment | undefined> => {
    const formData = new FormData();
    formData.append('file', file);

    const uploadUrl = getUploadUrl(file);
    const fileSizeMB = file.size / (1024 * 1024);
    const isLargeFile = fileSizeMB > 5;
    const isBioflowUpload = uploadUrl.includes('bioflow');

    // Show size warnings for bioflow uploads
    if (isBioflowUpload) {
      if (fileSizeMB > 200) {
        toast.warning(`Very large file (${fileSizeMB.toFixed(1)}MB). The server might reject it.`);
      } else if (isLargeFile) {
        toast.info(`Large file detected (${fileSizeMB.toFixed(1)}MB). Processing may take longer.`);
      }

      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      formData.append('fileType', fileExtension);
      formData.append('isCompressed', String(
        file.type === 'application/zip' || file.type === 'application/gzip' ||
        file.name.endsWith('.gz') || file.name.endsWith('.tar')
      ));
      formData.append('needsProcessing', 'true');
      formData.append('fileSizeMB', fileSizeMB.toString());
    }

    const MAX_RETRIES = 2;
    let retries = 0;

    while (retries <= MAX_RETRIES) {
      try {
        const timeoutMs = isLargeFile
          ? Math.min(300000, Math.max(120000, fileSizeMB * 2000))
          : 30000;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
          credentials: 'include',
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();

          toast.success(`File "${file.name}" uploaded successfully`);
          return {
            url: data.url,
            name: data.pathname || file.name,
            contentType: data.contentType || file.type,
          };
        }

        // Handle specific error codes
        if (response.status === 413) {
          toast.error(`File is too large (${fileSizeMB.toFixed(1)}MB). Maximum allowed size is 200MB.`);
          return undefined;
        }
        if (response.status === 401) {
          toast.error('Session expired. Please refresh the page and try again.');
          return undefined;
        }
        if (response.status >= 400 && response.status < 500) {
          const errorData = await response.json().catch(() => ({}));
          toast.error(errorData.detail || errorData.error || `Failed to upload file (${response.status})`);
          return undefined;
        }

        // Retry for server errors
        if (retries < MAX_RETRIES) {
          retries++;
          toast.info(`Upload retry ${retries}/${MAX_RETRIES} for "${file.name}"...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** (retries - 1)));
          continue;
        }

        toast.error(`Failed to upload ${file.name} after ${MAX_RETRIES} retries.`);
        return undefined;

      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          toast.error(`Upload timed out for "${file.name}". Try a smaller file or check your connection.`);
          return undefined;
        }

        if (retries < MAX_RETRIES) {
          retries++;
          toast.info(`Upload retry ${retries}/${MAX_RETRIES} for "${file.name}"...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** (retries - 1)));
          continue;
        }

        toast.error(`Failed to upload ${file.name}. Please check your connection.`);
        return undefined;
      }
    }

    return undefined;
  }, []);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadQueue(files.map(f => f.name));

    try {
      const results = await Promise.all(files.map(uploadFile));
      const successful = results.filter((a): a is Attachment => a !== undefined);
      setAttachments(current => [...current, ...successful]);
    } finally {
      setUploadQueue([]);
    }
  }, [setAttachments, uploadFile]);

  const handleFileDrop = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files);
    setUploadQueue(fileArray.map(f => f.name));

    try {
      const results = await Promise.all(fileArray.map(uploadFile));
      const successful = results.filter((a): a is Attachment => a !== undefined);
      setAttachments(current => [...current, ...successful]);
    } finally {
      setUploadQueue([]);
    }
  }, [setAttachments, uploadFile]);

  return { uploadFile, uploadQueue, handleFileChange, handleFileDrop };
}
