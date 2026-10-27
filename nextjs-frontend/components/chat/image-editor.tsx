import { LoaderIcon } from '../icons';
import cn from 'classnames';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { TextShimmer } from '../ui/text-shimmer';

interface ImageEditorProps {
  title: string;
  content: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: string;
  isInline: boolean;
  onDownload?: (title: string, content: string) => void;
}

/** A data URL with the type the bytes actually have: Muse Image returns WebP. */
export function imageDataUrl(base64: string) {
  const type = base64.startsWith('UklGR')
    ? 'image/webp'
    : base64.startsWith('/9j/')
      ? 'image/jpeg'
      : 'image/png';
  return `data:${type};base64,${base64}`;
}

export function ImageEditor({
  title,
  content,
  status,
  isInline,
}: ImageEditorProps) {
  const [imageDimensions, setImageDimensions] = useState({
    width: 800,
    height: 600,
  });
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    if (content && status !== 'streaming') {
      const url = imageDataUrl(content);
      setImageUrl(url);

      const imgElement = document.createElement('img');
      imgElement.onload = () => {
        setImageDimensions({
          width: imgElement.naturalWidth,
          height: imgElement.naturalHeight,
        });
      };
      imgElement.src = url;
    }
  }, [content, status]);

  return (
    <div
      className={cn('flex flex-col items-center justify-center w-full', {
        'min-h-[200px] max-h-[calc(100dvh-120px)]': !isInline,
        'min-h-[200px] md:min-h-[300px]': isInline,
      })}
    >
      {status === 'streaming' ? (
        <div className="flex flex-row gap-4 md:gap-6 items-center py-6 md:py-8">
          {!isInline && (
            <div className="animate-spin scale-100 md:scale-125">
              <LoaderIcon />
            </div>
          )}
          <TextShimmer
            className="text-base md:text-lg font-medium"
            duration={7}
          >
            Generating Image...
          </TextShimmer>
        </div>
      ) : (
        <div
          className={cn(
            'relative w-full h-full flex flex-col justify-center items-center',
            {
              'px-2 sm:px-4 md:px-6 py-3 md:py-4': !isInline,
              'p-0': isInline,
            },
          )}
        >
          <div
            className="flex justify-center size-full"
            data-image-title={title || ''}
          >
            <div
              className={cn('relative', {
                'max-h-[calc(100dvh-140px)] rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-shadow':
                  !isInline,
                'w-full h-full rounded-t-xl overflow-hidden': isInline,
              })}
            >
              {imageUrl && (
                <Image
                  src={imageUrl}
                  alt={title || 'Generated image'}
                  width={imageDimensions.width}
                  height={imageDimensions.height}
                  className={cn('object-contain', {
                    'rounded-xl': !isInline,
                    'rounded-t-xl': isInline,
                  })}
                  priority={!isInline}
                  quality={90}
                  style={{
                    borderTopLeftRadius: isInline ? '0.75rem' : undefined,
                    borderTopRightRadius: isInline ? '0.75rem' : undefined,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
