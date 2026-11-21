import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { ArrowUp, ChevronDown, ChevronRight, Globe, Menu, MessageCircle, Moon, ShieldCheck, Sun } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/src/components/ui/sheet';
import { Separator } from '@/src/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Textarea } from '@/src/components/ui/textarea';
import { useI18n } from '@/src/context/I18nContext';
import { useAppTheme } from '@/src/context/ThemeContext';
import { GlobalSearch } from '@/src/components/guest/GlobalSearch';
import { SkarduWeatherWidget } from '@/src/components/guest/SkarduWeatherWidget';
import { track } from '@/src/lib/api';
import { WHATSAPP_URL } from '@/src/data/resortContent';
import { BrandLogo } from '@/src/components/BrandLogo';

const PRIMARY_LINKS = [
  { to: '/about', label: 'About' },
  { to: '/stay', label: 'Stay' },
  { to: '/facilities', label: 'Facilities' },
  { to: '/experiences', label: 'Experiences' },
  { to: '/activities', label: 'Activities' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/blog', label: 'Blog' },
];

const MORE_LINKS = [
  { to: '/offers', label: 'Seasonal Offers' },
  { to: '/dining', label: 'Kitchen & Dining' },
  { to: '/around', label: 'Around Skardu' },
  { to: '/events', label: 'Resort Events' },
  { to: '/reviews', label: 'Guest Reviews' },
  { to: '/directions', label: 'Directions & Map' },
  { to: '/virtual-tour', label: 'Virtual Tour' },
  { to: '/faq', label: 'Travel FAQ' },
  { to: '/booking', label: 'Find a Booking' },
  { to: '/login', label: 'Guest Portal' },
  { to: '/circle', label: 'Oasis Circle' },
  { to: '/contact', label: 'Contact Desk' },
];

export function GuestLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { lang, t, toggle } = useI18n();
  const { mode, toggleTheme } = useAppTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const started = Date.now();
    track({ type: 'view', path: pathname });
    return () => {
      track({ type: 'dwell', path: pathname, dwellMs: Date.now() - started });
    };
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const moreActive = MORE_LINKS.some((m) => pathname === m.to || pathname.startsWith(`${m.to}/`));
  const activeNavKey = moreActive
    ? '__more__'
    : PRIMARY_LINKS.find(
        (item) => pathname === item.to || (item.to === '/stay' && pathname === '/rooms') || pathname.startsWith(`${item.to}/`),
      )?.to ?? null;
  const spotlightTarget = hoveredNav ?? activeNavKey;

  const renderSpotlightBeam = (keyName: string) => {
    if (spotlightTarget !== keyName) return null;
    return (
      <motion.span
        layoutId="guest-nav-spotlight"
        aria-hidden="true"
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 420, damping: 34 }
        }
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Top glowing spotlight emitter bar */}
        <span
          className="absolute left-1/2 top-0 h-[3px] w-7 -translate-x-1/2 rounded-b-full bg-accent"
          style={{ boxShadow: '0 0 12px 2px var(--accent)' }}
        />
        {/* Soft emitter halo */}
        <span className="absolute left-1/2 top-0 h-3 w-9 -translate-x-1/2 rounded-full bg-accent/35 blur-[4px]" />
        {/* Conical trapezoidal beam */}
        <span
          className="absolute inset-0"
          style={{
            clipPath: 'polygon(28% 0%, 72% 0%, 100% 100%, 0% 100%)',
            background:
              mode === 'dark'
                ? 'linear-gradient(180deg, rgba(232,148,58,0.44) 0%, rgba(232,148,58,0.16) 58%, rgba(232,148,58,0) 100%)'
                : 'linear-gradient(180deg, rgba(217,119,36,0.3) 0%, rgba(217,119,36,0.1) 58%, rgba(217,119,36,0) 100%)',
          }}
        />
      </motion.span>
    );
  };

  return (
    <div className="relative z-10 flex min-h-screen flex-col text-foreground" dir={lang === 'ur' ? 'rtl' : 'ltr'}>
      {/* Single-row responsive Top Bar with slim Skardu Weather strip & full portal navigation */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="border-b border-border/60 bg-secondary/35 dark:bg-black/25">
          <div className="mx-auto flex h-8 max-w-7xl items-center justify-between gap-2 px-4 text-xs sm:px-6 lg:px-8">
            <span className="hidden sm:inline text-muted-foreground tracking-wide">
              Katpana Cold Desert · Skardu
            </span>
            <span className="sm:hidden text-muted-foreground tracking-wide">
              Skardu · Katpana
            </span>
            <SkarduWeatherWidget variant="topbar" />
          </div>
        </div>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 xl:gap-4">
          <Link
            to="/"
            aria-label="Oasis Resort Skardu — Home"
            className="flex items-center shrink-0 transition-opacity hover:opacity-80"
          >
            <BrandLogo variant="auto" className="h-11 sm:h-12 w-auto" />
          </Link>

          <MotionConfig reducedMotion="user">
            <nav
              onMouseLeave={() => setHoveredNav(null)}
              className="hidden lg:flex h-11 items-center gap-0.5 overflow-hidden rounded-full border border-border/80 bg-secondary/45 px-2 text-[13px] font-medium text-muted-foreground shadow-inner backdrop-blur-md xl:px-2.5 dark:border-white/10 dark:bg-[#0b1623]/90"
              aria-label="Main navigation"
            >
              {PRIMARY_LINKS.map((item) => {
                const active =
                  pathname === item.to ||
                  (item.to === '/stay' && pathname === '/rooms') ||
                  pathname.startsWith(`${item.to}/`);
                const lit = spotlightTarget === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onMouseEnter={() => setHoveredNav(item.to)}
                    onFocus={() => setHoveredNav(item.to)}
                    onBlur={() => setHoveredNav(null)}
                    className={`relative flex h-full items-center px-2 xl:px-3.5 whitespace-nowrap shrink-0 transition-colors duration-150 ${
                      active ? 'text-foreground font-semibold' : lit ? 'text-foreground' : 'hover:text-foreground'
                    }`}
                  >
                    {renderSpotlightBeam(item.to)}
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onMouseEnter={() => setHoveredNav('__more__')}
                    onFocus={() => setHoveredNav('__more__')}
                    onBlur={() => setHoveredNav(null)}
                    className={`relative flex h-full items-center gap-1 px-2 xl:px-3.5 whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer ${
                      moreActive
                        ? 'text-foreground font-semibold'
                        : spotlightTarget === '__more__'
                          ? 'text-foreground'
                          : 'hover:text-foreground'
                    }`}
                  >
                    {renderSpotlightBeam('__more__')}
                    <span className="relative z-10 inline-flex items-center gap-1">
                      More
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {MORE_LINKS.slice(0, 8).map((item) => (
                    <DropdownMenuItem key={item.to} asChild>
                      <Link to={item.to} className="w-full cursor-pointer">
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {MORE_LINKS.slice(8).map((item) => (
                    <DropdownMenuItem key={item.to} asChild>
                      <Link to={item.to} className="w-full cursor-pointer">
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </MotionConfig>

          <div className="flex items-center gap-2 shrink-0">
            <div className="w-36 sm:w-auto">
              <GlobalSearch variant="desktop" />
            </div>
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex whitespace-nowrap">
              <Link to="/order">Order Food</Link>
            </Button>
            <Button asChild variant="accent" size="sm" className="hidden sm:inline-flex whitespace-nowrap">
              <Link to="/book">Book Stay</Link>
            </Button>

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden h-10 w-10" aria-label="Open navigation menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                onOpenAutoFocus={(e) => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).focus();
                }}
                className="flex flex-col justify-between overflow-y-auto"
              >
                <div>
                  <SheetHeader className="flex-row items-center gap-3 space-y-0 pr-7">
                    <BrandLogo variant="auto" className="h-11 w-auto shrink-0" />
                    <SheetTitle className="font-display text-xl font-semibold leading-tight">
                      Oasis Resort Skardu
                    </SheetTitle>
                  </SheetHeader>
                  <nav className="mt-3 flex flex-col gap-0.5" aria-label="Mobile navigation">
                    {[
                      { to: '/', label: 'Home' },
                      ...PRIMARY_LINKS,
                      ...MORE_LINKS,
                      { to: '/order', label: 'Order Food' },
                      { to: '/book', label: 'Book a Stay' },
                    ].map((link) => {
                      const isActive =
                        link.to === '/'
                          ? pathname === '/'
                          : pathname === link.to ||
                            (link.to === '/stay' && pathname === '/rooms') ||
                            pathname.startsWith(`${link.to}/`);
                      return (
                        <Link
                          key={link.to}
                          to={link.to}
                          onClick={() => setMobileOpen(false)}
                          className={`group relative flex items-center justify-between overflow-hidden rounded-lg px-3 py-1.5 text-sm leading-snug transition-all duration-200 ease-out motion-reduce:transition-none ${
                            isActive
                              ? 'bg-accent/12 font-semibold text-accent dark:bg-accent/15'
                              : 'font-medium text-foreground/85 hover:bg-accent/10 hover:text-foreground dark:hover:bg-accent/15'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`absolute start-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent transition-all duration-200 ease-out motion-reduce:transition-none ${
                              isActive
                                ? 'scale-y-100 opacity-100'
                                : 'scale-y-0 opacity-0 group-hover:scale-y-100 group-hover:opacity-100'
                            }`}
                          />
                          <span
                            className={`transition-transform duration-200 ease-out motion-reduce:transition-none ${
                              isActive
                                ? 'translate-x-1.5 rtl:-translate-x-1.5'
                                : 'group-hover:translate-x-1.5 rtl:group-hover:-translate-x-1.5'
                            }`}
                          >
                            {link.label}
                          </span>
                          <ChevronRight
                            aria-hidden="true"
                            className={`h-3.5 w-3.5 shrink-0 text-accent transition-all duration-200 ease-out motion-reduce:transition-none rtl:rotate-180 ${
                              isActive
                                ? 'translate-x-0 opacity-90'
                                : '-translate-x-1.5 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 rtl:translate-x-1.5 rtl:group-hover:translate-x-0'
                            }`}
                          />
                        </Link>
                      );
                    })}
                  </nav>
                </div>
                <div className="mt-6 space-y-3 border-t border-border pt-4">
                  <SkarduWeatherWidget variant="sheet" />
                  <div className="flex items-center justify-between gap-2">
                    <Button variant="outline" size="sm" onClick={toggle} className="flex-1">
                      <Globe className="h-4 w-4" />
                      {t.lang}
                    </Button>
                    <Button variant="outline" size="sm" onClick={toggleTheme} className="flex-1">
                      {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      {mode === 'dark' ? 'Light' : 'Dark'}
                    </Button>
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to="/admin" onClick={() => setMobileOpen(false)}>
                      <ShieldCheck className="h-4 w-4" />
                      Staff & Admin Desk
                    </Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-12">{children}</main>

      <footer className="border-t border-border bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div className="space-y-3">
            <Link to="/" className="inline-block transition-opacity hover:opacity-85" aria-label="Oasis Resort Skardu">
              <BrandLogo variant="inverse" className="h-16 w-auto" />
            </Link>
            <h2 className="font-display text-2xl font-semibold">Oasis Resort Skardu</h2>
            <p className="text-sm leading-relaxed opacity-80">{t.footer}</p>
            <p className="text-xs opacity-70">{t.address}</p>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-60">Stay & Booking</p>
            <ul className="space-y-2 text-sm opacity-90">
              <li><Link to="/rooms" className="hover:underline">Rooms & Huts</Link></li>
              <li><Link to="/book" className="hover:underline">Check Availability</Link></li>
              <li><Link to="/booking" className="hover:underline">Find a Booking</Link></li>
              <li><Link to="/login" className="hover:underline">Guest Stay Portal</Link></li>
              <li><Link to="/order" className="hover:underline">In-Room Dining Order</Link></li>
              <li><Link to="/offers" className="hover:underline">Direct Offers</Link></li>
              <li><Link to="/reviews" className="hover:underline">Guest Reviews</Link></li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-60">The Desert & House</p>
            <ul className="space-y-2 text-sm opacity-90">
              <li><Link to="/about" className="hover:underline">About Oasis</Link></li>
              <li><Link to="/facilities" className="hover:underline">Resort Facilities</Link></li>
              <li><Link to="/activities" className="hover:underline">Activities & Safaris</Link></li>
              <li><Link to="/experiences" className="hover:underline">Experiences</Link></li>
              <li><Link to="/gallery" className="hover:underline">Photo Gallery</Link></li>
              <li><Link to="/dining" className="hover:underline">Kitchen & Dining</Link></li>
              <li><Link to="/blog" className="hover:underline">Journal & Blog</Link></li>
              <li><Link to="/around" className="hover:underline">Around Skardu</Link></li>
              <li><Link to="/faq" className="hover:underline">Travel FAQ</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-60">Front Desk</p>
              <p className="text-sm tabular-nums opacity-90">0308-1472888 · 0344-5537788 · 0355-4114567</p>
              <p className="mt-1 text-sm opacity-80">
                <a href="mailto:oasisresortskardu@gmail.com" className="hover:underline">oasisresortskardu@gmail.com</a>
              </p>
              <p className="mt-2 text-sm">
                <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                  Message Desk on WhatsApp →
                </a>
              </p>
            </div>

            <Separator className="bg-white/15" />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggle}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/10 cursor-pointer"
              >
                <Globe className="h-3.5 w-3.5" />
                {t.lang}
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/10 cursor-pointer"
              >
                {mode === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                {mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Staff Portal
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 text-xs opacity-75 sm:px-6 lg:px-8">
            <div className="space-y-1">
              <p>© {new Date().getFullYear()} Oasis Resort Skardu. Katpana Cold Desert.</p>
              <p className="opacity-80">We accept cash, card, bank transfer, JazzCash and Easypaisa.</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link to="/legal/privacy" className="hover:underline">Privacy</Link>
              <Link to="/legal/terms" className="hover:underline">Terms</Link>
              <Link to="/legal/access" className="hover:underline">Accessibility</Link>
              <Link to="/legal/best-rate" className="hover:underline">Best Rate</Link>
              <Link to="/legal/cancellation" className="hover:underline">Cancellation</Link>
              <Link to="/legal/refund" className="hover:underline">Refund Policy</Link>
              <Link to="/legal/cookies" className="hover:underline">Cookies</Link>
              <Link to="/sitemap" className="hover:underline">Sitemap</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Desktop quick actions */}
      {scrolled && (
        <button
          type="button"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 left-6 z-30 hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md hover:bg-secondary md:flex cursor-pointer"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 z-30 hidden items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-700 md:inline-flex"
      >
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </a>

      {/* Compact mobile bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-border bg-card/95 px-3 py-2 backdrop-blur md:hidden">
        <Button asChild variant="accent" size="sm" className="flex-1">
          <Link to="/book">Book Stay</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link to="/order">Order Food</Link>
        </Button>
        <Button asChild variant="secondary" size="sm" className="px-3">
          <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        </Button>
      </div>

      <ExitFeedbackDialog pathname={pathname} />
    </div>
  );
}

const EXIT_REASONS: Array<[string, string]> = [
  ['just_browsing', 'Just researching Skardu for later'],
  ['dates_full', 'My dates or preferred room appeared unavailable'],
  ['prices', 'Looking for a different rate / offer'],
  ['location_travel', 'Checking flight or road plans first'],
  ['missing_info', 'Couldn’t find the detail I needed'],
  ['other', 'Something else'],
];

function ExitFeedbackDialog({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('just_browsing');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('oasis_exit_done') === '1') return;
    } catch {
      return;
    }
    if (pathname.startsWith('/book') || pathname.startsWith('/login') || pathname.startsWith('/order')) return;

    let ready = false;
    const timer = setTimeout(() => {
      ready = true;
    }, 20000);

    const onLeave = (e: MouseEvent) => {
      if (!ready || e.clientY > 4) return;
      try {
        if (sessionStorage.getItem('oasis_exit_done') === '1') return;
        sessionStorage.setItem('oasis_exit_done', '1');
      } catch {
        /* ignore */
      }
      setOpen(true);
    };

    document.addEventListener('mouseleave', onLeave);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, [pathname]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    track({ type: 'exit_reason', path: pathname, reason, note: note.trim() });
    setSent(true);
    setTimeout(() => setOpen(false), 900);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Before you head off…</DialogTitle>
          <DialogDescription>
            Quick two-second note for our Skardu front desk: what brought you out without booking today?
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <p className="py-4 text-sm text-emerald-600 font-medium">Thank you — noted for the team at Katpana.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-2">
              {EXIT_REASONS.map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setReason(code)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm cursor-pointer transition-colors ${
                    reason === code ? 'border-accent bg-accent/10 font-medium text-foreground' : 'border-border text-muted-foreground hover:border-foreground/30'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Textarea
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note (what were you looking for?)"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Skip</Button>
              <Button type="submit" variant="accent">Send Note</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
