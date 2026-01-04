'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, FolderIcon, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuItem } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Project } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { ProjectDialog } from './project-dialog';

interface SidebarProjectsProps {
  isCollapsed: boolean;
}

export function SidebarProjects({ isCollapsed }: SidebarProjectsProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  
  const { data: projects, isLoading } = useSWR<Project[]>('/api/projects', fetcher);
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const handleCreateProject = async (data: { name: string; description?: string; emoji?: string }) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (response.ok) {
        mutate('/api/projects');
        setDialogOpen(false);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleUpdateProject = async (data: { name: string; description?: string; emoji?: string }) => {
    if (!editingProject) return;
    
    try {
      const response = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (response.ok) {
        mutate('/api/projects');
        setEditingProject(null);
      }
    } catch (error) {
      console.error('Failed to update project:', error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        mutate('/api/projects');
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/chat?project=${projectId}`);
  };

  if (isCollapsed) {
    return (
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center justify-center w-full h-10 rounded-lg hover:bg-muted/60 transition-colors"
            >
              <FolderIcon className="size-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Projects</TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    );
  }

  return (
    <>
      <div className="mt-4">
        <div className="flex items-center justify-between w-full px-3 py-1.5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground/60 hover:text-muted-foreground/80 transition-colors"
          >
            {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            <span>Projects</span>
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            className="p-1 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground/60 hover:text-muted-foreground"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-1 space-y-0.5 px-1">
                {isLoading ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground/50">Loading...</div>
                ) : projects && projects.length > 0 ? (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted/40 cursor-pointer transition-all duration-150"
                      onClick={() => handleProjectClick(project.id)}
                    >
                      <div className="flex items-center justify-center size-6 rounded-md bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                        <FolderIcon className="size-3.5" />
                      </div>
                      <span className="flex-1 text-sm truncate text-foreground/80 group-hover:text-foreground transition-colors">
                        {project.name}
                      </span>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-muted/60 transition-all"
                          >
                            <MoreHorizontal className="size-3.5 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProject(project);
                            }}
                          >
                            <Pencil className="size-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(project.id);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                ) : (
                  <button
                    onClick={() => setDialogOpen(true)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-muted-foreground/50 hover:text-muted-foreground/70 hover:bg-muted/20 transition-all"
                  >
                    <div className="flex items-center justify-center size-6 rounded-md border border-dashed border-muted-foreground/30">
                      <Plus className="size-3" />
                    </div>
                    <span className="text-xs">Create project...</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreateProject}
        mode="create"
      />

      <ProjectDialog
        open={!!editingProject}
        onOpenChange={(open) => !open && setEditingProject(null)}
        onSubmit={handleUpdateProject}
        mode="edit"
        initialData={editingProject ? {
          name: editingProject.name,
          description: editingProject.description || '',
        } : undefined}
      />
    </>
  );
}
