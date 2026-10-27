'use client';

import type { Attachment } from '@/lib/types';
import { upload } from '@vercel/blob/client';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

/**
 * Uploads straight from the browser to Vercel Blob (the server only signs the
 * upload), so large data files such as VCFs and .h5ad matrices are accepted.
 */

const MAX_UPLOAD_MB = 500;
const MULTIPART_FROM_BYTES = 50 * 1024 * 1024;

// Browsers report no type for most bioinformatics formats.
const TYPES_BY_EXTENSION: Record<string, string> = {
  vcf: 'text/x-vcf',
  'vcf.gz': 'application/gzip',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  txt: 'text/plain',
  fa: 'text/x-fasta',
  fasta: 'text/x-fasta',
  fastq: 'text/x-fastq',
  'fastq.gz': 'application/gzip',
  h5ad: 'application/x-hdf5',
  h5: 'application/x-hdf5',
  mtx: 'text/plain',
  bed: 'text/plain',
  gtf: 'text/plain',
  json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function mediaTypeOf(file: File) {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  const match = Object.keys(TYPES_BY_EXTENSION)
    .sort((a, b) => b.length - a.length)
    .find((extension) => name.endsWith(`.${extension}`));
  return match ? TYPES_BY_EXTENSION[match] : 'application/octet-stream';
}

interface UseFileUploadReturn {
  uploadFile: (file: File) => Promise<Attachment | undefined>;
  uploadQueue: string[];
  handleFileChange: (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => Promise<void>;
  handleFileDrop: (files: FileList) => Promise<void>;
}

export function useFileUpload(
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>,
): UseFileUploadReturn {
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);

  const uploadFile = useCallback(
    async (file: File): Promise<Attachment | undefined> => {
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        toast.error(`${file.name} is larger than ${MAX_UPLOAD_MB} MB.`);
        return undefined;
      }
      const contentType = mediaTypeOf(file);
      try {
        const blob = await upload(`uploads/${file.name}`, file, {
          access: 'public',
          handleUploadUrl: '/api/files/upload',
          contentType,
          multipart: file.size > MULTIPART_FROM_BYTES,
        });
        return { url: blob.url, name: file.name, contentType };
      } catch (error) {
        toast.error(
          `Could not upload ${file.name}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
        return undefined;
      }
    },
    [],
  );

  const uploadAll = useCallback(
    async (files: File[]) => {
      setUploadQueue(files.map((f) => f.name));
      try {
        const results = await Promise.all(files.map(uploadFile));
        setAttachments((current) => [
          ...current,
          ...results.filter((a): a is Attachment => a !== undefined),
        ]);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile],
  );

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      await uploadAll(Array.from(event.target.files || []));
      event.target.value = '';
    },
    [uploadAll],
  );

  const handleFileDrop = useCallback(
    (files: FileList) => uploadAll(Array.from(files)),
    [uploadAll],
  );

  return { uploadFile, uploadQueue, handleFileChange, handleFileDrop };
}
