import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Rating } from '@mui/material';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Calendar,
  Car,
  CheckCircle2,
  ChevronDown,
  Coffee,
  Flame,
  MessageSquareHeart,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { GuestLayout } from '@/src/components/guest/GuestLayout';
import { HeroCarousel, type HeroSlide } from '@/src/components/guest/HeroCarousel';
import { StoryPhotoCarousel, type StorySlide } from '@/src/components/guest/StoryPhotoCarousel';
import { InfoHoverCard, ShowcaseHoverCard } from '@/src/components/guest/InteractiveHoverCard';
import { FacilityShowcase } from '@/src/components/guest/FacilitySection';
import { EnquiryForm } from '@/src/components/guest/EnquiryForm';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Separator } from '@/src/components/ui/separator';
import { Textarea } from '@/src/components/ui/textarea';
import { useI18n } from '@/src/context/I18nContext';
import { addDays, api, clamp, media, pkr, todayISO } from '@/src/lib/api';
import { defaultReviews, journals, official, photos, presentStay } from '@/src/data/resortContent';

export function HomePage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [businessDate, setBusinessDate] = useState(todayISO());
  const [types, setTypes] = useState<any[]>([]);
  const [site, setSite] = useState<any>(null);
  const [dishes, setDishes] = useState<any[]>([]);
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Array<{ guestName: string; rating: number; comment: string }>>([]);
  const [showPromo, setShowPromo] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const bookingCardRef = useRef<HTMLDivElement>(null);
  const [bookingHalfHeight, setBookingHalfHeight] = useState(60);
  const [form, setForm] = useState({
    checkIn: todayISO(),
    checkOut: addDays(todayISO(), 2),
    adults: 2,
    children: 0,
    rooms: 1,
  });
  const [feedbackForm, setFeedbackForm] = useState({
    guestName: '',
    email: '',
    stayTitle: 'Overall Stay',
    rating: 5 as number | null,
    comment: '',
  });
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<{ guestName: string; rating: number } | null>(null);

  useEffect(() => {
    api<{ businessDate: string }>('/public/hotel')
      .then((res) => {
        if (res.businessDate) {
          setBusinessDate(res.businessDate);
          setForm((prev) => ({
            ...prev,
            checkIn: res.businessDate,
            checkOut: addDays(res.businessDate, 2),
          }));
        }
      })
      .catch(() => {});

    api<any[]>('/public/room-types').then(setTypes).catch(() => {});
    api('/public/site').then(setSite).catch(() => {});
    api<any[]>('/public/menu')
      .then((items) => setDishes(items.filter((d) => d.image).slice(0, 4)))
      .catch(() => {});
    api<any[]>('/public/blog')
      .then((posts) => setBlogPosts(Array.isArray(posts) ? posts.slice(0, 3) : []))
      .catch(() => {});
    api<any[]>('/public/reviews')
      .then((rows) => {
        if (Array.isArray(rows) && rows.length) setReviews(rows.slice(0, 3));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = bookingCardRef.current;
    if (!el) return;
    const syncHalfHeight = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) setBookingHalfHeight(Math.round(h / 2));
    };
    syncHalfHeight();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(syncHalfHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function updateCheckIn(value: string) {
    if (!value) return;
    setForm((prev) => ({
      ...prev,
      checkIn: value,
      checkOut: prev.checkOut > value ? prev.checkOut : addDays(value, 2),
    }));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      adults: String(form.adults),
      children: String(form.children),
      rooms: String(form.rooms),
    });
    if (promoCode.trim()) params.set('offer', promoCode.trim());
    navigate(`/book?${params.toString()}`);
  }

  async function handleGuestFeedback(e: React.FormEvent) {
    e.preventDefault();
    const name = feedbackForm.guestName.trim();
    const comment = feedbackForm.comment.trim();
    const rating = feedbackForm.rating || 0;

    if (name.length < 2) {
      setFeedbackError('Please enter your name (at least 2 characters).');
      return;
    }
    if (rating < 1 || rating > 5) {
      setFeedbackError('Please choose a rating between 1 and 5 stars.');
      return;
    }
    if (comment.length < 5) {
      setFeedbackError('Please share a few words about your experience.');
      return;
    }

    setFeedbackError('');
    setFeedbackBusy(true);
    try {
      await api('/public/feedback', {
        method: 'POST',
        body: {
          guestName: name,
          email: feedbackForm.email.trim(),
          stayTitle: feedbackForm.stayTitle,
          rating,
          comment,
        },
      });
      setFeedbackSubmitted({ guestName: name, rating });
      setFeedbackForm({
        guestName: '',
        email: '',
        stayTitle: 'Overall Stay',
        rating: 5,
        comment: '',
      });
      toast.success('Thank you — your experience has been sent to our desk.');
    } catch (err: any) {
      const message = err.message || 'Could not submit your feedback right now.';
      setFeedbackError(message);
      toast.error(message);
    } finally {
      setFeedbackBusy(false);
    }
  }

  const liveActivities: Array<{ image?: string; title: string; body: string }> =
    site?.activities?.length
      ? site.activities
      : [
          { image: official.jeep, title: 'Dune safari', body: 'A jeep leaves from the door. The loop stays on the cold desert and comes back before dark.' },
          { image: official.stargazing, title: 'Stars', body: 'The desert is dark enough for the sky. Ask the desk if you want a quiet hour outside.' },
          { image: official.camel, title: 'A sunset walk', body: 'The sand is the walk. Tell reception if you want it timed with the fire.' },
          { image: official.view, title: 'The ridge', body: 'The same window in the morning is the Karakoram. Shangrila is a separate day, by jeep.' },
        ];

  const liveExperiences: any[] = site?.experiences?.filter((x: any) => x.active !== false) || [];
  const visibleReviews = reviews.length
    ? reviews
    : defaultReviews.map(([guestName, comment]) => ({ guestName, rating: 5, comment }));

  const heroSlides: HeroSlide[] = [
    {
      src: photos.wide,
      alt: 'Glass-fronted huts on the Katpana cold desert with the Karakoram peaks behind',
      label: 'Katpana Cold Desert',
      caption: 'Glass-fronted timber huts facing the Karakoram',
      objectPosition: 'object-[center_62%]',
    },
    {
      src: official.desertK2,
      alt: 'Sunset on the Katpana dunes with high mountain peaks behind Oasis Resort Skardu',
      label: 'Dunes & Peaks',
      caption: 'Evening light over the Skardu dunes',
      objectPosition: 'object-center',
    },
    {
      src: official.landscape,
      alt: 'The full Oasis Resort grounds across the Katpana desert valley',
      label: 'Oasis Grounds',
      caption: 'Low timber chalets set across the sand',
      objectPosition: 'object-center',
    },
    {
      src: photos.panorama,
      alt: 'The full row of huts at Oasis Resort Skardu in winter light',
      label: 'Skardu Winter',
      caption: 'Heated huts overlooking the snow ridge',
      objectPosition: 'object-[center_58%]',
    },
  ];

  const storySlides: StorySlide[] = [
    {
      src: photos.row,
      alt: 'The row of huts facing the Katpana snowfield',
      caption: 'The row, facing the Katpana dune. Check-in is from 2:00 PM.',
    },
    {
      src: photos.snow,
      alt: 'Winter light along the red roofs of Oasis Resort Skardu',
      caption: 'Winter light along the red roofs — heated huts before you arrive.',
    },
    {
      src: photos.cloud,
      alt: 'Timber cottages set against bare Katpana dunes and cloud cover',
      caption: 'The same hut row when the desert sand is clear beneath the peaks.',
    },
    {
      src: official.rooms,
      alt: 'Walkway along the chalet terrace looking out toward the Karakoram',
      caption: 'Glass fronts opening straight onto 165 kanals of cold desert.',
    },
  ];

  return (
    <GuestLayout>
      {/* 1. Hero Showcase with 4-Image Shadcn + Material UI Carousel */}
      <HeroCarousel slides={heroSlides}>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-auto max-w-2xl pt-2 text-white"
        >
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="h-[1px] w-8 bg-amber-300/85" />
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-amber-200/95 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)] sm:text-xs">
              {t.kicker}
            </p>
          </div>
          <h1 className="font-display mt-3.5 text-5xl font-medium leading-[0.98] tracking-[-0.02em] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)] sm:text-7xl lg:text-[5.25rem]">
            {site?.heroTitle || t.hero}
          </h1>
          <p className="mt-5 max-w-xl border-l border-amber-300/60 pl-4 text-base font-normal leading-relaxed tracking-[0.01em] text-white/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] sm:text-lg lg:text-[1.2rem]">
            {site?.heroLede || t.heroBody}
          </p>
        </motion.div>
      </HeroCarousel>

      {/* 2. Seam-Centered Booking Bar (exact 50/50 bridge between Section 1 & Section 2) + Assurance Strip */}
      <section className="relative flow-root border-b border-border bg-card/75 backdrop-blur-[2px]">
        <div
          ref={bookingCardRef}
          style={{ marginTop: -bookingHalfHeight }}
          className="relative z-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        >
          <Card className="border-border/80 bg-card/98 shadow-2xl backdrop-blur-md">
            <CardContent className="p-4 sm:p-5">
              <form onSubmit={handleSearch} className="space-y-3">
                <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto] md:items-end">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1.5">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {t.checkIn}
                      </span>
                      <Input
                        type="date"
                        required
                        min={businessDate}
                        value={form.checkIn}
                        onChange={(e) => updateCheckIn(e.target.value)}
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {t.checkOut}
                      </span>
                      <Input
                        type="date"
                        required
                        min={form.checkIn ? addDays(form.checkIn, 1) : undefined}
                        value={form.checkOut}
                        onChange={(e) => setForm((p) => ({ ...p, checkOut: e.target.value }))}
                      />
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      Guests & Rooms
                    </span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="w-full justify-between font-normal">
                          <span className="truncate tabular-nums">
                            {form.adults} {form.adults === 1 ? 'adult' : 'adults'}
                            {form.children > 0 ? ` · ${form.children} children` : ''} · {form.rooms}{' '}
                            {form.rooms === 1 ? 'room' : 'rooms'}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-60" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{t.adults}</span>
                          <Input
                            type="number"
                            min={1}
                            max={16}
                            className="w-20 tabular-nums"
                            value={form.adults}
                            onChange={(e) => setForm((p) => ({ ...p, adults: clamp(e.target.value, 1, 16) }))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{t.children}</span>
                          <Input
                            type="number"
                            min={0}
                            max={12}
                            className="w-20 tabular-nums"
                            value={form.children}
                            onChange={(e) => setForm((p) => ({ ...p, children: clamp(e.target.value, 0, 12) }))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Rooms</span>
                          <Input
                            type="number"
                            min={1}
                            max={4}
                            className="w-20 tabular-nums"
                            value={form.rooms}
                            onChange={(e) => setForm((p) => ({ ...p, rooms: clamp(e.target.value, 1, 4) }))}
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Button type="submit" variant="accent" size="lg" className="w-full md:w-auto">
                    {t.search}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPromo((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    {showPromo ? 'Hide promo code' : 'Have an offer or promo code?'}
                  </button>
                  {showPromo && (
                    <Input
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="Enter offer code (e.g. WINTER)"
                      className="h-8 max-w-xs text-xs"
                    />
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 pb-8 pt-8 sm:gap-5 sm:px-6 md:grid-cols-4 lg:px-8">
          {[
            { icon: Coffee, title: 'Breakfast included', sub: 'In every direct room rate' },
            { icon: Flame, title: 'Heated before arrival', sub: 'Warm huts throughout winter' },
            { icon: Car, title: 'Airport transfer', sub: 'Complimentary on 3+ nights' },
            { icon: Sparkles, title: 'Book direct & save', sub: 'Best rate, no middleman' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="group relative flex items-start gap-3 overflow-hidden rounded-xl border border-border/75 bg-card/85 p-3.5 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1 hover:border-transparent hover:bg-card hover:shadow-xl dark:bg-card/65 dark:hover:bg-card cursor-default"
              >
                {/* Soft 3-color ambient wash on hover */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-amber-500/8 via-cyan-500/8 to-rose-500/8 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />

                {/* Bold 3-color revolving border */}
                <span
                  aria-hidden="true"
                  className="revolve-border-mask-bold pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                >
                  <span
                    className="animate-revolve-lines absolute left-1/2 top-1/2 block aspect-square w-[240%]"
                    style={{
                      background:
                        'conic-gradient(from 0deg, transparent 0deg, #f59e0b 16deg, #fbbf24 56deg, transparent 94deg, transparent 120deg, #06b6d4 136deg, #22d3ee 176deg, transparent 214deg, transparent 240deg, #f43f5e 256deg, #fb7185 296deg, transparent 334deg, transparent 360deg)',
                    }}
                  />
                </span>

                <div className="relative z-20 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-accent transition-all duration-300 ease-out group-hover:scale-110 group-hover:bg-accent group-hover:text-white group-hover:shadow-md">
                  <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-105" />
                </div>
                <div className="relative z-20 min-w-0">
                  <p className="text-sm font-semibold text-foreground transition-colors duration-300 group-hover:text-accent">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground transition-colors duration-300 group-hover:text-foreground/85">
                    {item.sub}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Welcome / Your base in Katpana */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-accent">{t.storyKicker}</p>
            <h2 className="font-display text-4xl font-semibold text-foreground sm:text-5xl">{t.storyTitle}</h2>
            <p className="text-base leading-relaxed text-muted-foreground">{t.storyBody}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The huts are glass at the front, stone at the base, and heated before you arrive. Breakfast is included,
              and an extra mattress is PKR 2,500 if you tell the desk ahead.
            </p>
            <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
              <div>
                <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">19</p>
                <p className="text-xs text-muted-foreground">Private desert huts</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">15 min</p>
                <p className="text-xs text-muted-foreground">From Skardu airport</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">165</p>
                <p className="text-xs text-muted-foreground">Kanals along the dune</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="outline">
                <Link to="/virtual-tour">Walk the grounds</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/directions">Directions & map</Link>
              </Button>
            </div>
          </div>

          <StoryPhotoCarousel slides={storySlides} />
        </div>
      </section>

      <Separator className="mx-auto max-w-7xl" />

      {/* 4. Choose Your Stay */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-accent">Accommodation</p>
            <h2 className="font-display mt-1 text-4xl font-semibold text-foreground sm:text-5xl">{t.roomsTitle}</h2>
          </div>
          <Button asChild variant="outline">
            <Link to="/rooms">All accommodation</Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {types.slice(0, 5).map((raw, index) => {
            const room = presentStay(raw);
            return (
              <ShowcaseHoverCard
                key={room._id}
                image={room.image}
                alt={room.name}
                fallbackTitle={room.name}
                kicker={[room.bed, room.size, `${room.maxAdults} adults`].filter(Boolean).join(' · ')}
                title={room.name}
                description={room.description}
                price={`${t.from} ${pkr(room.baseRate)} / night`}
                heightClass="h-80 sm:h-[22rem]"
                className={index === 0 ? 'md:col-span-2 lg:col-span-2' : ''}
                actions={
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-xs text-white/75">Breakfast included</span>
                    <Button asChild size="sm" variant="accent">
                      <Link to={`/book?type=${room._id}`}>{t.choose}</Link>
                    </Button>
                  </div>
                }
              />
            );
          })}
        </div>
      </section>

      {/* 5. From the Resort — Live CMS Activities ("Days on the sand") */}
      <section className="border-y border-border bg-card/75 py-16 backdrop-blur-[2px]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-accent">From the resort</p>
              <h2 className="font-display mt-1 text-4xl font-semibold text-foreground sm:text-5xl">
                Activities &amp; days on the sand
              </h2>
            </div>
            <Button asChild variant="outline">
              <Link to="/activities">All activities</Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {liveActivities.slice(0, 4).map((act, idx) => (
              <ShowcaseHoverCard
                key={`${act.title}-${idx}`}
                image={media(act.image) || official.jeep}
                alt={act.title}
                kicker="Desert Activity"
                title={act.title}
                description={act.body}
                heightClass="h-72"
              />
            ))}
          </div>
        </div>
      </section>

      {/* 6. Inside the Hut */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">Rooms &amp; Morning Tray</p>
          <h2 className="font-display mt-1 text-4xl font-semibold text-foreground sm:text-5xl">Inside the hut</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Carved beds, a valley window, and the same breakfast whether you eat it in the room or at the table.
          </p>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            [photos.deluxeDay, 'Morning in the deluxe room', 'King bed, carved wood, and the poplar valley through the glass.'],
            [photos.executive, 'The executive room', 'Heavier curtains, the same view, and chairs by the window.'],
            [photos.breakfast, 'Breakfast, included', 'Eggs, toast, tea, and jam. Ask the night before if you want the tray at the hut.'],
          ].map(([src, title, text]) => (
            <ShowcaseHoverCard
              key={title}
              image={src}
              alt={title}
              kicker="Inside Oasis"
              title={title}
              description={text}
              heightClass="h-72"
            />
          ))}
        </div>
      </section>

      {/* 7. The Kitchen & Dining */}
      {dishes.length > 0 && (
        <section className="border-y border-border bg-card/75 py-16 backdrop-blur-[2px]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-accent">The kitchen</p>
                <h2 className="font-display mt-1 text-4xl font-semibold text-foreground sm:text-5xl">{t.dineTitle}</h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t.dineBody}</p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link to="/dining">Dining Guide</Link>
                </Button>
                <Button asChild variant="accent">
                  <Link to="/order">Order Food</Link>
                </Button>
              </div>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {dishes.map((dish) => (
                <ShowcaseHoverCard
                  key={dish._id}
                  image={media(dish.image)}
                  alt={dish.name}
                  fallbackTitle={dish.name}
                  kicker={dish.category || 'Kitchen'}
                  price={pkr(dish.price)}
                  title={dish.name}
                  description={dish.description}
                  heightClass="h-72"
                  actions={
                    <Link to="/order" className="text-xs font-semibold text-amber-300 hover:underline">
                      Order to hut →
                    </Link>
                  }
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 8. Facilities (Live CMS Facilities) */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-accent">Facilities</p>
            <h2 className="font-display mt-1 text-4xl font-semibold text-foreground">Built for high-altitude comfort</h2>
          </div>
          <Button asChild variant="outline">
            <Link to="/facilities">All facilities</Link>
          </Button>
        </div>
        <FacilityShowcase compact revolveBorder />
      </section>

      {/* 9. Experiences (Live CMS Experiences + Signature Outings) */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-accent">Experiences</p>
            <h2 className="font-display mt-1 text-4xl font-semibold text-foreground">Evenings &amp; outings at Katpana</h2>
          </div>
          <Button asChild variant="outline">
            <Link to="/experiences">All experiences</Link>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {(liveExperiences.length
            ? liveExperiences.slice(0, 3).map((x) => ({
                img: media(x.image) || photos.bonfire,
                kicker: x.kicker || 'Oasis Experience',
                title: x.title,
                summary: x.summary,
                to: `/experiences/${x.slug}`,
              }))
            : [
                {
                  img: photos.bonfire,
                  kicker: 'After six',
                  title: 'Fire on the sand',
                  summary: 'Tell the desk by six. Chairs go out on the dune side, and dinner can be served there.',
                  to: '/experiences/bonfire',
                },
                {
                  img: photos.jeep,
                  kicker: 'Afternoons',
                  title: 'A jeep, when you want one',
                  summary: 'Dune loops leave from the hut, not from town. The desk writes the return time down.',
                  to: '/activities',
                },
                {
                  img: photos.shangrila,
                  kicker: 'A day out',
                  title: 'Shangrila Lake excursion',
                  summary: 'Lower Kachura sits a scenic drive away. Our desk arranges transport before dark.',
                  to: '/around/shangrila',
                },
              ]
          ).map((card) => (
            <ShowcaseHoverCard
              key={card.title}
              image={card.img}
              alt={card.title}
              kicker={card.kicker}
              title={card.title}
              description={card.summary}
              heightClass="h-80"
              actions={
                <Link to={card.to} className="text-xs font-semibold text-amber-300 hover:underline">
                  Read more →
                </Link>
              }
            />
          ))}
        </div>
      </section>

      {/* 10. Resort Journal / Blog & Guest Reviews */}
      <section className="border-y border-border bg-card/75 py-16 backdrop-blur-[2px]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-14">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-accent">Resort Journal &amp; Blog</p>
                <h2 className="font-display mt-1 text-4xl font-semibold text-foreground">Stories from Katpana</h2>
              </div>
              <Button asChild variant="outline">
                <Link to="/blog">Read the blog</Link>
              </Button>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {(blogPosts.length ? blogPosts : journals).slice(0, 3).map((post: any) => (
                <ShowcaseHoverCard
                  key={post.slug}
                  image={media(post.image) || photos.wide}
                  alt={post.title}
                  kicker={post.authorName || post.kicker || 'Oasis Team'}
                  title={post.title}
                  description={post.excerpt || post.summary}
                  heightClass="h-72"
                  actions={
                    <Link to={`/blog/${post.slug}`} className="text-xs font-semibold text-amber-300 hover:underline">
                      Read story →
                    </Link>
                  }
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-accent">Guest Voices</p>
                <h2 className="font-display mt-1 text-4xl font-semibold text-foreground">From guests who stayed</h2>
              </div>
              <Button asChild variant="outline">
                <Link to="/reviews">All reviews</Link>
              </Button>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {visibleReviews.map((rev, i) => (
                <InfoHoverCard
                  key={i}
                  label={<Rating value={rev.rating} readOnly size="small" />}
                  title={rev.guestName}
                  detail={`“${rev.comment}”`}
                  meta="Verified Direct Stay"
                  heightClass="min-h-[188px]"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 11. Guest Feedback */}
      <section id="guest-feedback" className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
        <Card className="overflow-hidden border-border/80 bg-card/85 shadow-xl backdrop-blur-sm">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-between bg-[#132038] p-8 text-[#f8f5ee] sm:p-10">
              <div className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-300">Guest Feedback</p>
                <h2 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                  Share your Oasis experience
                </h2>
                <p className="text-sm leading-relaxed text-white/80">
                  Stayed at Katpana, dined in our kitchen, or joined a desert bonfire? Tell our management team how your time felt.
                </p>

                <ul className="space-y-3 pt-2 text-xs text-white/85">
                  <li className="flex items-start gap-2.5">
                    <MessageSquareHeart className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <span>Every submission goes straight to our front-desk &amp; management Guest Feedback portal.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Star className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <span>Approved notes can be featured on the Guest Reviews wall after team review.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <span>No booking code required — share openly as a past guest or visitor.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 border-t border-white/15 pt-5">
                <Link to="/reviews" className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:underline">
                  Read published guest reviews
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <CardContent className="p-6 sm:p-10">
              {feedbackSubmitted ? (
                <div className="flex h-full flex-col justify-center space-y-5 py-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display text-3xl font-semibold text-foreground">
                      Thank you, {feedbackSubmitted.guestName}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Your {feedbackSubmitted.rating}-star experience has been recorded and delivered to the Oasis Guest Feedback desk.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" variant="outline" onClick={() => setFeedbackSubmitted(null)}>
                      Submit another feedback
                    </Button>
                    <Button asChild variant="accent">
                      <Link to="/reviews">View guest reviews</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleGuestFeedback} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label>Overall Rating *</Label>
                    <div className="flex flex-wrap items-center gap-3 pt-0.5">
                      <Rating
                        name="homepage-guest-rating"
                        value={feedbackForm.rating}
                        size="large"
                        onChange={(_e, val) => setFeedbackForm((p) => ({ ...p, rating: val || 5 }))}
                      />
                      <span className="text-xs font-medium text-muted-foreground">
                        {
                          ['', 'Needs improvement', 'Fair stay', 'Good experience', 'Very good stay', 'Exceptional experience'][
                            feedbackForm.rating || 5
                          ]
                        }
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="gf-name">Your Name *</Label>
                      <Input
                        id="gf-name"
                        required
                        maxLength={120}
                        value={feedbackForm.guestName}
                        onChange={(e) => setFeedbackForm((p) => ({ ...p, guestName: e.target.value }))}
                        placeholder="e.g. Bilal Ahmed"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="gf-email">Email (Optional)</Label>
                      <Input
                        id="gf-email"
                        type="email"
                        maxLength={120}
                        value={feedbackForm.email}
                        onChange={(e) => setFeedbackForm((p) => ({ ...p, email: e.target.value }))}
                        placeholder="For any follow-up from desk"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="gf-highlight">Experience Highlight</Label>
                    <Select
                      value={feedbackForm.stayTitle}
                      onValueChange={(val) => setFeedbackForm((p) => ({ ...p, stayTitle: val }))}
                    >
                      <SelectTrigger id="gf-highlight">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Overall Stay">Overall Stay</SelectItem>
                        <SelectItem value="Glass Desert Huts">Glass Desert Huts</SelectItem>
                        <SelectItem value="Kitchen & Dining">Kitchen &amp; Dining</SelectItem>
                        <SelectItem value="Desert Safari & Bonfire">Desert Safari &amp; Bonfire</SelectItem>
                        <SelectItem value="Hospitality & Service">Hospitality &amp; Service</SelectItem>
                        <SelectItem value="Winter Heating & Comfort">Winter Heating &amp; Comfort</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="gf-comment">Your Experience *</Label>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {feedbackForm.comment.length} / 2000
                      </span>
                    </div>
                    <Textarea
                      id="gf-comment"
                      rows={4}
                      required
                      maxLength={2000}
                      value={feedbackForm.comment}
                      onChange={(e) => setFeedbackForm((p) => ({ ...p, comment: e.target.value }))}
                      placeholder="How were the heated huts, desert views, dining, or our hospitality?"
                    />
                  </div>

                  {feedbackError && <Alert severity="error">{feedbackError}</Alert>}

                  <Button type="submit" variant="accent" size="lg" disabled={feedbackBusy} className="w-full sm:w-auto">
                    <Send className="h-4 w-4" />
                    {feedbackBusy ? 'Sending feedback…' : 'Submit Feedback'}
                  </Button>
                </form>
              )}
            </CardContent>
          </div>
        </Card>
      </section>

      {/* 12. Seasonal Updates / Newsletter */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <EnquiryForm
          topic="Newsletter"
          title="Seasonal updates from Katpana"
          prompt="Receive winter opening rates, direct stay offers, and Skardu travel notes from the desk."
        />
      </section>
    </GuestLayout>
  );
}
