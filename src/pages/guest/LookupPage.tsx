import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Rating } from '@mui/material';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { GuestLayout } from '@/src/components/guest/GuestLayout';
import { GuestOtpGate } from '@/src/components/guest/GuestOtpGate';
import { PaymentAccounts, PaymentProofForm } from '@/src/components/guest/PaymentSection';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Label } from '@/src/components/ui/label';
import { Separator } from '@/src/components/ui/separator';
import { Textarea } from '@/src/components/ui/textarea';
import { api, pkr, pretty } from '@/src/lib/api';

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

export function LookupPage() {
  const [booking, setBooking] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const [rating, setRating] = useState<number | null>(5);
  const [comment, setComment] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    api<{ authenticated: boolean; reservation?: any }>('/public/guest/session')
      .then((res) => {
        if (res.authenticated && res.reservation) setBooking(res.reservation);
      })
      .catch(() => {});
  }, []);

  async function signOutGuest() {
    await api('/public/guest/logout', { method: 'POST' }).catch(() => {});
    setBooking(null);
    setFeedbackSent(false);
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
            Verify your booking with a one-time passcode via WhatsApp, Email, or SMS to view your folio, send payment proof, or review your stay.
          </p>
        </div>

        {!booking ? (
          <Card>
            <CardContent className="p-6">
              <GuestOtpGate
                ctaLabel="Verify & Open Booking"
                onVerified={(res) => {
                  setBooking(res);
                  setFeedbackSent(false);
                }}
              />
            </CardContent>
          </Card>
        ) : (
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
                  <div className="flex flex-wrap gap-2">
                    {booking.status === 'checked_in' && (
                      <Button asChild variant="accent" size="sm">
                        <Link to="/order">Order Food to Room</Link>
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={signOutGuest}>
                      <LogOut className="h-3.5 w-3.5" />
                      Switch Booking
                    </Button>
                  </div>
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
                        allowReceiptUpload
                        submit={(f) =>
                          api('/public/payments/claim', {
                            method: 'POST',
                            body: { ...f, bookingNumber: booking.bookingNumber },
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
