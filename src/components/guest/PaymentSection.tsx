import React, { useEffect, useState } from 'react';
import { Copy, Check, Building2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@mui/material';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { api, pkr } from '@/src/lib/api';

interface PaymentInfo {
  instructions?: string;
  easypaisa?: { accountName: string; number: string } | null;
  bank?: {
    accountTitle: string;
    bankName: string;
    branchAddress: string;
    accountNumber: string;
    iban: string;
    swift: string;
  } | null;
}

export function useResortPayments() {
  const [payments, setPayments] = useState<PaymentInfo | null>(null);
  useEffect(() => {
    api<{ payments: PaymentInfo }>('/public/site')
      .then((res) => setPayments(res.payments || null))
      .catch(() => setPayments(null));
  }, []);
  return payments;
}

function CopyRow({ label, value, canCopy = false }: { label: string; value?: string; canCopy?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-sm font-medium tabular-nums text-foreground">{value}</p>
      </div>
      {canCopy && (
        <Button type="button" variant="ghost" size="sm" onClick={handleCopy} className="h-8 px-2.5 text-xs">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      )}
    </div>
  );
}

export function PaymentAccounts({ amount }: { amount?: number }) {
  const payments = useResortPayments();
  if (!payments) return null;

  const { easypaisa, bank, instructions } = payments;
  if (!easypaisa && !bank) {
    return (
      <Alert severity="info">
        Pay at the hotel front desk upon arrival by cash, card, bank transfer, or mobile wallet.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {amount && amount > 0 ? (
        <p className="text-sm text-muted-foreground">
          Transfer <span className="font-mono font-semibold tabular-nums text-foreground">{pkr(amount)}</span> to one of the official accounts below:
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {easypaisa && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="h-4 w-4 text-accent" />
                Easypaisa Wallet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <CopyRow label="Account Title" value={easypaisa.accountName} />
              <CopyRow label="Mobile Number" value={easypaisa.number} canCopy />
            </CardContent>
          </Card>
        )}

        {bank && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-accent" />
                {bank.bankName || 'Bank Transfer'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <CopyRow label="Account Title" value={bank.accountTitle} />
              <CopyRow label="Branch" value={bank.branchAddress} />
              <CopyRow label="Account Number" value={bank.accountNumber} canCopy />
              <CopyRow label="IBAN" value={bank.iban} canCopy />
              <CopyRow label="SWIFT Code" value={bank.swift} canCopy />
            </CardContent>
          </Card>
        )}
      </div>

      {instructions && <p className="text-xs leading-relaxed text-muted-foreground">{instructions}</p>}
    </div>
  );
}

export function PaymentProofForm({
  submit,
  defaultAmount = '',
  needPhone = false,
  onSent,
}: {
  submit: (payload: { method: string; amount: number; reference: string; senderName: string; phone: string }) => Promise<unknown>;
  defaultAmount?: number | string;
  needPhone?: boolean;
  onSent?: () => void;
}) {
  const payments = useResortPayments();
  const [method, setMethod] = useState('easypaisa');
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : '');
  const [reference, setReference] = useState('');
  const [senderName, setSenderName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const methods = [
    payments?.easypaisa ? ['easypaisa', 'Easypaisa'] : null,
    payments?.bank ? ['bank_transfer', 'Bank Transfer'] : null,
  ].filter(Boolean) as Array<[string, string]>;

  useEffect(() => {
    if (methods.length && !methods.some(([k]) => k === method)) {
      setMethod(methods[0][0]);
    }
  }, [methods.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!methods.length) return null;

  if (sent) {
    return (
      <Alert severity="success" className="rounded-xl">
        Transaction reference submitted. Our front desk will verify the transfer and update your folio automatically.
      </Alert>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await submit({
        method,
        amount: Number(amount),
        reference: reference.trim(),
        senderName: senderName.trim(),
        phone: phone.trim(),
      });
      setSent(true);
      toast.success('Payment proof submitted for desk verification');
      onSent?.();
    } catch (err: any) {
      setError(err.message || 'Could not submit payment proof');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-dashed border-border bg-secondary/25 p-5">
      <div>
        <p className="text-sm font-semibold text-foreground">Submit Payment Proof</p>
        <p className="text-xs text-muted-foreground">Already sent the transfer? Enter your Transaction ID (TID) so the desk can verify it.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Channel</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {methods.map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Amount Sent (PKR)</Label>
          <Input
            required
            type="number"
            min={1}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="18000"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Transaction ID (TID / Ref)</Label>
          <Input
            required
            minLength={6}
            maxLength={40}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. EP-98421022"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Sender Name (Optional)</Label>
          <Input
            maxLength={80}
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Account holder name"
          />
        </div>

        {needPhone && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Phone on the Booking</Label>
            <Input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03XX-XXXXXXX"
            />
          </div>
        )}
      </div>

      {error && <Alert severity="error">{error}</Alert>}

      <Button type="submit" variant="accent" disabled={busy}>
        {busy ? 'Sending…' : 'Submit Transaction ID'}
      </Button>
    </form>
  );
}
