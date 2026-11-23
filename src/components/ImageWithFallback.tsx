import React, { useState } from 'react';
import Image, { ImageProps } from 'next/image';
import { Loader2, ImageIcon } from 'lucide-react';

const OWN_UPLOAD_HOSTS = new Set(
  ['moyeolog.ruraeru.xyz', (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_API_URL || '').hostname;
    } catch {
      return '';
    }
  })()].filter(Boolean)
);

/**
 * next.config 의 images.remotePatterns 에 있는 출처만 /_next/image 로 최적화할 수 있습니다.
 * 그 밖의 절대 주소는 최적화 없이 브라우저가 직접 불러오게 해 깨지지 않게 합니다.
 */
function canOptimize(src: ImageProps['src']): boolean {
  if (typeof src !== 'string' || !/^https?:\/\//i.test(src)) return true;
  try {
    const url = new URL(src);
    if (url.hostname.endsWith('.kakaocdn.net')) return true;
    return OWN_UPLOAD_HOSTS.has(url.hostname) && url.pathname.startsWith('/uploads/');
  } catch {
    return false;
  }
}

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
  unoptimized,
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
          unoptimized={unoptimized || !canOptimize(props.src)}
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