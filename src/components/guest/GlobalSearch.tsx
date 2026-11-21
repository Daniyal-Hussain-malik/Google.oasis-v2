import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BedDouble, Compass, Search, UtensilsCrossed, X } from 'lucide-react';
import { api, media, pkr } from '@/src/lib/api';
import { experiences, photos, presentStay, restaurants } from '@/src/data/resortContent';
import { cn } from '@/src/lib/utils';

export type SearchCategory = 'all' | 'rooms' | 'activities' | 'dining';

export interface SearchEntry {
  id: string;
  category: Exclude<SearchCategory, 'all'>;
  title: string;
  subtitle: string;
  priceLabel?: string;
  image?: string;
  keywords: string;
  to: string;
}

const FALLBACK_ACTIVITIES: SearchEntry[] = [
  {
    id: 'act-jeep',
    category: 'activities',
    title: 'Jeep Safari',
    subtitle: 'Katpana desert dune loop departing from your hut.',
    image: photos.jeep,
    keywords: 'jeep safari dunes desert 4x4 tour adventure',
    to: '/activities',
  },
  {
    id: 'act-sandboard',
    category: 'activities',
    title: 'Sandboarding',
    subtitle: 'Morning desert boards available at reception.',
    image: photos.cloud,
    keywords: 'sandboard sandboarding dunes snow walk morning',
    to: '/activities',
  },
  {
    id: 'act-cinema',
    category: 'activities',
    title: 'Open-Air Cinema',
    subtitle: 'Evening film screening under the Karakoram sky.',
    image: photos.night,
    keywords: 'cinema movie film night outdoor open-air stars',
    to: '/activities',
  },
  {
    id: 'act-bonfire',
    category: 'activities',
    title: 'Bonfire on the Sand',
    subtitle: 'Warm evening fire laid by the dunes after 6 PM.',
    image: photos.fire,
    keywords: 'bonfire fire evening sand stars dinner',
    to: '/experiences/bonfire',
  },
  {
    id: 'act-shangrila',
    category: 'activities',
    title: 'Shangrila Excursion',
    subtitle: 'Lower Kachura day trip arranged via resort jeep.',
    image: photos.shangrila,
    keywords: 'shangrila lake lower kachura day trip sightseeing',
    to: '/experiences/shangrila-day',
  },
];

const QUICK_TERMS = ['Deluxe Hut', 'Trout', 'Jeep', 'Bonfire', 'Breakfast', 'Executive'];

let cachedEntries: SearchEntry[] | null = null;
let inflightFetch: Promise<SearchEntry[]> | null = null;

