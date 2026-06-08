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

  return (
    <div className={`relative overflow-hidden flex items-center justify-center ${containerClassName || ''}`}>
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-10">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      )}
      {hasError ? (
        <div className="flex flex-col items-center justify-center text-gray-300 w-full h-full bg-gray-50">
          {fallbackIcon || <ImageIcon className="w-8 h-8" />}
        </div>
      ) : (
        <Image
          {...props}
          alt={alt}
          className={`transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'} ${className || ''}`}
          onLoad={(e) => {
            setIsLoading(false);
            if (onLoad) (onLoad as (event: React.SyntheticEvent<HTMLImageElement, Event>) => void)(e);
          }}
          onError={(e) => {
            setIsLoading(false);
            setHasError(true);
            if (onError) (onError as (event: React.SyntheticEvent<HTMLImageElement, Event>) => void)(e);
          }}
        />
      )}
    </div>
  );
}