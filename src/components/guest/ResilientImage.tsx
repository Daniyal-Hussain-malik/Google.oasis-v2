import React, { useState } from 'react';
import { Mountain } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface ResilientImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackTitle?: string;
}

export function ResilientImage({ src, alt, className, fallbackTitle, ...props }: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt || fallbackTitle || 'Oasis Resort Skardu'}
        className={cn(
          'flex flex-col items-center justify-center bg-gradient-to-br from-secondary via-muted to-secondary/70 p-6 text-center text-muted-foreground',
          className,
        )}
      >
        <Mountain className="mb-2 h-7 w-7 opacity-50" />
        {fallbackTitle && <span className="font-display text-lg font-medium text-foreground/75">{fallbackTitle}</span>}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ''}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      {...props}
    />
  );
}
