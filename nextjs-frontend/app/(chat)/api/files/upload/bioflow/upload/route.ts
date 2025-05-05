import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { uploadToBlob } from '@/app/lib/blob-upload';
import { saveDocument } from '@/lib/db/queries';
import { auth } from '@/app/(auth)/auth';
import { rateLimit } from '@/lib/rate-limit';

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

// Important: Use a consistent config format for App Router
export const config = {
  api: {
    bodyParser: false, // Critical: Disable the built-in parser for large files
    externalResolver: true, // Tell Next.js that the route is handled externally
  },
  maxDuration: 60, // Extend the function timeout to 60 seconds for large uploads
};

// Create a rate limiter for the bioflow upload endpoint
// 10 requests per minute per IP/user
const uploadLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

/**
 * API route handler for bioflow file uploads
 * This route proxies large file uploads to the FastAPI backend with proper streaming
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
    try {
      const identifier = request.ip || 'anonymous';
      await uploadLimiter.check(10, identifier);
    } catch (error) {
      console.warn(`[${requestId}] Rate limit exceeded for IP: ${request.ip}`);
      return NextResponse.json(
        { error: 'Too many uploads. Please wait before trying again.' },
        { status: 429 }
      );
    }

    // 2. Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      console.warn(`[${requestId}] Unauthorized upload attempt`);
      return NextResponse.json({ 
        error: 'Authentication required. Please sign in to upload files.' 
      }, { status: 401 });
    }
    
    const userId = session.user.id;

    // 3. Parse form data with error handling
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      console.error(`[${requestId}] Failed to parse form data:`, error);
      return NextResponse.json({
        error: 'Invalid form data. Please check your request and try again.'
      }, { status: 400 });
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
      return NextResponse.json({
        error: `File too large. Maximum size is ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB`,
      }, { status: 413 });
    }

    // Validate content type (optional whitelist check)
    if (CONTENT_TYPE_WHITELIST.length > 0 && !CONTENT_TYPE_WHITELIST.includes(contentType)) {
      console.warn(`[${requestId}] Invalid content type: ${contentType}`);
      // Still allow upload but log the warning
    }

    // Extract metadata from form data to help backend processing
    const metadata = {
      fileType: formData.get('fileType') as string || '',
      isCompressed: formData.get('isCompressed') === 'true',
      needsProcessing: formData.get('needsProcessing') === 'true',
      fileSizeMB: parseFloat((formData.get('fileSizeMB') as string) || '0'),
      uploadedBy: userId
    };

    // Log beginning of upload process with useful debug info
    console.log(`[${requestId}] Processing upload: ${filename} (${fileSize / 1024 / 1024}MB) of type ${contentType}`);

    // 6. Upload to Blob storage with proper error handling
    let blobResult;
    try {
      blobResult = await uploadToBlob({
        file,
        filename: `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`, // Sanitize filename
        contentType,
        access: 'public',
        metadata: {
          userId,
          originalFilename: filename,
          uploadTime: new Date().toISOString()
        }
      });
      
      console.log(`[${requestId}] File uploaded to blob storage: ${blobResult.url}`);
    } catch (error) {
      console.error(`[${requestId}] Blob storage upload failed:`, error);
      return NextResponse.json({
        error: 'Failed to upload file to storage. Please try again.',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      }, { status: 500 });
    }

    // 7. Trigger backend processing with proper retry logic and timeout
    let backendTask = null;
    
    // Use environment-aware backend URL selection
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 
                       process.env.BACKEND_SERVICE_URL || 
                       'http://fastapi_backend:8000';  // Docker service name
                       
    const processFromBlobUrl = `${backendUrl}/bioflow/process-from-blob/`;
    
    // Use a controller to handle timeouts for the backend request
    const controller = new AbortController();
    const backendTimeout = setTimeout(() => controller.abort(), 30000); // 30-second timeout
    
    try {
      console.log(`[${requestId}] Triggering backend processing at ${processFromBlobUrl}`);
      
      // Add retries for backend connection
      const MAX_RETRIES = 3;
      let attempt = 0;
      let lastError = null;
      
      while (attempt < MAX_RETRIES) {
        try {
          const backendResp = await fetch(processFromBlobUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.user.id}`,
              'X-Request-ID': requestId,
            },
            body: JSON.stringify({
              url: blobResult.url,
              filename,
              content_type: contentType,
              metadata: metadata,
            }),
            signal: controller.signal,
          });
          
          clearTimeout(backendTimeout);
          
          if (!backendResp.ok) {
            const errorText = await backendResp.text();
            console.error(`[${requestId}] Backend processing error (${backendResp.status}):`, errorText);
            
            // Still continue with the upload, but note the backend processing issue
            backendTask = { 
              error: `Backend processing failed with status ${backendResp.status}`,
              details: errorText.substring(0, 500) // Limit error text length
            };
          } else {
            backendTask = await backendResp.json();
            console.log(`[${requestId}] Backend processing task created:`, backendTask?.task_id);
          }
          
          // If we successfully made the request, exit the retry loop
          break;
        } catch (fetchError) {
          attempt++;
          lastError = fetchError;
          
          // Only log detailed errors on final attempt
          if (attempt >= MAX_RETRIES) {
            console.error(`[${requestId}] Failed to trigger backend processing after ${MAX_RETRIES} attempts:`, fetchError);
          } else {
            console.warn(`[${requestId}] Backend connection attempt ${attempt} failed, retrying...`);
            // Wait with exponential backoff before retrying (1s, 2s, 4s...)
            await new Promise(resolve => setTimeout(resolve, 1000 * (2 ** (attempt - 1))));
          }
        }
      }
      
      // If we exhausted all retries without success
      if (attempt >= MAX_RETRIES) {
        backendTask = { 
          error: 'Failed to connect to backend for processing', 
          details: lastError instanceof Error ? lastError.message : String(lastError),
          status: 'connection_error'
        };
        
        // Add file to processing queue for later retry if appropriate
        try {
          await saveDocument({
            id: crypto.randomUUID(),
            title: `pending_processing_${filename}`,
            kind: 'pending',
            content: JSON.stringify({
              blobUrl: blobResult.url,
              filename,
              contentType,
              uploadTime: new Date().toISOString(),
              status: 'pending_processing'
            }),
            userId,
          });
          console.log(`[${requestId}] File queued for later processing`);
          backendTask.queued = true;
        } catch (queueError) {
          console.error(`[${requestId}] Failed to queue file for later processing:`, queueError);
        }
      }
    } catch (err) {
      clearTimeout(backendTimeout);
      console.error(`[${requestId}] Critical error in backend processing flow:`, err);
      backendTask = { 
        error: 'Failed to trigger backend processing', 
        details: err instanceof Error ? err.message : String(err) 
      };
      // Still continue with the flow - don't fail the whole request
    }

    // 8. Save document in database for tracking
    const kind = inferFileKind(contentType, filename);
    const docId = crypto.randomUUID();
    
    try {
      await saveDocument({
        id: docId,
        title: filename,
        kind,
        content: blobResult.url,
        userId,
        metadata: JSON.stringify({
          originalFilename: filename,
          contentType,
          fileSize,
          uploadTime: new Date().toISOString(),
          backendTaskId: backendTask?.task_id || null,
          processingStatus: backendTask?.status || 'unknown'
        })
      });
      
      console.log(`[${requestId}] Document saved with ID: ${docId}`);
    } catch (dbError) {
      console.error(`[${requestId}] Failed to save document in database:`, dbError);
      // Continue execution - don't fail the upload if DB save fails
    }

    // 9. Return comprehensive response with performance metrics
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Upload completed in ${duration}ms`);
    
    return NextResponse.json({
      ...blobResult,
      backendTask,
      document: {
        id: docId,
        title: filename,
        kind,
        content: blobResult.url,
        userId,
      },
      processingStatus: backendTask?.status || 'pending',
      uploadDuration: duration,
      message: 'File uploaded successfully and processing initiated.'
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Critical error during upload (${duration}ms):`, error);
    
    // Return structured error response with appropriate status code
    return NextResponse.json({
      error: 'An unexpected error occurred during upload',
      errorId: requestId, // Include for support reference
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined,
    }, { 
      status: 500,
      headers: {
        // Add security headers
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      }
    });
  }
}

/**
 * Helper function to infer document kind from file type
 * 
 * @param contentType - The MIME type of the file
 * @param filename - The name of the file
 * @returns The inferred document kind
 */
function inferFileKind(contentType: string, filename: string): 'text' | 'code' | 'image' | 'sheet' | 'pdf' {
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
  if (filenameLower.match(/\.(json|ya?ml|xml|js|ts|py|java|c|cpp|cs|go|rs|php|rb|pl)$/)) return 'code';
  if (filenameLower.match(/\.(txt|md|rtf|html?|log|tex)$/)) return 'text';
  
  // Handle bioinformatics file formats
  if (filenameLower.match(/\.(fastq|bam|vcf|mtx|h5ad|h5|hdf5|dgz)$/)) return 'sheet';
  
  // Fallback for unknown types
  return 'text';
}
