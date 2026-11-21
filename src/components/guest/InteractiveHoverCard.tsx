import React, { useState } from 'react';
import { Card as MuiCard } from '@mui/material';
import { ResilientImage } from '@/src/components/guest/ResilientImage';
import { cn } from '@/src/lib/utils';

export interface ShowcaseHoverCardProps {
  image?: string;
  alt: string;
  fallbackTitle?: string;
  kicker?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  price?: React.ReactNode;
  actions?: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
  heightClass?: string;
}

/**
 * Shadcn + Material UI Showcase Hover Card:
 * Displays clean photography at rest with card text hidden;
 * reveals full title, description, pricing, and actions smoothly on hover or focus/tap.
 */
export function ShowcaseHoverCard({
  image,
  alt,
  fallbackTitle,
  kicker,
  title,
  description,
  meta,
  price,
  actions,
  extra,
  className,
  heightClass = 'h-72 sm:h-80',
}: ShowcaseHoverCardProps) {
  const [pinnedOpen, setPinnedOpen] = useState(false);

  return (
    <MuiCard
      elevation={0}
      tabIndex={0}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a, button')) return;
        setPinnedOpen((v) => !v);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPinnedOpen(false);
        }
      }}
      sx={{
        borderRadius: 'var(--radius)',
        backgroundColor: 'var(--card)',
        color: 'var(--card-foreground)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}
      className={cn(
        'group relative w-full cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1 hover:border-accent/60 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        heightClass,
        className,
      )}
    >
      {/* Full-bleed crisp resort photograph */}
      <ResilientImage
        src={image}
        alt={alt}
        fallbackTitle={fallbackTitle || (typeof title === 'string' ? title : undefined)}
        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />

      {/* Hidden-until-hover dark glass overlay containing all card details */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/80 to-black/30 p-5 sm:p-6 text-white backdrop-blur-[2px] transition-all duration-300 ease-out',
          'opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100',
          pinnedOpen && 'pointer-events-auto opacity-100',
        )}
      >
        <div
          className={cn(
            'space-y-2.5 transition-transform duration-300 ease-out translate-y-3 group-hover:translate-y-0 group-focus-within:translate-y-0',
            pinnedOpen && 'translate-y-0',
          )}
        >
          {(kicker || price) && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {kicker && (
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300">
                  {kicker}
                </p>
              )}
              {price && (
                <span className="font-mono text-sm font-semibold tabular-nums text-amber-300">
                  {price}
                </span>
              )}
            </div>
          )}

          <h3 className="font-display text-2xl sm:text-3xl font-semibold leading-tight text-white">
            {title}
          </h3>

          {meta && <p className="text-xs text-white/75">{meta}</p>}

          {description && (
            <p className="text-xs sm:text-sm leading-relaxed text-white/85 line-clamp-4">
              {description}
            </p>
          )}

          {extra}

          {actions && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-3">
              {actions}
            </div>
          )}
        </div>
      </div>
    </MuiCard>
  );
}

export interface InfoHoverCardProps {
  icon?: React.ReactNode;
  label?: React.ReactNode;
  title: React.ReactNode;
  detail: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
  heightClass?: string;
  revolveBorder?: boolean;
}

/**
 * Shadcn + Material UI Info Hover Card (for non-photo facility/review/guide cards):
 * Keeps detailed text hidden at rest with only clean icon/visual anchor + title,
 * and smoothly reveals full detail overlay on hover or focus/tap without layout shift.
 */
export function InfoHoverCard({
  icon,
  label,
  title,
  detail,
  meta,
  className,
  heightClass = 'min-h-[172px]',
  revolveBorder = false,
}: InfoHoverCardProps) {
  const [pinnedOpen, setPinnedOpen] = useState(false);

  return (
    <MuiCard
      elevation={0}
      tabIndex={0}
      onClick={() => setPinnedOpen((v) => !v)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPinnedOpen(false);
        }
      }}
      sx={{
        borderRadius: 'var(--radius)',
        backgroundColor: 'var(--card)',
        color: 'var(--card-foreground)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}
      className={cn(
        'group relative flex w-full cursor-pointer items-center justify-center p-6 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !revolveBorder && 'hover:border-accent/60',
        heightClass,
        className,
      )}
    >
      {/* Resting minimal visual surface (detailed copy stays hidden until hover) */}
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2.5 text-center transition-all duration-300 ease-out group-hover:opacity-0 group-hover:scale-95 group-focus-within:opacity-0 group-focus-within:scale-95',
          pinnedOpen && 'opacity-0 scale-95',
        )}
      >
        {icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-accent">
            {icon}
          </div>
        )}
        {label && (
          <div className="text-xs font-medium uppercase tracking-wider text-accent">
            {label}
          </div>
        )}
        <h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground">
          {title}
        </h3>
      </div>

      {/* Hover / Focus revealed detail surface */}
      <div
        className={cn(
          'absolute inset-0 flex flex-col justify-between bg-[#132038]/95 p-5 text-[#f8f5ee] backdrop-blur-sm transition-all duration-300 ease-out',
          'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0',
          pinnedOpen && 'opacity-100 translate-y-0',
        )}
      >
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
            {title}
          </p>
          <p className="text-xs sm:text-sm leading-relaxed text-white/90 line-clamp-4">
            {detail}
          </p>
        </div>
        {meta && (
          <p className="border-t border-white/15 pt-2 text-[11px] font-medium text-amber-200/90">
            {meta}
          </p>
        )}
      </div>

      {revolveBorder && (
        <span
          aria-hidden="true"
          className={cn(
            'revolve-border-mask pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100',
            pinnedOpen && 'opacity-100',
          )}
        >
          <span
            className="animate-revolve-lines absolute left-1/2 top-1/2 block aspect-square w-[220%]"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, #f59e0b 14deg, #fbbf24 38deg, transparent 64deg, transparent 180deg, #06b6d4 194deg, #38bdf8 218deg, transparent 244deg, transparent 360deg)',
            }}
          />
        </span>
      )}
    </MuiCard>
  );
}
