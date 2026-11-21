import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Alert } from '@mui/material';
import { ArrowLeft, BadgeCheck, PenLine, Search } from 'lucide-react';
import { toast } from 'sonner';
import { GuestLayout } from '@/src/components/guest/GuestLayout';
import { InfoHoverCard, ShowcaseHoverCard } from '@/src/components/guest/InteractiveHoverCard';
import { EnquiryForm } from '@/src/components/guest/EnquiryForm';
import { ResilientImage } from '@/src/components/guest/ResilientImage';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import { api, media, pkr } from '@/src/lib/api';
import { applyDocumentSeo } from '@/src/lib/seo';
import {
  collections,
  EditorialItem,
  experiences,
  journals,
  offers,
  photos,
  places,
  policies,
  restaurants,
  sectionGuides,
  wellness,
} from '@/src/data/resortContent';

const KIND_MAP: Record<string, { kicker: string; title: string; lede: string; items: EditorialItem[]; basePath: string }> = {
  places: {
    kicker: 'From the resort',
    title: 'Around Skardu',
    lede: 'The desert is at the door. Shangrila is a drive. The desk arranges the car, and writes the time you should be back.',
    items: places,
    basePath: '/around',
  },
  experiences: {
    kicker: 'While you are here',
    title: 'Experiences',
    lede: 'Breakfast is included. A jeep, a fire, and a day at the lake are arranged by this desk, then posted to the room bill if there is a charge.',
    items: experiences,
    basePath: '/experiences',
  },
  offers: {
    kicker: 'Direct from the desk',
    title: 'Offers',
    lede: 'These are the stays we would rather sell ourselves. Mention the offer in your booking and the desk applies it.',
    items: offers,
    basePath: '/offers',
  },
  restaurants: {
    kicker: 'One kitchen',
    title: 'Dining',
    lede: 'Breakfast in the rate. Dinner on the sand or a tray at the hut. Lunch and dinner post to the room bill.',
    items: restaurants,
    basePath: '/dining',
  },
  journals: {
    kicker: 'Notes',
    title: 'Journal',
    lede: 'Short pieces from the huts and the kitchen. The rate on this site is the rate the desk keeps.',
    items: journals,
    basePath: '/blog',
  },
};

