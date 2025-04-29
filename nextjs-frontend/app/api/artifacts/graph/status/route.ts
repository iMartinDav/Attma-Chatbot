import { auth } from '@/app/(auth)/auth'; // Updated import path
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { graphDocumentHandler } from '@/artifacts/graph/server'; // Using the exported handler

/**
 * API endpoint to poll for the status of background graph generation tasks
 * @route GET /api/artifacts/graph/status
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json(
      { error: 'Missing taskId parameter' },
      { status: 400 },
    );
  }

  // Authenticate user
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get the FastAPI backend URL from environment or use default
    const apiUrl = process.env.FASTAPI_URL ?? 'http://localhost:8000';

    // Call the backend API to check task status
    const response = await fetch(
      `${apiUrl}/api/bioflow/visualization/task/${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${session.user.id || ''}`,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${errorData.detail || response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error getting graph status:', error);
    const errorMessage =
      error instanceof Error
        ? `Failed to get graph status: ${error.message}`
        : 'Failed to get graph status: Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
