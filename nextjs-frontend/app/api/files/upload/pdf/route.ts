import { auth } from '@/app/(auth)/auth';
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const PDFSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 10 * 1024 * 1024, {
      message: 'PDF file size should be less than 10MB',
    })
    .refine((file) => file.type === 'application/pdf', {
      message: 'File type should be PDF',
    }),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (request.body === null) {
    return NextResponse.json(
      { error: 'Request body is empty' },
      { status: 400 },
    );
  }

  const filename = 'document.pdf';
  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const validatedFile = PDFSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.issues
        .map((error) => error.message)
        .join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const filename = (formData.get('file') as File).name;
    const fileBuffer = await file.arrayBuffer();

    // Upload to Vercel Blob
    const blobData = await put(`pdfs/${filename}`, fileBuffer, {
      access: 'public',
    });

    // Format response to match image upload which is known to work reliably
    return NextResponse.json({
      url: blobData.url,
      pathname: filename,
      contentType: 'application/pdf',
    });
  } catch (error) {
    console.error('Error processing PDF:', error);

    // Return a simpler error that won't break the chat
    return NextResponse.json(
      {
        url: '',
        pathname: filename || 'document.pdf',
        contentType: 'application/pdf',
        error: 'PDF upload temporarily unavailable',
      },
      { status: 200 },
    ); // Return 200 even on error to prevent chat disruption
  }
}
