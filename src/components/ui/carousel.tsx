import * as React from 'react';
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';

type CarouselApi = UseEmblaCarouselType[1];
type CarouselOptions = Parameters<typeof useEmblaCarousel>[0];
type CarouselPlugins = Parameters<typeof useEmblaCarousel>[1];

interface CarouselContextValue {
  carouselRef: UseEmblaCarouselType[0];
  api: CarouselApi;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  scrollPrev: () => void;
  scrollNext: () => void;
  orientation: 'horizontal' | 'vertical';
}

const CarouselContext = React.createContext<CarouselContextValue | null>(null);

export function useCarousel() {
  const ctx = React.useContext(CarouselContext);
  if (!ctx) {
    throw new Error('useCarousel must be used within a <Carousel />');
  }
  return ctx;
}

export interface CarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  opts?: CarouselOptions;
  plugins?: CarouselPlugins;
  orientation?: 'horizontal' | 'vertical';
  setApi?: (api: CarouselApi) => void;
}

export function Carousel({
  opts,
  plugins,
  orientation = 'horizontal',
  setApi,
  className,
  children,
  onKeyDown,
  ...props
}: CarouselProps) {
  const [carouselRef, api] = useEmblaCarousel(
    {
      ...opts,
      axis: orientation === 'horizontal' ? 'x' : 'y',
    },
    plugins,
  );
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  const syncSelection = React.useCallback((emblaApi: CarouselApi) => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, []);

  const scrollPrev = React.useCallback(() => {
    api?.scrollPrev();
  }, [api]);

  const scrollNext = React.useCallback(() => {
    api?.scrollNext();
  }, [api]);

  React.useEffect(() => {
    if (!api) return;
    setApi?.(api);
    syncSelection(api);
    api.on('reInit', syncSelection);
    api.on('select', syncSelection);
    return () => {
      api.off('reInit', syncSelection);
      api.off('select', syncSelection);
    };
  }, [api, setApi, syncSelection]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollNext();
    }
    onKeyDown?.(event);
  };

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api,
        canScrollPrev,
        canScrollNext,
        scrollPrev,
        scrollNext,
        orientation,
      }}
    >
      <div
        role="region"
        aria-roledescription="carousel"
        onKeyDown={handleKeyDown}
        className={cn('relative', className)}
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

export const CarouselContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { carouselRef, orientation } = useCarousel();
  return (
    <div ref={carouselRef} className="h-full w-full overflow-hidden">
      <div
        ref={ref}
        className={cn(
          'flex h-full',
          orientation === 'horizontal' ? 'flex-row' : 'flex-col',
          className,
        )}
        {...props}
      />
    </div>
  );
});
CarouselContent.displayName = 'CarouselContent';

export const CarouselItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="group"
    aria-roledescription="slide"
    className={cn('min-w-0 shrink-0 grow-0 basis-full', className)}
    {...props}
  />
));
CarouselItem.displayName = 'CarouselItem';

export function CarouselPrevious({
  className,
  variant = 'outline',
  size = 'icon',
  ...props
}: React.ComponentProps<typeof Button>) {
  const { scrollPrev, canScrollPrev } = useCarousel();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={scrollPrev}
      disabled={!canScrollPrev}
      aria-label="Previous slide"
      className={cn('h-10 w-10 rounded-lg', className)}
      {...props}
    >
      <ChevronLeft className="h-4 w-4" />
    </Button>
  );
}

export function CarouselNext({
  className,
  variant = 'outline',
  size = 'icon',
  ...props
}: React.ComponentProps<typeof Button>) {
  const { scrollNext, canScrollNext } = useCarousel();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={scrollNext}
      disabled={!canScrollNext}
      aria-label="Next slide"
      className={cn('h-10 w-10 rounded-lg', className)}
      {...props}
    >
      <ChevronRight className="h-4 w-4" />
    </Button>
  );
}

export type { CarouselApi };