export function IndexPage({ kind }: { kind: keyof typeof KIND_MAP }) {
  const meta = KIND_MAP[kind];
  const guide = sectionGuides[kind];
  const [items, setItems] = useState<EditorialItem[]>(meta.items);
  const [menuItems, setMenuItems] = useState<any[]>([]);

  useEffect(() => {
    setItems(meta.items);
    if (kind === 'experiences') {
      api<{ experiences: EditorialItem[] }>('/public/site')
        .then((site) => {
          if (site.experiences?.length) setItems(site.experiences.map((e) => ({ ...e, image: media(e.image) })));
        })
        .catch(() => {});
    } else if (kind === 'journals') {
      api<any[]>('/public/blog')
        .then((posts) => {
          const mapped: EditorialItem[] = posts.map((p) => ({
            slug: p.slug,
            title: p.title,
            kicker: p.source === 'guest' ? `Guest story · ${p.authorName}` : 'From the team',
            image: media(p.image) || photos.wide,
            summary: p.excerpt,
            body: p.body,
            authorName: p.authorName,
            publishedAt: p.publishedAt,
          }));
          setItems([...mapped, ...journals]);
        })
        .catch(() => {});
    } else if (kind === 'restaurants') {
      api<any[]>('/public/menu').then(setMenuItems).catch(() => {});
    }
  }, [kind, meta.items]);

  return (
    <GuestLayout>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-accent">{meta.kicker}</p>
          <h1 className="font-display mt-2 text-4xl font-semibold sm:text-5xl">{meta.title}</h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">{meta.lede}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ShowcaseHoverCard
              key={item.slug}
              image={item.image}
              alt={item.title}
              kicker={item.kicker}
              title={item.title}
              description={item.summary}
              heightClass="h-80"
              actions={
                <div className="flex w-full items-center justify-between gap-2">
                  <Link to={`${meta.basePath}/${item.slug}`} className="text-xs font-semibold text-amber-300 hover:underline">
                    Read more →
                  </Link>
                  {item.book && (
                    <Button asChild variant="accent" size="sm">
                      <Link to={`/book?offer=${encodeURIComponent(item.title)}`}>Book with offer</Link>
                    </Button>
                  )}
                </div>
              }
            />
          ))}
        </div>

        {kind === 'restaurants' && menuItems.length > 0 && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl font-semibold">Today’s Kitchen Menu</h2>
                <p className="text-sm text-muted-foreground">Order directly from your room once checked in.</p>
              </div>
              <Button asChild variant="accent" size="sm">
                <Link to="/order">Order Food</Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {menuItems.map((dish) =>
                dish.image ? (
                  <ShowcaseHoverCard
                    key={dish._id}
                    image={media(dish.image)}
                    alt={dish.name}
                    kicker={dish.category}
                    price={pkr(dish.price)}
                    title={dish.name}
                    description={dish.description}
                    heightClass="h-64"
                    actions={
                      <Link to="/order" className="text-xs font-semibold text-amber-300 hover:underline">
                        Order to hut →
                      </Link>
                    }
                  />
                ) : (
                  <InfoHoverCard
                    key={dish._id}
                    label={dish.category}
                    title={dish.name}
                    detail={dish.description || 'Prepared fresh in the Oasis kitchen.'}
                    meta={pkr(dish.price)}
                    heightClass="min-h-[160px]"
                  />
                ),
              )}
            </div>
          </div>
        )}

        {guide?.facts && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {guide.facts.map((fact) => (
              <InfoHoverCard
                key={fact.label}
                label={fact.label}
                title={fact.value}
                detail={fact.note || fact.value}
                heightClass="min-h-[156px]"
                revolveBorder
              />
            ))}
          </div>
        )}

        {guide?.steps && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold">{guide.stepsTitle}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {guide.steps.map((s, i) => (
                <InfoHoverCard
                  key={s.title}
                  label={`0${i + 1}`}
                  title={s.title}
                  detail={s.body}
                  heightClass="min-h-[168px]"
                />
              ))}
            </div>
          </div>
        )}

        {guide?.cards && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold">{guide.cardsTitle}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {guide.cards.map((c) => (
                <InfoHoverCard
                  key={c.title}
                  title={c.title}
                  detail={c.body}
                  heightClass="min-h-[168px]"
                />
              ))}
            </div>
          </div>
        )}

        {kind === 'journals' && <GuestJournalComposer />}
      </div>
    </GuestLayout>
  );
}

const BLOG_STATUS_TEXT: Record<string, string> = {
  pending: 'Waiting for review',
  published: 'Live on the blog',
  rejected: 'Not published',
  hidden: 'Hidden',
};

