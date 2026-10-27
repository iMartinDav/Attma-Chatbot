import { auth } from '@/app/(auth)/auth';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

/**
 * Issues tokens for direct browser-to-Blob uploads, so files skip the 4.5 MB
 * function body limit: VCFs, count matrices and .h5ad files go straight to
 * storage and the agent stages them into its Python workspace.
 */

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        if (!session?.user) throw new Error('Sign in to upload files.');
        return { maximumSizeInBytes: MAX_UPLOAD_BYTES, addRandomSuffix: true };
      },
      // The browser gets the blob back directly; nothing to record here.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed.' },
      { status: 400 },
    );
  }
}
