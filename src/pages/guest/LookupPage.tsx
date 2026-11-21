import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Rating } from '@mui/material';
import { BookmarkCheck, Search } from 'lucide-react';
import { toast } from 'sonner';
import { GuestLayout } from '@/src/components/guest/GuestLayout';
import { PaymentAccounts, PaymentProofForm } from '@/src/components/guest/PaymentSection';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import { Separator } from '@/src/components/ui/separator';
import { api, getSavedBookings, pkr, pretty } from '@/src/lib/api';

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

export function LookupPage() {
  const [bookingNumber, setBookingNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [booking, setBooking] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [rating, setRating] = useState<number | null>(5);
  const [comment, setComment] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const saved = getSavedBookings();

  async function findBooking(num: string, ph: string) {
    setBusy(true);
    setError('');
    try {
      const res = await api<any>('/public/reservations/lookup', {
        method: 'POST',
        body: { bookingNumber: num.trim().toUpperCase(), phone: ph.trim() },
      });
      setBooking(res);
      setFeedbackSent(false);
    } catch (err: any) {
      setBooking(null);
      setError(err.message || 'Reservation not found');
    } finally {
      setBusy(false);
    }
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    await findBooking(bookingNumber, phone);
  }

  async function handleFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!booking || !rating) return;
    setBusy(true);
    try {
      await api('/public/feedback', {
        method: 'POST',
        body: {
          bookingNumber: booking.bookingNumber,
          phone,
          rating,
          comment: comment.trim(),
        },
      });
      setFeedbackSent(true);
      toast.success('Thank you for reviewing your stay');
    } catch (err: any) {
      toast.error(err.message || 'Could not save review');
    } finally {
      setBusy(false);
    }
  }

  return (
    <GuestLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-accent">Reservation Desk</p>
          <h1 className="font-display mt-1 text-4xl font-semibold sm:text-5xl">Find a booking</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your booking number and the phone number on your reservation to inspect your folio, send payment proof, or review your stay.
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleLookup} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label>Booking Number</Label>
                <Input
                  required
                  value={bookingNumber}
                  onChange={(e) => setBookingNumber(e.target.value)}
                  placeholder="e.g. OAS-..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number</Label>
                <Input
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="03XX-XXXXXXX"
                />
              </div>
              <Button type="submit" variant="accent" disabled={busy}>
                <Search className="h-4 w-4" />
                {busy ? 'Searching…' : 'Find'}
              </Button>
            </form>

            {saved.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <BookmarkCheck className="h-3.5 w-3.5 text-accent" />
                  Saved on this browser
                </p>
                <div className="flex flex-wrap gap-2">
                  {saved.map((item) => (
                    <Button
                      key={item.bookingNumber}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBookingNumber(item.bookingNumber);
                        setPhone(item.phone);
                        if (item.phone) findBooking(item.bookingNumber, item.phone);
                      }}
                    >
                      <span className="font-mono">{item.bookingNumber}</span>
                      <span className="text-muted-foreground">· {item.guestName}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <Alert severity="error" className="mt-6">
            {error}
          </Alert>
        )}

        {booking && (
          <div className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs text-accent">{booking.bookingNumber}</p>
                    <CardTitle className="font-display mt-1 text-3xl">{booking.guestName}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Status: <span className="font-semibold text-foreground">{STATUS_LABELS[booking.status] || booking.status}</span>
                    </p>
                  </div>
                  {booking.status === 'checked_in' && (
                    <Button asChild variant="accent" size="sm">
                      <Link to="/order">Order Food to Room</Link>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Rooms</dt>
                    <dd className="mt-0.5 font-medium">
                      {(booking.rooms || []).map((r: any) => `${r.type} · Room ${r.roomNo}`).join(', ')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Stay Dates</dt>
                    <dd className="mt-0.5 font-medium">
                      {pretty(booking.checkIn)} — {pretty(booking.checkOut)} ({booking.nights} nights)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Room Charges</dt>
                    <dd className="mt-0.5 font-mono font-medium tabular-nums">{pkr(booking.totalAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Dining & Folio Extras</dt>
                    <dd className="mt-0.5 font-mono font-medium tabular-nums">{pkr(booking.extras || 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Paid So Far</dt>
                    <dd className="mt-0.5 font-mono font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                      {pkr(booking.paid)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Remaining Balance</dt>
                    <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-accent">
                      {pkr(booking.balance)}
                    </dd>
                  </div>
                </dl>

                {booking.balance > 0 && booking.status !== 'cancelled' && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h2 className="font-display text-2xl font-semibold">Settle Balance by Transfer</h2>
                      <PaymentAccounts amount={booking.balance} />
                      <PaymentProofForm
                        defaultAmount={booking.balance}
                        submit={(f) =>
                          api('/public/payments/claim', {
                            method: 'POST',
                            body: { ...f, bookingNumber: booking.bookingNumber, phone: phone || f.phone },
                          })
                        }
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {booking.status === 'checked_out' && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-2xl">Rate Your Stay</CardTitle>
                  <CardDescription>Share feedback directly with the Oasis management team.</CardDescription>
                </CardHeader>
                <CardContent>
                  {feedbackSent ? (
                    <Alert severity="success">Thank you for your review! Your feedback has been recorded.</Alert>
                  ) : (
                    <form onSubmit={handleFeedback} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label>Overall Rating</Label>
                        <div>
                          <Rating
                            value={rating}
                            size="large"
                            onChange={(_e, val) => setRating(val)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Comments</Label>
                        <Textarea
                          rows={3}
                          maxLength={2000}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="How were the room warmth, view, and kitchen?"
                        />
                      </div>
                      <Button type="submit" variant="accent" disabled={busy || !rating}>
                        Submit Review
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </GuestLayout>
  );
}
