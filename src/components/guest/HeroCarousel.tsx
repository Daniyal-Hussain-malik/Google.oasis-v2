import React, { useEffect, useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/src/components/ui/carousel';
import { ResilientImage } from '@/src/components/guest/ResilientImage';
import { cn } from '@/src/lib/utils';

export interface HeroSlide {
  src: string;
  alt: string;
  label: string;
  caption: string;
  objectPosition?: string;
}

interface HeroCarouselProps {
  slides: HeroSlide[];
  children: React.ReactNode;
}

const AUTOPLAY_INTERVAL_MS = 6500;
const LUXE_EASE = [0.22, 1, 0.36, 1] as const;

export function HeroCarousel({ slides, children }: HeroCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      setActiveIndex(api.selectedScrollSnap());
    };
    onSelect();
    api.on('select', onSelect);
    api.on('reInit', onSelect);
    return () => {
      api.off('select', onSelect);
      api.off('reInit', onSelect);
    };
  }, [api]);

  useEffect(() => {
    if (!api || isHovering || slides.length <= 1 || prefersReducedMotion) return;

    const timer = window.setInterval(() => {
      api.scrollNext();
    }, AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [api, isHovering, slides.length, prefersReducedMotion]);

  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-label="Resort showcase"
        className="relative min-h-[74vh] overflow-hidden bg-primary"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Background Shadcn Embla Carousel + Motion Depth */}
        <div className="absolute inset-0">
          <Carousel
            setApi={setApi}
            opts={{ loop: true, align: 'start', duration: 44 }}
            className="h-full w-full"
          >
            <CarouselContent className="h-full">
              {slides.map((slide, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <CarouselItem key={slide.src} className="relative h-full w-full overflow-hidden">
                    <motion.div
                      initial={false}
                      animate={
                        prefersReducedMotion
                          ? { opacity: 1, scale: 1 }
                          : isActive
                            ? { opacity: 1, scale: 1 }
                            : { opacity: 0.72, scale: 1.07 }
                      }
                      transition={{
                        scale: { duration: isActive ? 5.2 : 0.85, ease: LUXE_EASE },
                        opacity: { duration: 0.8, ease: LUXE_EASE },
                      }}
                      className="h-full w-full will-change-transform"
                    >
                      <ResilientImage
                        src={slide.src}
                        alt={slide.alt}
                        loading={idx === 0 ? 'eager' : 'lazy'}
                        className={cn(
                          'h-full w-full object-cover',
                          slide.objectPosition || 'object-center',
                        )}
                      />
                    </motion.div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>
        </div>

        {/* Measured contrast scrim for WCAG >=4.5:1 white text legibility across all slides */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/40"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/50 via-black/15 to-transparent"
        />

        {/* Foreground hero copy */}
        <div className="relative z-10 mx-auto flex min-h-[74vh] max-w-7xl flex-col justify-between px-12 pb-28 pt-8 sm:px-14 sm:pt-10 xl:px-8">
          {children}
        </div>

        {/* Center-edge small dotted arrows & slide dots */}
        {slides.length > 1 && (
          <>
            <div className="absolute left-2.5 top-1/2 z-20 -translate-y-1/2 sm:left-5">
              <Tooltip title="Previous photo">
                <motion.div
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.08 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                >
                  <IconButton
                    size="small"
                    aria-label="Previous hero photo"
                    onClick={() => api?.scrollPrev()}
                    sx={{
                      width: 36,
                      height: 36,
                      color: '#ffffff',
                      border: '1.5px dotted rgba(255,255,255,0.65)',
                      backgroundColor: 'rgba(0,0,0,0.35)',
                      backdropFilter: 'blur(6px)',
                      '&:hover': {
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        borderColor: '#ffffff',
                      },
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </IconButton>
                </motion.div>
              </Tooltip>
            </div>

            <div className="absolute right-2.5 top-1/2 z-20 -translate-y-1/2 sm:right-5">
              <Tooltip title="Next photo">
                <motion.div
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.08 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                >
                  <IconButton
                    size="small"
                    aria-label="Next hero photo"
                    onClick={() => api?.scrollNext()}
                    sx={{
                      width: 36,
                      height: 36,
                      color: '#ffffff',
                      border: '1.5px dotted rgba(255,255,255,0.65)',
                      backgroundColor: 'rgba(0,0,0,0.35)',
                      backdropFilter: 'blur(6px)',
                      '&:hover': {
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        borderColor: '#ffffff',
                      },
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </IconButton>
                </motion.div>
              </Tooltip>
            </div>

            <div
              role="tablist"
              aria-label="Select hero photograph"
              className="absolute bottom-32 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 sm:bottom-20"
            >
              {slides.map((slide, idx) => {
                const active = idx === activeIndex;
                return (
                  <button
                    key={slide.src}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`View slide ${idx + 1}: ${slide.label}`}
                    onClick={() => api?.scrollTo(idx)}
                    className="flex h-6 w-4 items-center justify-center cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    <motion.span
                      animate={{
                        scale: active ? 1.25 : 1,
                        backgroundColor: active ? '#fbbf24' : 'rgba(255, 255, 255, 0.48)',
                      }}
                      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                      className="block h-1.5 w-1.5 rounded-full"
                    />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>
    </MotionConfig>
  );
}
