import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Stepper, Step, StepLabel, Alert, CircularProgress } from '@mui/material';
import { Check, ArrowLeft, ArrowRight, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { GuestLayout } from '@/src/components/guest/GuestLayout';
import { PaymentAccounts } from '@/src/components/guest/PaymentSection';
import { ResilientImage } from '@/src/components/guest/ResilientImage';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import { Separator } from '@/src/components/ui/separator';
import { addDays, api, clamp, nights, pkr, pretty, todayISO, track } from '@/src/lib/api';
import { presentStay } from '@/src/data/resortContent';

export function BookPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const initialIn = params.get('checkIn') || todayISO();
  const initialOut = params.get('checkOut') && params.get('checkOut')! > initialIn ? params.get('checkOut')! : addDays(initialIn, 2);

  const [step, setStep] = useState(0);
  const [businessDate, setBusinessDate] = useState(todayISO());
  const [maxRooms, setMaxRooms] = useState(4);
  const [stay, setStay] = useState({
    checkIn: initialIn,
    checkOut: initialOut,
    adults: clamp(params.get('adults') || 2, 1, 16),
    children: clamp(params.get('children') || 0, 0, 12),
    rooms: clamp(params.get('rooms') || 1, 1, 10),
  });
  const [offer] = useState(params.get('offer') || '');
  const [results, setResults] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [selectedId, setSelectedId] = useState<number | string | null>(params.get('type'));
  const [guest, setGuest] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    specialRequests: offer ? `Offer: ${offer}` : '',
  });
  const [paymentMode, setPaymentMode] = useState<'hotel' | 'transfer'>('hotel');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    track({ type: 'book_open', path: '/book' });
    api<{ businessDate?: string; maxRoomsPerBooking?: number }>('/public/hotel')
      .then((res) => {
        if (res.businessDate) setBusinessDate(res.businessDate);
        if (res.maxRoomsPerBooking) {
          const cap = Math.max(1, Number(res.maxRoomsPerBooking));
          setMaxRooms(cap);
          setStay((p) => ({ ...p, rooms: clamp(p.rooms, 1, cap) }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingRooms(true);
    setError('');
    const q = new URLSearchParams({
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      adults: String(stay.adults),
      children: String(stay.children),
      rooms: String(stay.rooms),
    });
    api<{ results: any[] }>(`/public/availability?${q.toString()}`)
      .then((res) => {
        if (!active) return;
        const rows = res.results || [];
        setResults(rows);
        const match = rows.find((r) => String(r.roomType._id) === String(selectedId) && r.fits !== false && r.available >= stay.rooms);
        const firstOpen = rows.find((r) => r.fits !== false && r.available >= stay.rooms);
        if (match) setSelectedId(match.roomType._id);
        else if (firstOpen) setSelectedId(firstOpen.roomType._id);
        else setSelectedId(null);
      })
      .catch((err) => active && setError(err.message || 'Could not check availability'))
      .finally(() => active && setLoadingRooms(false));
    return () => {
      active = false;
    };
  }, [stay.checkIn, stay.checkOut, stay.adults, stay.children, stay.rooms]);

  const selected = results.find((r) => String(r.roomType._id) === String(selectedId)) || null;
  const nightCount = nights(stay.checkIn, stay.checkOut);
  const firstNightAmount = selected?.quote?.breakdown?.[0]?.rate || selected?.roomType?.baseRate || 0;

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError('');
    try {
      const booking = await api<any>('/public/reservations', {
        method: 'POST',
        body: {
          ...stay,
          roomTypeId: selected.roomType._id,
          firstName: guest.firstName.trim(),
          lastName: guest.lastName.trim(),
          phone: guest.phone.trim(),
          email: guest.email.trim(),
          specialRequests: guest.specialRequests.trim(),
        },
      });
      const payload = { ...booking, phone: guest.phone.trim() };
      try {
        sessionStorage.setItem('oasis_booking', JSON.stringify(payload));
      } catch {
        /* ignore */
      }
      toast.success(`Reservation ${booking.bookingNumber} confirmed`);
      navigate('/confirmed', { state: payload });
    } catch (err: any) {
      setError(err.message || 'Could not complete reservation');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <GuestLayout>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-accent">Direct Reservation</p>
            <h1 className="font-display mt-1 text-4xl font-semibold">Reserve your hut</h1>
          </div>
          <div className="w-full max-w-md">
            <Stepper activeStep={step} alternativeLabel>
              <Step><StepLabel>Select Dates & Hut</StepLabel></Step>
              <Step><StepLabel>Guest & Payment</StepLabel></Step>
              <Step><StepLabel>Confirmation</StepLabel></Step>
            </Stepper>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Left Main Column */}
          <div className="space-y-6">
            {step === 0 && (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calendar className="h-4 w-4 text-accent" />
                      Stay Dates & Party Size
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="space-y-1.5">
                      <Label>Check-in</Label>
                      <Input
                        type="date"
                        min={businessDate}
                        value={stay.checkIn}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          setStay((p) => ({
                            ...p,
                            checkIn: v,
                            checkOut: p.checkOut > v ? p.checkOut : addDays(v, 2),
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Check-out</Label>
                      <Input
                        type="date"
                        min={addDays(stay.checkIn, 1)}
                        value={stay.checkOut}
                        onChange={(e) => setStay((p) => ({ ...p, checkOut: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Adults</Label>
                      <Input
                        type="number"
                        min={1}
                        max={16}
                        value={stay.adults}
                        onChange={(e) => setStay((p) => ({ ...p, adults: clamp(e.target.value, 1, 16) }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Children</Label>
                      <Input
                        type="number"
                        min={0}
                        max={12}
                        value={stay.children}
                        onChange={(e) => setStay((p) => ({ ...p, children: clamp(e.target.value, 0, 12) }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Rooms (max {maxRooms})</Label>
                      <Input
                        type="number"
                        min={1}
                        max={maxRooms}
                        value={stay.rooms}
                        onChange={(e) => setStay((p) => ({ ...p, rooms: clamp(e.target.value, 1, maxRooms) }))}
                      />
                    </div>
                  </CardContent>
                </Card>

                {error && <Alert severity="error">{error}</Alert>}

                {loadingRooms ? (
                  <Card>
                    <CardContent className="flex items-center justify-center gap-3 p-12 text-sm text-muted-foreground">
                      <CircularProgress size={20} />
                      Checking room availability in Katpana ledger…
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {results.map((row) => {
                      const room = presentStay(row.roomType);
                      const isAvailable = row.fits !== false && row.available >= stay.rooms;
                      const isSelected = String(room._id) === String(selectedId);

                      return (
                        <Card
                          key={room._id}
                          className={`overflow-hidden transition-all ${
                            isSelected
                              ? 'border-accent ring-1 ring-accent'
                              : isAvailable
                                ? 'hover:border-accent/50'
                                : 'opacity-60'
                          }`}
                        >
                          <div className="grid sm:grid-cols-[220px_1fr]">
                            <div className="h-44 sm:h-full">
                              <ResilientImage src={room.image} alt={room.name} className="h-full w-full object-cover" />
                            </div>
                            <CardContent className="flex flex-col justify-between p-5">
                              <div>
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <h3 className="font-display text-2xl font-semibold">{room.name}</h3>
                                    <p className="text-xs text-muted-foreground">
                                      {[room.bed, room.size, `Max ${room.maxAdults} adults`].filter(Boolean).join(' · ')}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-mono text-xl font-semibold tabular-nums text-foreground">
                                      {row.quote ? pkr(row.quote.total) : pkr(room.baseRate)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {row.quote ? `for ${nightCount} nights` : 'per night'}
                                    </p>
                                  </div>
                                </div>
                                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{room.description}</p>
                              </div>

                              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                                <span className={`text-xs font-medium ${isAvailable ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>
                                  {isAvailable
                                    ? `${row.available} ${row.available === 1 ? 'hut' : 'huts'} available`
                                    : row.fits === false
                                      ? 'Exceeds room capacity — increase rooms'
                                      : 'Sold out for these dates'}
                                </span>
                                <Button
                                  type="button"
                                  disabled={!isAvailable}
                                  variant={isSelected ? 'accent' : 'outline'}
                                  size="sm"
                                  onClick={() => setSelectedId(room._id)}
                                >
                                  {isSelected ? (
                                    <>
                                      <Check className="h-4 w-4" /> Selected
                                    </>
                                  ) : (
                                    'Select Hut'
                                  )}
                                </Button>
                              </div>
                            </CardContent>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="accent"
                    size="lg"
                    disabled={!selected}
                    onClick={() => {
                      setStep(1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Continue to Guest Details
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-3xl">Guest Information & Payment Preference</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleConfirm} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>First Name</Label>
                        <Input
                          required
                          value={guest.firstName}
                          onChange={(e) => setGuest((p) => ({ ...p, firstName: e.target.value }))}
                          placeholder="Zainab"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Last Name</Label>
                        <Input
                          required
                          value={guest.lastName}
                          onChange={(e) => setGuest((p) => ({ ...p, lastName: e.target.value }))}
                          placeholder="Mansoor"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Mobile Phone</Label>
                        <Input
                          required
                          type="tel"
                          placeholder="03XX-XXXXXXX"
                          value={guest.phone}
                          onChange={(e) => setGuest((p) => ({ ...p, phone: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email Address</Label>
                        <Input
                          required
                          type="email"
                          placeholder="guest@example.com"
                          value={guest.email}
                          onChange={(e) => setGuest((p) => ({ ...p, email: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Notes for the Desk (Flight number, step-free room, heater timing)</Label>
                      <Textarea
                        rows={3}
                        maxLength={1000}
                        value={guest.specialRequests}
                        onChange={(e) => setGuest((p) => ({ ...p, specialRequests: e.target.value }))}
                        placeholder="Optional arrival notes or airport pickup request..."
                      />
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <Label>Settlement Method</Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMode('hotel')}
                          className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                            paymentMode === 'hotel'
                              ? 'border-accent bg-accent/10 text-foreground'
                              : 'border-border bg-card text-muted-foreground hover:border-foreground/30'
                          }`}
                        >
                          <p className="text-sm font-semibold text-foreground">Pay at the Resort Desk</p>
                          <p className="mt-1 text-xs">Settle in cash, card, or transfer at check-in.</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMode('transfer')}
                          className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                            paymentMode === 'transfer'
                              ? 'border-accent bg-accent/10 text-foreground'
                              : 'border-border bg-card text-muted-foreground hover:border-foreground/30'
                          }`}
                        >
                          <p className="text-sm font-semibold text-foreground">Easypaisa / Bank Transfer</p>
                          <p className="mt-1 text-xs">
                            Send first night ({pkr(firstNightAmount)}) & submit TID after booking.
                          </p>
                        </button>
                      </div>

                      {paymentMode === 'transfer' && (
                        <div className="pt-2">
                          <PaymentAccounts amount={firstNightAmount} />
                        </div>
                      )}
                    </div>

                    {error && <Alert severity="error">{error}</Alert>}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <Button type="button" variant="outline" onClick={() => setStep(0)}>
                        <ArrowLeft className="h-4 w-4" />
                        Back to Rooms
                      </Button>
                      <Button type="submit" variant="accent" size="lg" disabled={submitting}>
                        {submitting ? 'Confirming Reservation…' : 'Confirm Reservation'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sticky Summary Sidebar */}
          <aside className="h-fit lg:sticky lg:top-24">
            <Card className="bg-primary text-primary-foreground border-primary">
              <CardHeader className="pb-3">
                <p className="text-xs uppercase tracking-wider opacity-70">Your Stay Summary</p>
                <CardTitle className="font-display text-3xl font-semibold">
                  {selected?.roomType?.name || 'Select a hut'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-1 opacity-90">
                  <p>{pretty(stay.checkIn)} — {pretty(stay.checkOut)}</p>
                  <p className="text-xs opacity-80">
                    {nightCount} {nightCount === 1 ? 'night' : 'nights'} · {stay.adults} adults
                    {stay.children > 0 ? ` · ${stay.children} children` : ''} · {stay.rooms}{' '}
                    {stay.rooms === 1 ? 'room' : 'rooms'}
                  </p>
                </div>

                {selected?.quote?.breakdown?.length > 0 && (
                  <div className="space-y-1.5 border-t border-white/15 pt-3 text-xs">
                    {selected.quote.breakdown.slice(0, 4).map((b: any) => (
                      <div key={b.date} className="flex justify-between opacity-85">
                        <span>{pretty(b.date)}</span>
                        <span className="font-mono tabular-nums">{pkr(b.rate)}</span>
                      </div>
                    ))}
                    {selected.quote.breakdown.length > 4 && (
                      <p className="opacity-70">+ {selected.quote.breakdown.length - 4} more nights</p>
                    )}
                  </div>
                )}

                <div className="border-t border-white/15 pt-4">
                  <p className="text-xs opacity-75">Room Total</p>
                  <p className="font-mono text-3xl font-semibold tabular-nums">
                    {selected?.quote ? pkr(selected.quote.total) : '—'}
                  </p>
                  <p className="mt-1 text-xs opacity-70">Breakfast included · Free cancellation up to 48h</p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </GuestLayout>
  );
}
