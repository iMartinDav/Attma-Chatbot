import type { Attachment } from '@/lib/types';
import { FileTextIcon, XIcon } from 'lucide-react';
import { LoaderIcon } from '../icons';

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onDelete,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onDelete?: (attachment: Attachment) => void;
}) => {
  const { name, url, contentType } = attachment;

  return (
    <div className="flex flex-col gap-2 relative">
      <div className="w-20 h-16 aspect-video bg-muted rounded-md relative flex flex-col items-center justify-center">
        {contentType ? (
          contentType.startsWith('image') ? (
            // NOTE: it is recommended to use next/image for images
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url || (name ? URL.createObjectURL(new Blob([name])) : '')}
              alt={name ?? 'An image attachment'}
              className="rounded-md size-full object-cover"
            />
          ) : contentType === 'application/pdf' ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <FileTextIcon size={24} />
              <span className="text-xs mt-1">PDF</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <FileTextIcon size={24} />
              <span className="text-xs mt-1">File</span>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <FileTextIcon size={24} />
            <span className="text-xs mt-1">Unknown</span>
          </div>
        )}

        {isUploading && (
          <div className="animate-spin absolute text-zinc-500">
            <LoaderIcon />
          </div>
        )}
      </div>
      <div className="text-xs text-zinc-500 max-w-16 truncate">{name}</div>
      {onDelete && (
        <button
          className="absolute top-1 right-1 p-1 bg-white/30 backdrop-blur-md text-white hover:bg白/50 transition-colors duration-200 rounded-full"
          onClick={() => onDelete(attachment)}
          aria-label="Delete attachment"
        >
          <XIcon size={12} />
        </button>
      )}
    </div>
  );
};