function GuestJournalComposer() {
  const [bookingNumber, setBookingNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [mine, setMine] = useState<{ posts: any[]; canWrite?: boolean } | null>(null);

  const credentials = () => ({ bookingNumber: bookingNumber.trim().toUpperCase(), phone: phone.trim() });

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await api('/public/blog/submit', {
        method: 'POST',
        body: { ...credentials(), title: title.trim(), body: body.trim() },
      });
      setTitle('');
      setBody('');
      setMsg('Thank you. Your story has reached our team. We read every one before it goes on the blog, and we will email you when it is live.');
      toast.success('Journal story submitted');
      const statusRes = await api<{ posts: any[]; canWrite?: boolean }>('/public/blog/mine', {
        method: 'POST',
        body: credentials(),
      }).catch(() => null);
      if (statusRes) setMine(statusRes);
    } catch (reason: any) {
      setErr(reason.message || 'Could not submit post');
    } finally {
      setBusy(false);
    }
  }

  async function checkMyPosts() {
    setBusy(true);
    setErr('');
    try {
      const res = await api<{ posts: any[]; canWrite?: boolean }>('/public/blog/mine', {
        method: 'POST',
        body: credentials(),
      });
      setMine(res);
    } catch (reason: any) {
      setErr(reason.message || 'Could not check your posts');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card id="share">
      <CardHeader>
        <p className="text-xs font-medium uppercase tracking-wider text-accent">Stayed with us?</p>
        <CardTitle className="font-display flex items-center gap-2 text-3xl">
          <PenLine className="h-5 w-5 text-accent" />
          Share your story
        </CardTitle>
        <CardDescription>
          Tell other travellers what the stay was like: the view, the food, the evening on the sand. Anyone who has checked out can write using their booking number and phone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3 border-b border-border pb-4">
          <li>· Use the booking number and phone from your stay.</li>
          <li>· Your first name and initial are shown, never phone or email.</li>
          <li>· Please keep it to your own experience, without links.</li>
        </ul>

        <form onSubmit={submitPost} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Booking Number</Label>
              <Input required value={bookingNumber} onChange={(e) => setBookingNumber(e.target.value)} placeholder="OAS-..." />
            </div>
            <div className="space-y-1.5">
              <Label>Phone on the Booking</Label>
              <Input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03XX-XXXXXXX" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input required minLength={5} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sunrise over the frozen dune" />
          </div>
          <div className="space-y-1.5">
            <Label>Your Story ({body.length}/6000)</Label>
            <Textarea
              required
              minLength={100}
              maxLength={6000}
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="At least a few sentences about your stay…"
            />
          </div>
          {err && <Alert severity="error">{err}</Alert>}
          {msg && <Alert severity="success">{msg}</Alert>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="accent" disabled={busy}>
              {busy ? 'Sending…' : 'Send my story'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !bookingNumber.trim() || !phone.trim()}
              onClick={checkMyPosts}
            >
              <Search className="h-4 w-4" />
              Check my posts
            </Button>
          </div>
        </form>

        {mine && (
          <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm space-y-2">
            {mine.posts.length === 0 ? (
              <p className="text-muted-foreground">No posts from this stay yet.</p>
            ) : (
              <ul className="space-y-2">
                {mine.posts.map((post, idx) => (
                  <li key={idx} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {post.slug ? (
                        <Link to={`/blog/${post.slug}`} className="text-accent underline">
                          {post.title}
                        </Link>
                      ) : (
                        post.title
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {BLOG_STATUS_TEXT[post.status] || post.status}
                      {post.rejectReason ? `: ${post.rejectReason}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {mine.canWrite === false && (
              <p className="text-xs text-muted-foreground">You can write once your stay is complete.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DetailPage({ kind }: { kind: keyof typeof KIND_MAP }) {
  const { slug } = useParams();
  const { pathname } = useLocation();
  const meta = KIND_MAP[kind];
  const [item, setItem] = useState<EditorialItem | null>(
    () => meta.items.find((i) => i.slug === slug) || null,
  );

  useEffect(() => {
    if (!item) return;
    applyDocumentSeo(pathname, {
      title: `${item.title} — Oasis Resort Skardu`,
      description: item.summary,
      image: item.image || undefined,
      imageAlt: item.title,
      type: 'article',
    });
  }, [item, pathname]);

  useEffect(() => {
    const localHit = meta.items.find((i) => i.slug === slug);
    if (localHit) {
      setItem(localHit);
      return;
    }
    if (kind === 'experiences' && slug) {
      api<{ experiences: EditorialItem[] }>('/public/site')
        .then((site) => {
          const hit = (site.experiences || []).find((e) => e.slug === slug);
          setItem(hit ? { ...hit, image: media(hit.image) } : null);
        })
        .catch(() => setItem(null));
    } else if (kind === 'journals' && slug) {
      api<any>(`/public/blog/${slug}`)
        .then((p) =>
          setItem({
            slug: p.slug,
            title: p.title,
            kicker: p.source === 'guest' ? `Guest story · ${p.authorName}` : 'From the team',
            image: media(p.image) || photos.wide,
            summary: p.excerpt,
            body: p.body,
          }),
        )
        .catch(() => setItem(null));
    } else {
      setItem(null);
    }
  }, [kind, slug, meta.items]);

  if (!item) {
    return (
      <GuestLayout>
        <div className="mx-auto max-w-3xl px-4 py-16 space-y-4">
          <h1 className="font-display text-4xl font-semibold">Story not found</h1>
          <Button asChild variant="outline">
            <Link to={meta.basePath}>Back to {meta.title}</Link>
          </Button>
        </div>
      </GuestLayout>
    );
  }

  return (
    <GuestLayout>
      <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 space-y-6">
        <Link to={meta.basePath} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to {meta.title}
        </Link>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">{item.kicker}</p>
          <h1 className="font-display mt-2 text-4xl font-semibold sm:text-5xl">{item.title}</h1>
        </div>
        {item.image && (
          <div className="overflow-hidden rounded-xl border border-border">
            <ResilientImage src={item.image} alt={item.title} className="max-h-[460px] w-full object-cover" />
          </div>
        )}
        <div className="space-y-4 text-base leading-relaxed text-muted-foreground whitespace-pre-line">
          {item.body}
        </div>
        {item.book && (
          <div className="pt-4">
            <Button asChild variant="accent" size="lg">
              <Link to={`/book?offer=${encodeURIComponent(item.title)}`}>Reserve with this offer</Link>
            </Button>
          </div>
        )}
      </article>
    </GuestLayout>
  );
}

export function AboutPage() {
  return (
    <GuestLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-wider text-accent">The house</p>
          <h1 className="font-display mt-2 text-4xl font-semibold sm:text-5xl">Glass on the sand. Wood inside.</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Nineteen rooms on about 165 kanals at the edge of Katpana, fifteen minutes from Skardu airport. Breakfast is included.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {collections.map((c) => (
            <ShowcaseHoverCard
              key={c.slug}
              image={c.image}
              alt={c.title}
              kicker={c.kicker}
              title={c.title}
              description={c.summary}
              heightClass="h-72"
              actions={
                <Link to={c.to} className="text-xs font-semibold text-amber-300 hover:underline">
                  Explore →
                </Link>
              }
            />
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Grounds', '~165 kanals', 'Facing Katpana desert'],
            ['Rooms', '19 Huts', 'Held in our own book'],
            ['Airport', '15 min', 'Car free from 3 nights'],
            ['Kitchen', 'One house', 'Breakfast always included'],
          ].map(([label, title, detail]) => (
            <InfoHoverCard
              key={label}
              label={label}
              title={title}
              detail={detail}
              heightClass="min-h-[144px]"
              revolveBorder
            />
          ))}
        </div>
      </div>
    </GuestLayout>
  );
}

export function WellnessPage() {
  return (
    <GuestLayout>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 space-y-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">Warmth & Sleep</p>
          <h1 className="font-display mt-2 text-4xl font-semibold sm:text-5xl">The desert, and a warm room at the end of it.</h1>
          <p className="mt-2 text-base text-muted-foreground">Quiet huts facing the dune rather than a road.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {wellness.map((w) => (
            <InfoHoverCard
              key={w.title}
              title={w.title}
              detail={w.body}
              heightClass="min-h-[176px]"
            />
          ))}
        </div>
      </div>
    </GuestLayout>
  );
}

interface CircleMember {
  name: string;
  email: string;
  phone: string;
  number: string;
}

export function CirclePage() {
  const [member, setMember] = useState<CircleMember | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('oasis_circle') || 'null');
    } catch {
      return null;
    }
  });
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.includes('@')) {
      setError('Enter your name and email address.');
      return;
    }
    setError('');
    setBusy(true);
    const next: CircleMember = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      number: `OC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    };
    try {
      localStorage.setItem('oasis_circle', JSON.stringify(next));
    } catch {
      /* ignore */
    }
    await api('/public/enquiries', {
      method: 'POST',
      body: {
        topic: 'Courtyard Circle',
        name: next.name,
        email: next.email,
        phone: next.phone,
        message: 'Please add this guest to the Courtyard Circle.',
      },
    }).catch(() => {});
    setMember(next);
    setBusy(false);
    toast.success('Joined Oasis Circle on this browser');
  }

  function leaveCircle() {
    try {
      localStorage.removeItem('oasis_circle');
    } catch {
      /* ignore */
    }
    setMember(null);
    toast.success('Removed Circle membership from this browser');
  }

  return (
    <GuestLayout>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 space-y-10">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-wider text-accent">Courtyard Circle</p>
          <h1 className="font-display mt-2 text-4xl font-semibold sm:text-5xl">The house keeps your name.</h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            This is not a points club and it is not a credit card. Members are recognised at the desk, offered the same public rate as everyone else, and asked which room they liked last time.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-display text-2xl font-semibold">Recognition, not a discount ladder</h2>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>· Your stay history is on the desk screen when you return.</li>
                <li>· A birthday or anniversary note, if you tell us the date.</li>
                <li>· The best public rate. Logging in does not unlock a cheaper hidden price.</li>
                <li>· A request for late checkout, confirmed only if the room is free.</li>
              </ul>
            </CardContent>
          </Card>

          {member ? (
            <Card className="bg-primary text-primary-foreground border-primary">
              <CardContent className="p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest opacity-70">Circle Member</p>
                  <BadgeCheck className="h-5 w-5 text-accent" />
                </div>
                <p className="font-display text-4xl font-semibold">{member.name}</p>
                <p className="font-mono text-sm text-accent">{member.number}</p>
                <p className="text-sm opacity-80">{member.email}{member.phone ? ` · ${member.phone}` : ''}</p>
                <Button type="button" variant="outline" size="sm" className="border-white/25 text-white hover:bg-white/10" onClick={leaveCircle}>
                  Leave the circle on this browser
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-2xl">Join Oasis Circle</CardTitle>
                <CardDescription>Free to join. Saved on this browser and noted for the front desk.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={join} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  {error && <Alert severity="error">{error}</Alert>}
                  <Button type="submit" variant="accent" disabled={busy}>
                    {busy ? 'Joining…' : 'Join Circle'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </GuestLayout>
  );
}

export function TopicEnquiryPage({
  topic,
  title,
  desc,
  prompt,
}: {
  topic: string;
  title: string;
  desc: string;
  prompt?: string;
}) {
  return (
    <GuestLayout>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">{topic}</p>
          <h1 className="font-display mt-2 text-4xl font-semibold sm:text-5xl">{title}</h1>
          <p className="mt-2 text-base text-muted-foreground leading-relaxed">{desc}</p>
        </div>
        <EnquiryForm topic={topic} title={`Write to the desk`} prompt={prompt} />
      </div>
    </GuestLayout>
  );
}

export function PlainPolicyPage({ slug }: { slug: string }) {
  const doc = policies[slug];
  if (!doc) {
    return (
      <GuestLayout>
        <div className="mx-auto max-w-3xl px-4 py-16 space-y-4">
          <p className="text-xs font-medium uppercase tracking-wider text-accent">The house</p>
          <h1 className="font-display text-4xl font-semibold">That page is not here</h1>
          <p className="text-sm text-muted-foreground">Use the sitemap if you were looking for a policy.</p>
          <Button asChild variant="outline">
            <Link to="/sitemap">Open Sitemap</Link>
          </Button>
        </div>
      </GuestLayout>
    );
  }

  return (
    <GuestLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 space-y-6">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">Resort Policy</p>
        <h1 className="font-display text-4xl font-semibold">{doc.title}</h1>
        <Card>
          <CardContent className="p-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
            {doc.body.map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}
          </CardContent>
        </Card>
      </div>
    </GuestLayout>
  );
}

export function SitemapPage() {
  const links = [
    ['/', 'Home'],
    ['/stay', 'Stay & Huts'],
    ['/book', 'Book a Stay'],
    ['/booking', 'Find a Booking'],
    ['/login', 'Guest Stay Portal'],
    ['/order', 'Order Food'],
    ['/around', 'Around Skardu'],
    ['/experiences', 'Experiences'],
    ['/offers', 'Offers'],
    ['/dining', 'Dining'],
    ['/gallery', 'Gallery'],
    ['/activities', 'Activities'],
    ['/facilities', 'Facilities'],
    ['/events', 'Events'],
    ['/circle', 'Oasis Circle'],
    ['/blog', 'Journal'],
    ['/about', 'The Resort'],
    ['/wellness', 'Warmth & Wellness'],
    ['/directions', 'Directions & Map'],
    ['/virtual-tour', 'Virtual Tour'],
    ['/reviews', 'Guest Reviews'],
    ['/faq', 'FAQ'],
    ['/visit', 'Visit & Policies'],
    ['/contact', 'Contact Desk'],
    ['/careers', 'Work With Us'],
    ['/press', 'Press'],
    ['/partners', 'Partners'],
    ['/legal/terms', 'Terms of Stay'],
    ['/legal/privacy', 'Privacy'],
    ['/legal/cookies', 'Cookies'],
    ['/legal/access', 'Accessibility'],
    ['/legal/cancellation', 'Cancellation Policy'],
    ['/legal/refund', 'Refund Policy'],
    ['/legal/best-rate', 'Best Rate Guarantee'],
    ['/admin', 'Staff & Admin Portal'],
  ];

  return (
    <GuestLayout>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">Index</p>
          <h1 className="font-display mt-1 text-4xl font-semibold">Everything on this site.</h1>
          <p className="mt-2 text-sm text-muted-foreground">One hotel. These are all the pages.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {links.map(([to, label]) => (
            <Link key={to} to={to} className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium hover:border-accent">
              {label}
            </Link>
          ))}
        </div>
      </div>
    </GuestLayout>
  );
}
