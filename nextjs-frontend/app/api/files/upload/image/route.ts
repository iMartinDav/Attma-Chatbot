import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/app/(auth)/auth';

const ImageSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: 'File size should be less than 5MB',
    })
    .refine(
      (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
      {
        message: 'File type should be JPEG, PNG or WebP',
      },
    ),
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

  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const validatedFile = ImageSchema.safeParse({ file });
    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const filename = (formData.get('file') as File).name;
    const fileBuffer = await file.arrayBuffer();
    const data = await put(`${filename}`, fileBuffer, { access: 'public' });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 },
    );
  }
}
