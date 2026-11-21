import React, { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@mui/material';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Label } from '@/src/components/ui/label';
import { api } from '@/src/lib/api';

export function EnquiryForm({
  topic = 'General',
  title = 'Write to the front desk',
  prompt = 'Tell us your preferred dates, group size, or any questions before you arrive.',
  compact = false,
}: {
  topic?: string;
  title?: string;
  prompt?: string;
  compact?: boolean;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/public/enquiries', {
        method: 'POST',
        body: { topic, name: name.trim(), email: email.trim(), phone: phone.trim(), message: message.trim() },
      });
      setSent(true);
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
      toast.success('Message sent to the Oasis front desk');
    } catch (err: any) {
      setError(err.message || 'Could not send enquiry');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={compact ? '' : 'mx-auto max-w-3xl'}>
      <CardHeader>
        <p className="text-xs font-medium uppercase tracking-wider text-accent">{topic}</p>
        <CardTitle className="font-display text-3xl font-semibold">{title}</CardTitle>
        <CardDescription>{prompt}</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-3">
            <Alert severity="success">
              Thank you. Your enquiry has been logged at the desk and we will reply to your email shortly.
            </Alert>
            <Button variant="outline" size="sm" onClick={() => setSent(false)}>
              Send another message
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ayesha Khan" />
              </div>
              <div className="space-y-1.5">
                <Label>Email Address</Label>
                <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ayesha@example.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Phone / WhatsApp (Optional)</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03XX-XXXXXXX" />
            </div>
            {topic !== 'Newsletter' && (
              <div className="space-y-1.5">
                <Label>Message</Label>
                <Textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Dates, room preferences, airport pickup..."
                />
              </div>
            )}
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="accent" disabled={busy}>
              {busy ? 'Sending…' : topic === 'Newsletter' ? 'Subscribe' : 'Send Enquiry'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