async function loadSearchCatalog(): Promise<SearchEntry[]> {
  if (cachedEntries) return cachedEntries;
  if (inflightFetch) return inflightFetch;

  inflightFetch = Promise.all([
    api<any[]>('/public/room-types').catch(() => []),
    api<any[]>('/public/menu').catch(() => []),
    api<{ activities?: any[]; experiences?: any[] }>('/public/site').catch(() => ({
      activities: [] as any[],
      experiences: [] as any[],
    })),
  ])
    .then(([roomTypes, menuItems, site]) => {
      const list: SearchEntry[] = [];

      // 1. Rooms
      if (Array.isArray(roomTypes)) {
        for (const raw of roomTypes) {
          const room = presentStay(raw);
          list.push({
            id: `room-${room._id}`,
            category: 'rooms',
            title: room.name,
            subtitle: [room.bed, room.size, `Up to ${room.maxAdults} adults`].filter(Boolean).join(' · '),
            priceLabel: `${pkr(room.baseRate)} / night`,
            image: room.image,
            keywords: [room.name, room.bed, room.size, room.description, ...(room.amenities || [])].join(' '),
            to: `/book?type=${room._id}`,
          });
        }
      }

      // 2. Activities & Experiences (deduped by normalized title)
      const seenActivities = new Set<string>();
      const pushActivity = (entry: SearchEntry) => {
        const key = entry.title.trim().toLowerCase();
        if (!key || seenActivities.has(key)) return;
        seenActivities.add(key);
        list.push(entry);
      };

      if (Array.isArray(site?.activities) && site.activities.length) {
        for (const act of site.activities) {
          pushActivity({
            id: `site-act-${act.title}`,
            category: 'activities',
            title: act.title,
            subtitle: act.body || 'Resort desert activity',
            image: media(act.image) || photos.jeep,
            keywords: `${act.title} ${act.body || ''} activity excursion katpana`,
            to: '/activities',
          });
        }
      } else {
        FALLBACK_ACTIVITIES.forEach(pushActivity);
      }

      const expSource = Array.isArray(site?.experiences) && site.experiences.length ? site.experiences : experiences;
      for (const exp of expSource) {
        if (exp.active === false) continue;
        pushActivity({
          id: `exp-${exp.slug || exp.title}`,
          category: 'activities',
          title: exp.title,
          subtitle: exp.summary || exp.kicker || 'Katpana experience',
          image: media(exp.image) || photos.bonfire,
          keywords: `${exp.title} ${exp.summary || ''} ${exp.kicker || ''} experience`,
          to: exp.slug ? `/experiences/${exp.slug}` : '/experiences',
        });
      }

      // 3. Dining & Kitchen Menu
      if (Array.isArray(menuItems)) {
        for (const dish of menuItems) {
          list.push({
            id: `dish-${dish._id}`,
            category: 'dining',
            title: dish.name,
            subtitle: dish.description || dish.category || 'Kitchen dish',
            priceLabel: pkr(dish.price),
            image: media(dish.image) || photos.breakfast,
            keywords: `${dish.name} ${dish.category || ''} ${dish.description || ''} food dining kitchen order`,
            to: '/order',
          });
        }
      }

      for (const diningItem of restaurants) {
        list.push({
          id: `dining-guide-${diningItem.slug}`,
          category: 'dining',
          title: diningItem.title,
          subtitle: diningItem.summary,
          image: diningItem.image,
          keywords: `${diningItem.title} ${diningItem.summary} ${diningItem.kicker} dining kitchen meal`,
          to: `/dining/${diningItem.slug}`,
        });
      }

      cachedEntries = list;
      return list;
    })
    .finally(() => {
      inflightFetch = null;
    });

  return inflightFetch;
}

const STATIC_SEED: SearchEntry[] = [
  ...FALLBACK_ACTIVITIES,
  ...restaurants.map((r) => ({
    id: `seed-dining-${r.slug}`,
    category: 'dining' as const,
    title: r.title,
    subtitle: r.summary,
    image: r.image,
    keywords: `${r.title} ${r.summary} dining`,
    to: `/dining/${r.slug}`,
  })),
];

function CategoryIcon({ category }: { category: Exclude<SearchCategory, 'all'> }) {
  if (category === 'rooms') return <BedDouble className="h-4 w-4 text-accent" />;
  if (category === 'activities') return <Compass className="h-4 w-4 text-accent" />;
  return <UtensilsCrossed className="h-4 w-4 text-accent" />;
}

