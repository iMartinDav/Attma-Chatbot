import { put } from '@vercel/blob';

export async function uploadToBlob({
  file,
  filename,
  contentType = 'application/octet-stream',
  access = 'public',
}: {
  file: Blob;
  filename: string;
  contentType?: string;
  access?: 'public';
}) {
  const fileBuffer = await file.arrayBuffer();
  const blobData = await put(filename, fileBuffer, {
    access: 'public',
    contentType,
  });
  return {
    contentType,
    ...blobData,
  };
}
