import React from 'react';
import { cn } from '@/src/lib/utils';

export const BRAND_LOGO_SRC = '/assets/aistudio/oasis-brand-logo.png';

export interface BrandLogoProps {
  variant?: 'auto' | 'inverse' | 'dark-surface';
  className?: string;
  alt?: string;
}

const VARIANT_CLASSES: Record<NonNullable<BrandLogoProps['variant']>, string> = {
  auto: 'dark:brightness-0 dark:invert',
  inverse: 'brightness-0 invert dark:brightness-100 dark:invert-0',
  'dark-surface': 'brightness-0 invert',
};

export function BrandLogo({
  variant = 'auto',
  className,
  alt = 'Oasis Resort Skardu',
}: BrandLogoProps) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={alt}
      decoding="async"
      draggable={false}
      className={cn(
        'block select-none object-contain',
        VARIANT_CLASSES[variant],
        className,
      )}
    />
  );
}
