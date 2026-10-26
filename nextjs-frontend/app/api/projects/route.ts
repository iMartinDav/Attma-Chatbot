import { auth } from '@/app/(auth)/auth';
import { createProject, getProjectsByUserId } from '@/lib/db/queries';
import { NextRequest } from 'next/server';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const projects = await getProjectsByUserId({ userId: session.user.id });
    return Response.json(projects);
  } catch (error) {
    console.error('Failed to get projects:', error);
    return Response.json({ error: 'Failed to get projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, description, emoji } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return Response.json(
        { error: 'Project name is required' },
        { status: 400 },
      );
    }

    const project = await createProject({
      userId: session.user.id,
      name: name.trim(),
      description: description?.trim(),
      emoji: emoji || '📁',
    });

    return Response.json(project, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return Response.json(
      { error: 'Failed to create project' },
      { status: 500 },
    );
  }
}
