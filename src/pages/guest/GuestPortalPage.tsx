import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '@mui/material';
import { LogOut, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { GuestLayout } from '@/src/components/guest/GuestLayout';
import { FacilityShowcase } from '@/src/components/guest/FacilitySection';
import { LoyaltyPanel } from '@/src/components/guest/LoyaltyPanel';
import { PaymentAccounts, PaymentProofForm } from '@/src/components/guest/PaymentSection';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { api, getSavedBookings, pkr, pretty } from '@/src/lib/api';

const LOGIN_KEY = 'oasis_guest_login';
const STAY_LABEL: Record<string, string> = {
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

function readCreds() {
  try {
    return JSON.parse(sessionStorage.getItem(LOGIN_KEY) || 'null');
  } catch {
    return null;
  }
}

export function GuestPortalPage() {
  const [creds, setCreds] = useState<{ bookingNumber: string; phone: string } | null>(readCreds);
  const [booking, setBooking] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [formNum, setFormNum] = useState('');
  const [formPhone, setFormPhone] = useState('');

  const loadBooking = useCallback(async (c: { bookingNumber: string; phone: string }) => {
    setBusy(true);
    setError('');
    try {
      const payload = { bookingNumber: c.bookingNumber.trim().toUpperCase(), phone: c.phone.trim() };
      const res = await api('/public/reservations/lookup', { method: 'POST', body: payload });
      setBooking(res);
      setCreds(payload);
      sessionStorage.setItem(LOGIN_KEY, JSON.stringify(payload));
    } catch (err: any) {
      setBooking(null);
      setCreds(null);
      sessionStorage.removeItem(LOGIN_KEY);
      setError(err.message || 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (creds && !booking) loadBooking(creds);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function logout() {
    sessionStorage.removeItem(LOGIN_KEY);
    setCreds(null);
    setBooking(null);
  }

  const saved = getSavedBookings();

  return (
    <GuestLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {!booking ? (
          <div className="mx-auto max-w-lg space-y-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-accent">Guest Portal</p>
              <h1 className="font-display mt-1 text-4xl font-semibold">Welcome back</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in with your booking number and phone to manage your stay, order dining, or check your room folio.
              </p>
            </div>

            <Card>
              <CardContent className="p-6">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    loadBooking({ bookingNumber: formNum, phone: formPhone });
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <Label>Booking Number</Label>
                    <Input required value={formNum} onChange={(e) => setFormNum(e.target.value)} placeholder="OAS-..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone on Reservation</Label>
                    <Input required type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="03XX-XXXXXXX" />
                  </div>
                  {error && <Alert severity="error">{error}</Alert>}
                  <Button type="submit" variant="accent" className="w-full" disabled={busy}>
                    {busy ? 'Checking…' : 'Access My Stay'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {saved.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Saved Bookings</CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  {saved.map((item) => (
                    <button
                      key={item.bookingNumber}
                      type="button"
                      onClick={() => {
                        setFormNum(item.bookingNumber);
                        setFormPhone(item.phone);
                      }}
                      className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:text-accent cursor-pointer"
                    >
                      <span className="font-mono font-medium">{item.bookingNumber}</span>
                      <span className="text-muted-foreground">{item.guestName}</span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="font-mono text-xs font-medium text-accent">{booking.bookingNumber}</p>
                  {booking.loyalty && (
                    <span className="rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-accent">
                      {booking.loyalty.availablePoints.toLocaleString()} pts · {booking.loyalty.tier.name}
                    </span>
                  )}
                </div>
                <h1 className="font-display mt-1 text-4xl font-semibold">Hello, {booking.guestName}</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                {booking.status === 'checked_in' && (
                  <Button asChild variant="accent" size="sm">
                    <Link to="/order">
                      <UtensilsCrossed className="h-4 w-4" />
                      Order Dining
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" disabled={busy} onClick={() => creds && loadBooking(creds)}>
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
                <Button variant="ghost" size="sm" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardDescription>Stay Status</CardDescription>
                  <CardTitle className="font-display text-3xl">{STAY_LABEL[booking.status] || booking.status}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned Rooms</p>
                    <p className="mt-1 font-medium">{(booking.rooms || []).map((r: any) => `${r.type} · Room ${r.roomNo}`).join(', ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Dates</p>
                    <p className="mt-1 font-medium">{pretty(booking.checkIn)} — {pretty(booking.checkOut)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardDescription>Room Folio</CardDescription>
                  <CardTitle className="font-mono text-3xl tabular-nums">{pkr(booking.balance)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Room Stay</span>
                    <span className="font-mono tabular-nums text-foreground">{pkr(booking.totalAmount)}</span>
                  </div>
                  {booking.extras > 0 && (
                    <div className="flex justify-between">
                      <span>Restaurant & Extras</span>
                      <span className="font-mono tabular-nums text-foreground">{pkr(booking.extras)}</span>
                    </div>
                  )}
                  {booking.extras < 0 && (
                    <div className="flex justify-between">
                      <span>Loyalty & Folio Credits</span>
                      <span className="font-mono tabular-nums text-emerald-600">−{pkr(Math.abs(booking.extras))}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Paid</span>
                    <span className="font-mono tabular-nums text-emerald-600">{pkr(booking.paid)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {booking.loyalty && creds?.phone && (
              <LoyaltyPanel
                loyalty={booking.loyalty}
                bookingNumber={booking.bookingNumber}
                phone={creds.phone}
                onRedeemed={({ booking: updatedBooking, loyalty: updatedLoyalty }) =>
                  setBooking({ ...updatedBooking, loyalty: updatedLoyalty })
                }
              />
            )}

            {booking.balance > 0 && booking.status !== 'cancelled' && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-2xl">Settle Folio by Transfer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <PaymentAccounts amount={booking.balance} />
                  <PaymentProofForm
                    defaultAmount={booking.balance}
                    submit={(f) =>
                      api('/public/payments/claim', {
                        method: 'POST',
                        body: { ...f, bookingNumber: booking.bookingNumber, phone: creds?.phone || f.phone },
                      })
                    }
                  />
                </CardContent>
              </Card>
            )}

            <div>
              <h2 className="font-display mb-4 text-3xl font-semibold">Included Resort Facilities</h2>
              <FacilityShowcase compact />
            </div>
          </div>
        )}
      </div>
    </GuestLayout>
  );
}
