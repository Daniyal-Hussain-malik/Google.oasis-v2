import React, { useState } from 'react';
import { Alert } from '@mui/material';
import { BookmarkCheck, KeyRound, Mail, MessageCircle, ShieldCheck, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { api, getSavedBookings } from '@/src/lib/api';

export type OtpChannel = 'whatsapp' | 'email' | 'sms';

const CHANNELS: Array<{ id: OtpChannel; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'SMS', icon: Smartphone },
];

export function GuestOtpGate({
  onVerified,
  ctaLabel = 'Continue',
  showSavedShortcuts = true,
}: {
  onVerified: (reservation: any, context: { bookingNumber: string; phone: string }) => void;
  ctaLabel?: string;
  showSavedShortcuts?: boolean;
}) {
  const [bookingNumber, setBookingNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<OtpChannel>('whatsapp');

  const [step, setStep] = useState<'identify' | 'verify'>('identify');
  const [destinationMasked, setDestinationMasked] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const saved = showSavedShortcuts ? getSavedBookings() : [];

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api<{
        ok: boolean;
        channel: OtpChannel;
        destinationMasked: string;
        deliveryMode: string;
      }>('/public/guest/otp/request', {
        method: 'POST',
        body: {
          bookingNumber: bookingNumber.trim().toUpperCase(),
          phone: phone.trim(),
          channel,
        },
      });
      setDestinationMasked(res.destinationMasked);
      setDeliveryMode(res.deliveryMode);
      setStep('verify');
      setCode('');
      toast.success(`6-digit verification code sent via ${channel.toUpperCase()}`);
    } catch (err: any) {
      setError(err.message || 'Could not send verification code');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const cleanNum = bookingNumber.trim().toUpperCase();
      const cleanPhone = phone.trim();
      const res = await api<{ ok: boolean; reservation: any }>('/public/guest/otp/verify', {
        method: 'POST',
        body: {
          bookingNumber: cleanNum,
          phone: cleanPhone,
          code: code.trim(),
        },
      });
      toast.success('Booking verified');
      onVerified(res.reservation, { bookingNumber: cleanNum, phone: cleanPhone });
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'verify') {
    return (
      <form onSubmit={verifyCode} className="space-y-4">
        <div className="rounded-lg border border-accent/30 bg-accent/10 p-3.5 text-xs text-foreground">
          <div className="flex items-center gap-2 font-semibold text-accent">
            <ShieldCheck className="h-4 w-4" />
            Verification Code Sent ({channel.toUpperCase()})
          </div>
          <p className="mt-1 text-muted-foreground">
            Enter the 6-digit code sent to <span className="font-mono font-medium text-foreground">{destinationMasked}</span> for booking{' '}
            <span className="font-mono font-medium text-foreground">{bookingNumber.trim().toUpperCase()}</span>.
          </p>
          {deliveryMode === 'dry_run' && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Preview note: Live messaging is in dry-run mode — check server console or Admin WhatsApp logs for the generated test OTP.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="guest-otp-code">6-Digit Verification Code</Label>
          <Input
            id="guest-otp-code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            className="font-mono text-center text-lg tracking-[0.4em]"
          />
        </div>

        {error && <Alert severity="error">{error}</Alert>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setStep('identify');
                setError('');
                setCode('');
              }}
            >
              Change details
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => requestCode()}>
              Resend code
            </Button>
          </div>
          <Button type="submit" variant="accent" disabled={busy || code.length !== 6}>
            <KeyRound className="h-4 w-4" />
            {busy ? 'Verifying…' : ctaLabel}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <form onSubmit={requestCode} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
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
            <Label>Phone on Reservation</Label>
            <Input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03XX-XXXXXXX"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Send One-Time Passcode (OTP) Via</Label>
          <div className="grid grid-cols-3 gap-2">
            {CHANNELS.map((ch) => {
              const Icon = ch.icon;
              const active = channel === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setChannel(ch.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {ch.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && <Alert severity="error">{error}</Alert>}

        <Button type="submit" variant="accent" className="w-full" disabled={busy}>
          <ShieldCheck className="h-4 w-4" />
          {busy ? 'Sending Verification Code…' : 'Send Verification Code'}
        </Button>
      </form>

      {saved.length > 0 && (
        <div className="border-t border-border pt-4">
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
                }}
              >
                <span className="font-mono">{item.bookingNumber}</span>
                <span className="text-muted-foreground">· {item.guestName}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
