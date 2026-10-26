import { auth } from '@/app/(auth)/auth';
import { uploadToBlob } from '@/lib/blob-upload';
import { saveDocument } from '@/lib/db/queries';
import { rateLimit } from '@/lib/rate-limit';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Configure limits for file uploads
const MAX_UPLOAD_SIZE = 200 * 1024 * 1024; // 200MB
const CONTENT_TYPE_WHITELIST = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json',
  'application/octet-stream',
  'application/zip',
  'application/gzip',
  'application/x-tar',
  'text/tab-separated-values',
  'text/markdown',
  'image/png',
  'image/jpeg',
  // Add other allowed content types
];

// Route Segment Config
export const maxDuration = 60; // Extend timeout to 60 seconds
export const dynamic = 'force-dynamic';
// Note: App Router handlers (POST) automatically handle body streaming, so bodyParser config is not needed.

// Create a rate limiter for the bioflow upload endpoint
// 10 requests per minute per IP/user
const uploadLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

/**
 * API route handler for bioflow file uploads
 * Stores bioinformatics files in Blob storage and records them as documents
 *
 * @param request - The incoming request object
 * @returns NextResponse with upload result or error information
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Bioflow upload request started`);

  try {
    // 1. Check rate limit (per IP/session)
    // Extract IP address from headers or fallback to 'anonymous'
    const forwardedFor = request.headers.get('x-forwarded-for');
    const identifier = forwardedFor?.split(',')[0]?.trim() || 'anonymous';
    try {
      await uploadLimiter.check(10, identifier);
    } catch (error) {
      console.warn(`[${requestId}] Rate limit exceeded for IP: ${identifier}`);
      return NextResponse.json(
        { error: 'Too many uploads. Please wait before trying again.' },
        { status: 429 },
      );
    }

    // 2. Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      console.warn(`[${requestId}] Unauthorized upload attempt`);
      return NextResponse.json(
        {
          error: 'Authentication required. Please sign in to upload files.',
        },
        { status: 401 },
      );
    }

    const userId = session.user.id;

    // 3. Parse form data with error handling
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      console.error(`[${requestId}] Failed to parse form data:`, error);
      return NextResponse.json(
        {
          error: 'Invalid form data. Please check your request and try again.',
        },
        { status: 400 },
      );
    }

    // 4. Extract and validate file from form data
    const file = formData.get('file') as Blob;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // 5. Perform file validation
    const filename = (formData.get('file') as File)?.name || 'bioflow-upload';
    const contentType = file.type || 'application/octet-stream';
    const fileSize = file.size;

    // Validate file size
    if (fileSize > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB`,
        },
        { status: 413 },
      );
    }

    // Validate content type (optional whitelist check)
    if (
      CONTENT_TYPE_WHITELIST.length > 0 &&
      !CONTENT_TYPE_WHITELIST.includes(contentType)
    ) {
      console.warn(`[${requestId}] Invalid content type: ${contentType}`);
      // Still allow upload but log the warning
    }

    // Log beginning of upload process with useful debug info
    console.log(
      `[${requestId}] Processing upload: ${filename} (${fileSize / 1024 / 1024}MB) of type ${contentType}`,
    );

    // 6. Upload to Blob storage with proper error handling
    let blobResult: Awaited<ReturnType<typeof uploadToBlob>>;
    try {
      blobResult = await uploadToBlob({
        file,
        filename: `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`, // Sanitize filename
        contentType,
        access: 'public',
      });

      console.log(
        `[${requestId}] File uploaded to blob storage: ${blobResult.url}`,
      );
    } catch (error) {
      console.error(`[${requestId}] Blob storage upload failed:`, error);
      return NextResponse.json(
        {
          error: 'Failed to upload file to storage. Please try again.',
          details:
            process.env.NODE_ENV === 'development' ? String(error) : undefined,
        },
        { status: 500 },
      );
    }

    // 7. Save document in database for tracking
    const kind = inferFileKind(contentType, filename);
    const docId = crypto.randomUUID();

    try {
      await saveDocument({
        id: docId,
        title: filename,
        kind,
        content: blobResult.url,
        userId,
      });

      console.log(`[${requestId}] Document saved with ID: ${docId}`);
    } catch (dbError) {
      console.error(
        `[${requestId}] Failed to save document in database:`,
        dbError,
      );
      // Continue execution - don't fail the upload if DB save fails
    }

    // 8. Return comprehensive response with performance metrics
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Upload completed in ${duration}ms`);

    return NextResponse.json({
      ...blobResult,
      document: {
        id: docId,
        title: filename,
        kind,
        content: blobResult.url,
        userId,
      },
      processingStatus: 'uploaded',
      uploadDuration: duration,
      message: 'File uploaded successfully.',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[${requestId}] Critical error during upload (${duration}ms):`,
      error,
    );

    // Return structured error response with appropriate status code
    return NextResponse.json(
      {
        error: 'An unexpected error occurred during upload',
        errorId: requestId, // Include for support reference
        details:
          process.env.NODE_ENV === 'development'
            ? error instanceof Error
              ? error.stack
              : String(error)
            : undefined,
      },
      {
        status: 500,
        headers: {
          // Add security headers
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  }
}

/**
 * Helper function to infer document kind from file type
 *
 * @param contentType - The MIME type of the file
 * @param filename - The name of the file
 * @returns The inferred document kind
 */
function inferFileKind(
  contentType: string,
  filename: string,
): 'text' | 'code' | 'image' | 'sheet' | 'pdf' {
  // Normalize filename and extension
  const filenameLower = filename.toLowerCase();

  // Check content type first
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType.startsWith('text/')) return 'text';

  // Then check filename extension
  if (filenameLower.endsWith('.pdf')) return 'pdf';
  if (filenameLower.match(/\.(jpe?g|png|gif|webp|svg|bmp)$/)) return 'image';
  if (filenameLower.match(/\.(csv|xlsx?|tsv|ods)$/)) return 'sheet';
  if (
    filenameLower.match(
      /\.(json|ya?ml|xml|js|ts|py|java|c|cpp|cs|go|rs|php|rb|pl)$/,
    )
  )
    return 'code';
  if (filenameLower.match(/\.(txt|md|rtf|html?|log|tex)$/)) return 'text';

  // Handle bioinformatics file formats
  if (filenameLower.match(/\.(fastq|bam|vcf|mtx|h5ad|h5|hdf5|dgz)$/))
    return 'sheet';

  // Fallback for unknown types
  return 'text';
}
