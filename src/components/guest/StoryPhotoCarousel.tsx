import React, { useEffect, useState } from 'react';
import { IconButton, LinearProgress, Tooltip } from '@mui/material';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/src/components/ui/carousel';
import { Card, CardContent } from '@/src/components/ui/card';
import { ResilientImage } from '@/src/components/guest/ResilientImage';

export interface StorySlide {
  src: string;
  alt: string;
  caption: string;
}

interface StoryPhotoCarouselProps {
  slides: StorySlide[];
}

const LUXE_EASE = [0.22, 1, 0.36, 1] as const;

export function StoryPhotoCarousel({ slides }: StoryPhotoCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
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
    if (!api || isPaused || isHovering || slides.length <= 1 || prefersReducedMotion) return;

    const timer = window.setInterval(() => {
      api.scrollNext();
    }, 5500);

    return () => window.clearInterval(timer);
  }, [api, isPaused, isHovering, slides.length, prefersReducedMotion]);

  const currentSlide = slides[activeIndex] ?? slides[0];
  const progressPercent = slides.length > 0 ? ((activeIndex + 1) / slides.length) * 100 : 100;

  return (
    <MotionConfig reducedMotion="user">
      <Card
        className="overflow-hidden border-border"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="relative h-72 w-full overflow-hidden sm:h-80">
          <Carousel
            setApi={setApi}
            opts={{ loop: true, align: 'start', duration: 40 }}
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
                            : { opacity: 0.78, scale: 1.06 }
                      }
                      transition={{
                        scale: { duration: isActive ? 4.4 : 0.75, ease: LUXE_EASE },
                        opacity: { duration: 0.7, ease: LUXE_EASE },
                      }}
                      className="h-full w-full will-change-transform"
                    >
                      <ResilientImage
                        src={slide.src}
                        alt={slide.alt}
                        loading={idx === 0 ? 'eager' : 'lazy'}
                        className="h-full w-full object-cover"
                      />
                    </motion.div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>

          {/* Subtle bottom scrim inside photo for corner controls */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent"
          />

          {slides.length > 1 && (
            <div className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-between gap-2">
              <span className="rounded-md bg-black/55 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-white backdrop-blur-sm">
                {String(activeIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
              </span>

              <div className="flex items-center gap-1">
                <Tooltip title="Previous photo">
                  <motion.div
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.07 }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  >
                    <IconButton
                      size="small"
                      aria-label="Previous resort photo"
                      onClick={() => api?.scrollPrev()}
                      sx={{
                        width: 36,
                        height: 36,
                        color: '#ffffff',
                        backgroundColor: 'rgba(0,0,0,0.52)',
                        border: '1px solid rgba(255,255,255,0.22)',
                        backdropFilter: 'blur(6px)',
                        '&:hover': { backgroundColor: 'rgba(0,0,0,0.75)' },
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </IconButton>
                  </motion.div>
                </Tooltip>

                <Tooltip title={isPaused ? 'Resume slideshow' : 'Pause slideshow'}>
                  <motion.div
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.07 }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  >
                    <IconButton
                      size="small"
                      aria-label={isPaused ? 'Resume slideshow' : 'Pause slideshow'}
                      onClick={() => setIsPaused((prev) => !prev)}
                      sx={{
                        width: 36,
                        height: 36,
                        color: '#ffffff',
                        backgroundColor: 'rgba(0,0,0,0.52)',
                        border: '1px solid rgba(255,255,255,0.22)',
                        backdropFilter: 'blur(6px)',
                        '&:hover': { backgroundColor: 'rgba(0,0,0,0.75)' },
                      }}
                    >
                      {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </IconButton>
                  </motion.div>
                </Tooltip>

                <Tooltip title="Next photo">
                  <motion.div
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.07 }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  >
                    <IconButton
                      size="small"
                      aria-label="Next resort photo"
                      onClick={() => api?.scrollNext()}
                      sx={{
                        width: 36,
                        height: 36,
                        color: '#ffffff',
                        backgroundColor: 'rgba(0,0,0,0.52)',
                        border: '1px solid rgba(255,255,255,0.22)',
                        backdropFilter: 'blur(6px)',
                        '&:hover': { backgroundColor: 'rgba(0,0,0,0.75)' },
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </IconButton>
                  </motion.div>
                </Tooltip>
              </div>
            </div>
          )}
        </div>

        <LinearProgress
          variant="determinate"
          value={progressPercent}
          aria-label="Section photo progress"
          sx={{
            height: 3,
            backgroundColor: 'rgba(0, 0, 0, 0.08)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: '#b45309',
              transition: 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)',
            },
          }}
        />

        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[20px] flex-1 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={currentSlide?.src ?? activeIndex}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -5 }}
                transition={{ duration: 0.3, ease: LUXE_EASE }}
                className="text-xs leading-relaxed text-muted-foreground"
              >
                {currentSlide?.caption}
              </motion.p>
            </AnimatePresence>
          </div>

          {slides.length > 1 && (
            <div className="flex shrink-0 items-center gap-1.5" role="tablist" aria-label="Select resort photograph">
              {slides.map((slide, idx) => {
                const active = idx === activeIndex;
                return (
                  <button
                    key={slide.src}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`View photo ${idx + 1}`}
                    onClick={() => api?.scrollTo(idx)}
                    className="flex min-h-[28px] items-center px-0.5 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <motion.span
                      animate={{
                        width: active ? 24 : 12,
                        opacity: active ? 1 : 0.45,
                      }}
                      whileHover={{ opacity: active ? 1 : 0.78 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                      className={active ? 'block h-1.5 rounded-sm bg-accent' : 'block h-1.5 rounded-sm bg-muted-foreground'}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </MotionConfig>
  );
}
