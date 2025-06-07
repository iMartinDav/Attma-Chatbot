import React, { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';

interface DragAndDropProps {
  onDrop: (files: FileList) => void;
  children: React.ReactNode;
  isFullSize: boolean;
}

export const DragAndDrop: React.FC<DragAndDropProps> = ({
  onDrop,
  children,
  isFullSize,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const acceptedFiles = Array.from(event.dataTransfer.files).filter(
          (file) =>
            file.type === 'application/pdf' || file.type.startsWith('image/'),
        );
        if (acceptedFiles.length > 0) {
          onDrop(event.dataTransfer.files);
        }
        event.dataTransfer.clearData();
      }
    },
    [onDrop],
  );

  return (
    <div
      className={`relative size-full rounded-2xl transition-colors duration-200 ${
        isDragging ? 'bg-white/30 dark:bg-gray-900/30 backdrop-blur-xs' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      tabIndex={0}
      aria-describedby="drop-area-description"
    >
      {/* Accessibility: Hidden description for screen readers */}
      <span className="sr-only" id="drop-area-description">
        Drag and drop files here to upload
      </span>

      {/* Child content passed to the component */}
      {children}

      {/* Overlay shown during dragging */}
      {isDragging && (
        <div className="absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 rounded-2xl bg-white/90 dark:bg-gray-900/90 size-full">
          <Upload className="size-8 md:size-12 text-gray-800 dark:text-gray-200" />
          <p className="mt-2 text-base md:text-lg text-gray-800 dark:text-gray-200 font-medium">
            Drop files here
          </p>
        </div>
      )}
    </div>
  );
};
