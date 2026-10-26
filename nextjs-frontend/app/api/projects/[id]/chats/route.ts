import { auth } from '@/app/(auth)/auth';
import { getChatsByProjectId, getProjectById } from '@/lib/db/queries';
import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const project = await getProjectById({ id });

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.userId !== session.user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const chats = await getChatsByProjectId({ projectId: id });
    return Response.json(chats);
  } catch (error) {
    console.error('Failed to get project chats:', error);
    return Response.json(
      { error: 'Failed to get project chats' },
      { status: 500 },
    );
  }
}
