import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bookmark, BookmarkCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { GuestLayout } from '@/src/components/guest/GuestLayout';
import { PaymentAccounts, PaymentProofForm } from '@/src/components/guest/PaymentSection';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Separator } from '@/src/components/ui/separator';
import { api, isBookingSaved, pkr, pretty, saveBookingLocal } from '@/src/lib/api';

function readStoredBooking() {
  try {
    return JSON.parse(sessionStorage.getItem('oasis_booking') || 'null');
  } catch {
    return null;
  }
}

export function ConfirmationPage() {
  const location = useLocation();
  const booking = (location.state as any) || readStoredBooking();
  const [saved, setSaved] = useState(() => (booking ? isBookingSaved(booking.bookingNumber) : false));

  if (!booking) {
    return (
      <GuestLayout>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="font-display text-4xl font-semibold">Find your booking</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your booking number and phone to open your reservation details.
          </p>
          <Button asChild variant="accent" className="mt-6">
            <Link to="/booking">Go to Booking Lookup</Link>
          </Button>
        </div>
      </GuestLayout>
    );
  }

  const balance = booking.balance ?? booking.totalAmount - (booking.paid || 0);

  return (
    <GuestLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Card>
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-accent">Booking Reference</p>
              <p className="mt-1 select-all font-mono text-4xl font-semibold tracking-wider tabular-nums text-foreground sm:text-5xl">
                {booking.bookingNumber}
              </p>
            </div>
            <div className="flex justify-center">
              <Button
                type="button"
                variant={saved ? 'secondary' : 'outline'}
                size="sm"
                disabled={saved}
                onClick={() => {
                  const ok = saveBookingLocal(booking, booking.phone);
                  if (ok) {
                    setSaved(true);
                    toast.success('Booking shortcut saved to this browser');
                  } else {
                    toast.error('Browser storage blocked. Please write down your booking number.');
                  }
                }}
              >
                {saved ? <BookmarkCheck className="h-4 w-4 text-emerald-600" /> : <Bookmark className="h-4 w-4" />}
                {saved ? 'Saved on this device' : 'Save booking shortcut'}
              </Button>
            </div>
            <CardTitle className="font-display text-3xl pt-2">Your hut is reserved</CardTitle>
            <p className="text-sm text-muted-foreground">
              Keep your booking number and phone number handy to check in, order food, or submit payment proof.
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            <Separator />
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Guest</dt>
                <dd className="mt-0.5 font-medium text-foreground">{booking.guestName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Assigned Hut</dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {(booking.rooms || []).map((r: any) => `${r.type} · Room ${r.roomNo}`).join(', ')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Check-in</dt>
                <dd className="mt-0.5 font-medium text-foreground">{pretty(booking.checkIn)} (from 2:00 PM)</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Check-out</dt>
                <dd className="mt-0.5 font-medium text-foreground">{pretty(booking.checkOut)} (by 12:00 PM)</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Total Stay</dt>
                <dd className="mt-0.5 font-mono font-semibold tabular-nums">{pkr(booking.totalAmount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Balance Remaining</dt>
                <dd className="mt-0.5 font-mono font-semibold tabular-nums text-accent">{pkr(balance)}</dd>
              </div>
            </dl>

            {balance > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h2 className="font-display text-2xl font-semibold">Pay by Easypaisa or Bank Transfer</h2>
                  <p className="text-sm text-muted-foreground">
                    You may settle at the desk on arrival or transfer now and submit your Transaction ID below.
                  </p>
                  <PaymentAccounts amount={balance} />
                  <PaymentProofForm
                    needPhone={!booking.phone}
                    defaultAmount={balance}
                    submit={(f) =>
                      api('/public/payments/claim', {
                        method: 'POST',
                        body: { ...f, bookingNumber: booking.bookingNumber, phone: f.phone || booking.phone },
                      })
                    }
                  />
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="outline">
                <Link to="/booking">Manage Booking</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/">Return Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </GuestLayout>
  );
}
