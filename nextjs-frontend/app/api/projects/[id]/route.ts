import { auth } from '@/app/(auth)/auth';
import {
    deleteProject,
    getProjectById,
    updateProject,
} from '@/lib/db/queries';
import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    return Response.json(project);
  } catch (error) {
    console.error('Failed to get project:', error);
    return Response.json({ error: 'Failed to get project' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const existingProject = await getProjectById({ id });
    
    if (!existingProject) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    if (existingProject.userId !== session.user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, description, emoji } = await request.json();

    const project = await updateProject({
      id,
      name: name?.trim(),
      description: description?.trim(),
      emoji,
    });

    return Response.json(project);
  } catch (error) {
    console.error('Failed to update project:', error);
    return Response.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const existingProject = await getProjectById({ id });
    
    if (!existingProject) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    if (existingProject.userId !== session.user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteProject({ id });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return Response.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
