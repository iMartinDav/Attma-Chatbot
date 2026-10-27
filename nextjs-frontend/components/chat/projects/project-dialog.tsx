'use client';

import { FolderIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; description?: string }) => Promise<void>;
  mode: 'create' | 'edit';
  initialData?: {
    name: string;
    description?: string;
  };
}

export function ProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  mode,
  initialData,
}: ProjectDialogProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(
    initialData?.description || '',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      if (mode === 'create') {
        setName('');
        setDescription('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && mode === 'create') {
      setName('');
      setDescription('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        <div className="p-6 pb-4">
          <DialogHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
                <FolderIcon className="size-5 text-primary-ink" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  {mode === 'create' ? 'New Project' : 'Edit Project'}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {mode === 'create'
                    ? 'Organize your chats into a project'
                    : 'Update project details'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Project name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Protein Analysis"
                autoFocus
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="description"
                className="text-sm font-medium text-muted-foreground"
              >
                Description{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this project about?"
                rows={2}
                className="resize-none"
              />
            </div>
          </form>
        </div>

        <DialogFooter className="px-6 py-4 bg-muted/30 border-t">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            className="h-9"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || isSubmitting}
            className="h-9 px-4"
          >
            {isSubmitting
              ? mode === 'create'
                ? 'Creating...'
                : 'Saving...'
              : mode === 'create'
                ? 'Create'
                : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
