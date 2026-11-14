import React, { useState } from 'react';
import Image, { ImageProps } from 'next/image';
import { Loader2, ImageIcon } from 'lucide-react';

interface ImageWithFallbackProps extends ImageProps {
  containerClassName?: string;
  fallbackIcon?: React.ReactNode;
}

export default function ImageWithFallback({ 
  containerClassName, 
  fallbackIcon, 
  className, 
  onLoad,
  onError,
  alt,
  ...props 
}: ImageWithFallbackProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  // src가 비어 있으면 next/image가 `/_next/image?url=`를 요청하므로 곧바로 대체 UI를 보여줍니다.
  const isMissing = !props.src;

  return (
    <div className={`relative overflow-hidden flex items-center justify-center ${containerClassName || ''}`}>
      {isLoading && !hasError && !isMissing && (
        <div className="absolute inset-0 flex items-center justify-center bg-raised/80 z-10">
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
        </div>
      )}
      {hasError || isMissing ? (
        <div className="flex flex-col items-center justify-center text-ink-3 w-full h-full bg-raised">
          {fallbackIcon || <ImageIcon size={18} strokeWidth={1.5} />}
        </div>
      ) : (
        <Image
          {...props}
          alt={alt}
          className={`transition-opacity duration-200 ${isLoading ? 'opacity-0' : 'opacity-100'} ${className || ''}`}
          onLoad={(e) => {
            setIsLoading(false);
            if (onLoad) (onLoad as (event: React.SyntheticEvent<HTMLImageElement, Event>) => void)(e);
          }}
          onError={(e) => {
            setIsLoading(false);
            setHasError(true);
            if (onError) (onError as (event: React.SyntheticEvent<HTMLImageElement, Event>) => void)(e);
          }}
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
}