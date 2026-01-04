'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, FolderIcon, MessageSquare, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuItem } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Chat, Project } from '@/lib/db/schema';
import { fetcher, getChatUrl } from '@/lib/utils';
import { ProjectDialog } from './project-dialog';

interface SidebarProjectsProps {
  isCollapsed: boolean;
}

export function SidebarProjects({ isCollapsed }: SidebarProjectsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();
  
  const currentProjectId = searchParams.get('project');
  const currentChatId = pathname.split('/chat/')[1];
  
  const { data: projects, isLoading } = useSWR<Project[]>('/api/projects', fetcher);
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Auto-expand project if we're viewing it
  useEffect(() => {
    if (currentProjectId) {
      setExpandedProjects(prev => new Set([...prev, currentProjectId]));
    }
  }, [currentProjectId]);

  const handleCreateProject = async (data: { name: string; description?: string }) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (response.ok) {
        const newProject = await response.json();
        mutate('/api/projects');
        setDialogOpen(false);
        // Auto-expand the new project
        setExpandedProjects(prev => new Set([...prev, newProject.id]));
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleUpdateProject = async (data: { name: string; description?: string }) => {
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
        setExpandedProjects(prev => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleNewChatInProject = (projectId: string) => {
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
                    <ProjectItem 
                      key={project.id}
                      project={project}
                      isExpanded={expandedProjects.has(project.id)}
                      isActive={currentProjectId === project.id}
                      currentChatId={currentChatId}
                      onToggle={() => toggleProjectExpanded(project.id)}
                      onEdit={() => setEditingProject(project)}
                      onDelete={() => handleDeleteProject(project.id)}
                      onNewChat={() => handleNewChatInProject(project.id)}
                    />
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

interface ProjectItemProps {
  project: Project;
  isExpanded: boolean;
  isActive: boolean;
  currentChatId?: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNewChat: () => void;
}

function ProjectItem({ 
  project, 
  isExpanded, 
  isActive,
  currentChatId,
  onToggle, 
  onEdit, 
  onDelete,
  onNewChat 
}: ProjectItemProps) {
  const router = useRouter();
  
  const { data: chats } = useSWR<Chat[]>(
    isExpanded ? `/api/projects/${project.id}/chats` : null,
    fetcher
  );

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all duration-150 ${
          isActive ? 'bg-muted/60' : 'hover:bg-muted/40'
        }`}
      >
        <button
          onClick={onToggle}
          className="p-0.5 rounded hover:bg-muted/60 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="size-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3 text-muted-foreground" />
          )}
        </button>
        
        <div 
          className="flex items-center gap-2 flex-1 min-w-0"
          onClick={onToggle}
        >
          <div className="flex items-center justify-center size-5 rounded bg-gradient-to-br from-primary/20 to-primary/5 text-primary shrink-0">
            <FolderIcon className="size-3" />
          </div>
          <span className="text-sm truncate text-foreground/80 group-hover:text-foreground transition-colors">
            {project.name}
          </span>
        </div>
        
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNewChat();
            }}
            className="p-1 rounded hover:bg-muted/60 transition-colors"
            title="New chat in project"
          >
            <Plus className="size-3 text-muted-foreground" />
          </button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded hover:bg-muted/60 transition-colors"
              >
                <MoreHorizontal className="size-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="size-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="ml-4 pl-3 border-l border-muted/40 mt-0.5 space-y-0.5">
              {chats && chats.length > 0 ? (
                chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => router.push(getChatUrl(chat.id, project.id))}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all ${
                      currentChatId === chat.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }`}
                  >
                    <MessageSquare className="size-3 shrink-0" />
                    <span className="text-xs truncate">{chat.title}</span>
                  </button>
                ))
              ) : (
                <div className="px-2 py-1.5 text-xs text-muted-foreground/50">
                  No chats yet
                </div>
              )}
              
              <button
                onClick={onNewChat}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30 transition-all"
              >
                <Plus className="size-3" />
                <span className="text-xs">New chat</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
