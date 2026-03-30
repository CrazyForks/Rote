import { cn } from '@/lib/utils';

interface VideoAttachmentPreviewProps {
  posterSrc?: null | string;
  playbackSrc?: null | string;
  className?: string;
  mediaClassName?: string;
  disabled?: boolean;
  stopInteractionPropagation?: boolean;
}

export function VideoAttachmentPreview({
  posterSrc,
  playbackSrc,
  className,
  mediaClassName,
  disabled = false,
  stopInteractionPropagation = false,
}: VideoAttachmentPreviewProps) {
  const stopPropagation = (event: { stopPropagation: () => void }) => {
    if (stopInteractionPropagation) {
      event.stopPropagation();
    }
  };

  if (!playbackSrc || disabled) {
    if (posterSrc) {
      return (
        <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
          <img
            className={cn('h-full w-full bg-black object-contain', mediaClassName)}
            src={posterSrc}
            alt=""
          />
        </div>
      );
    }

    return <div className={cn('h-full w-full bg-black', className)} />;
  }

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
      <video
        className={cn('h-full w-full bg-black object-contain', mediaClassName)}
        controls
        playsInline
        onPointerDown={stopPropagation}
        onClick={stopPropagation}
        poster={posterSrc || undefined}
        preload="metadata"
        src={playbackSrc}
      />
    </div>
  );
}