export function GlobalSearch({
  variant = 'desktop',
  onNavigate,
}: {
  variant?: 'desktop' | 'mobile';
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<SearchEntry[]>(() => cachedEntries || STATIC_SEED);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  function ensureLoaded() {
    if (cachedEntries) {
      setEntries(cachedEntries);
      return;
    }
    setLoading(true);
    loadSearchCatalog()
      .then(setEntries)
      .finally(() => setLoading(false));
  }

  // Global Cmd+K / Ctrl+K shortcut on desktop bar
  useEffect(() => {
    if (variant !== 'desktop') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ensureLoaded();
        setOpen(true);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [variant]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byCat = category === 'all' ? entries : entries.filter((item) => item.category === category);
    if (!q) return byCat.slice(0, 7);

    const terms = q.split(/\s+/).filter(Boolean);
    return byCat
      .filter((item) => {
        const hay = `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      })
      .slice(0, 10);
  }, [entries, category, query]);

  const counts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const terms = q ? q.split(/\s+/).filter(Boolean) : [];
    const matched = terms.length
      ? entries.filter((item) => {
          const hay = `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase();
          return terms.every((t) => hay.includes(t));
        })
      : entries;

    return {
      all: matched.length,
      rooms: matched.filter((i) => i.category === 'rooms').length,
      activities: matched.filter((i) => i.category === 'activities').length,
      dining: matched.filter((i) => i.category === 'dining').length,
    };
  }, [entries, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, category, open]);

  function selectEntry(entry: SearchEntry) {
    setOpen(false);
    setQuery('');
    navigate(entry.to);
    onNavigate?.();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      ensureLoaded();
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (filtered.length ? (prev + 1) % filtered.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      e.preventDefault();
      selectEntry(filtered[activeIndex]);
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', variant === 'mobile' ? 'w-full' : 'w-full sm:w-44 lg:w-36 xl:w-48')}>
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          aria-label="Search rooms, activities, and dining"
          placeholder={variant === 'desktop' ? 'Search resort…' : 'Search rooms, activities, dining…'}
          onFocus={() => {
            ensureLoaded();
            setOpen(true);
          }}
          onChange={(e) => {
            ensureLoaded();
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            'h-9 w-full rounded-full border border-border/80 bg-secondary/45 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground transition-colors focus:border-accent focus:bg-card focus:outline-none focus:ring-2 focus:ring-accent/25 dark:border-white/15 dark:bg-[#0b1623]/90',
          )}
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          variant === 'desktop' && (
            <kbd className="pointer-events-none absolute right-2.5 hidden rounded border border-border/80 bg-card/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground xl:inline-block">
              ⌘K
            </kbd>
          )
        )}
      </div>

      {open && (
        <div
          className={cn(
            'z-50 mt-2 overflow-hidden rounded-xl border border-border bg-card/98 text-card-foreground shadow-2xl backdrop-blur-md',
            variant === 'mobile'
              ? 'w-full'
              : 'fixed inset-x-3 top-24 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:w-[440px]',
          )}
        >
          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 border-b border-border bg-secondary/40 p-1.5">
            {(
              [
                ['all', `All (${counts.all})`],
                ['rooms', `Rooms (${counts.rooms})`],
                ['activities', `Activities (${counts.activities})`],
                ['dining', `Dining (${counts.dining})`],
              ] as Array<[SearchCategory, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer',
                  category === key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Quick Suggestions when query empty */}
          {!query.trim() && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border/70 px-3 py-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Try:</span>
              {QUICK_TERMS.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setQuery(term);
                    inputRef.current?.focus();
                  }}
                  className="rounded-md border border-border/70 bg-secondary/50 px-2 py-0.5 text-[11px] text-foreground transition-colors hover:border-accent/60 hover:bg-secondary cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          )}

          {/* Results List */}
          <div className="max-h-80 overflow-y-auto p-1.5">
            {loading && entries.length <= STATIC_SEED.length ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Searching Oasis catalog…</p>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-6 text-center space-y-1.5">
                <p className="text-sm font-medium text-foreground">No matches for “{query.trim()}”</p>
                <p className="text-xs text-muted-foreground">
                  Try searching for Deluxe Hut, Trout, Jeep Safari, Bonfire, or Breakfast.
                </p>
              </div>
            ) : (
              filtered.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => selectEntry(item)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer',
                    idx === activeIndex ? 'bg-secondary/90' : 'hover:bg-secondary/60',
                  )}
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-md border border-border/60 object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary">
                      <CategoryIcon category={item.category} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                      {item.priceLabel && (
                        <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-accent">
                          {item.priceLabel}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
