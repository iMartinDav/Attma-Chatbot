import { Artifact } from '@/components/chat/create-artifact';
import { CopyIcon, RedoIcon, UndoIcon, DownloadIcon } from '@/components/icons';
import { ImageEditor } from '@/components/chat/image-editor';
import { toast } from 'sonner';

const downloadImage = (title: string, content: string) => {
  try {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${content}`;
    link.download = title ? `${title}.png` : 'generated-image.png';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.error('Error downloading image:', error);
    return false;
  }
};

export const imageArtifact = new Artifact({
  kind: 'image',
  description: 'Useful for image generation',
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === 'image-delta') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.content as string,
        isVisible: true,
        status: 'streaming',
      }));
    }
  },
  content: (props) => <ImageEditor {...props} onDownload={downloadImage} />,
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }
        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }
        return false;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy image to clipboard',
      onClick: ({ content }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${content}`;

        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob }),
              ]);
            }
          }, 'image/png');
        };

        toast.success('Copied image to clipboard!');
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: 'Download image',
      onClick: (context) => {
        const { content } = context;
        const titleContainer = document.querySelector('[data-image-title]');
        const title = titleContainer
          ? titleContainer.getAttribute('data-image-title')
          : '';

        const success = downloadImage(title || '', content);
        if (success) {
          toast.success('Image downloaded!');
        } else {
          toast.error('Failed to download image');
        }
      },
    },
  ],
  toolbar: [],
});
