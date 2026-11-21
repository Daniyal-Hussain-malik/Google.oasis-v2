import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  MessageCircle,
  RefreshCw,
  RotateCw,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from '@/src/pages/admin/AdminLayout';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Switch } from '@/src/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Textarea } from '@/src/components/ui/textarea';
import { SUPER, useAdminAuth } from '@/src/context/AdminAuthContext';
import { adminApi } from '@/src/lib/api';

interface MessageLogRow {
  _id: string;
  direction: 'outbound' | 'inbound';
  eventType: string;
  bookingNumber?: string;
  recipientPhone: string;
  recipientName?: string;
  messageMode: 'template' | 'text';
  templateName?: string;
  bodyPreview?: string;
  metaMessageId?: string;
  status: string;
  errorMessage?: string;
  createdAt: string;
}

function originBase(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin.replace(/\/$/, '');
}

const PRESET_UPDATES = [
  {
    label: 'Katpana Pin & Check-in Info',
    body: 'Assalam-o-Alaikum from Oasis Resort Skardu! Check-in opens at 14:00. Follow Katpana Cold Desert Road (15 mins from Skardu Airport). Reply here if you need our location pin or airport jeep pickup.',
  },
  {
    label: 'Skardu Weather & Heater Prep',
    body: 'Skardu evening update: Katpana dunes drop cool after sunset. Your hut room heater is prepared ahead of arrival — carry a warm jacket for sunset walks.',
  },
  {
    label: 'Airport Jeep Dispatched',
    body: 'Oasis Resort Skardu update: Your airport pickup driver has been dispatched and will meet you outside the Skardu terminal arrivals gate.',
  },
];

export function AdminWhatsAppPage() {
  const { can } = useAdminAuth();
  const isManager = can(...SUPER);

  const [tab, setTab] = useState<'send' | 'config' | 'logs'>('send');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingUpdate, setSendingUpdate] = useState(false);

  const [stats, setStats] = useState({ total: 0, sent: 0, delivered: 0, read: 0, dryRun: 0, failed: 0, inbound: 0 });
  const [logs, setLogs] = useState<MessageLogRow[]>([]);

  const [cfg, setCfg] = useState({
    enabled: false,
    graphApiVersion: 'v21.0',
    phoneNumberId: '',
    businessAccountId: '',
    accessToken: '',
    appSecret: '',
    verifyToken: '',
    defaultCountryCode: '92',
    templateLanguage: 'en',
    useApprovedTemplates: false,
    sendBookingConfirmation: true,
    sendBookingCancellation: true,
    sendCheckInWelcome: true,
    sendCheckOutThanks: true,
    sendPaymentUpdates: true,
    templates: {
      booking_confirmed: 'oasis_booking_confirmation',
      booking_cancelled: 'oasis_booking_cancelled',
      guest_checked_in: 'oasis_checkin_welcome',
      guest_checked_out: 'oasis_checkout_thankyou',
      payment_confirmed: 'oasis_payment_confirmed',
      payment_declined: 'oasis_payment_declined',
      guest_update: 'oasis_guest_update',
    } as Record<string, string>,
    hasAccessToken: false,
    accessTokenMasked: '',
    hasAppSecret: false,
    appSecretMasked: '',
    envManagedToken: false,
    envManagedSecret: false,
    liveReady: false,
  });

  const [updateForm, setUpdateForm] = useState({
    bookingNumber: '',
    phone: '',
    recipientName: '',
    message: '',
  });
  const [testPhone, setTestPhone] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi('/admin/whatsapp/overview');
      setStats(res.stats || { total: 0, sent: 0, delivered: 0, read: 0, dryRun: 0, failed: 0, inbound: 0 });
      setLogs(res.logs || []);
      if (res.config) {
        setCfg((prev) => ({
          ...prev,
          ...res.config,
          accessToken: '',
          appSecret: '',
          templates: { ...prev.templates, ...(res.config.templates || {}) },
        }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not load WhatsApp settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copyText(val: string, label: string) {
    try {
      await navigator.clipboard.writeText(val);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Clipboard access unavailable');
    }
  }

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi('/admin/whatsapp/config', {
        method: 'PUT',
        body: {
          enabled: cfg.enabled,
          graphApiVersion: cfg.graphApiVersion.trim(),
          phoneNumberId: cfg.phoneNumberId.trim(),
          businessAccountId: cfg.businessAccountId.trim(),
          defaultCountryCode: cfg.defaultCountryCode.trim(),
          templateLanguage: cfg.templateLanguage.trim(),
          useApprovedTemplates: cfg.useApprovedTemplates,
          sendBookingConfirmation: cfg.sendBookingConfirmation,
          sendBookingCancellation: cfg.sendBookingCancellation,
          sendCheckInWelcome: cfg.sendCheckInWelcome,
          sendCheckOutThanks: cfg.sendCheckOutThanks,
          sendPaymentUpdates: cfg.sendPaymentUpdates,
          templates: cfg.templates,
          ...(cfg.accessToken.trim() ? { accessToken: cfg.accessToken.trim() } : {}),
          ...(cfg.appSecret.trim() ? { appSecret: cfg.appSecret.trim() } : {}),
        },
      });
      toast.success('WhatsApp Cloud API configuration saved');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not save WhatsApp configuration');
    } finally {
      setSaving(false);
    }
  }

  async function rotateVerifyToken() {
    try {
      await adminApi('/admin/whatsapp/config', { method: 'PUT', body: { rotateVerifyToken: true } });
      toast.success('Webhook verify token rotated');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not rotate token');
    }
  }

  async function sendGuestUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSendingUpdate(true);
    try {
      const res = await adminApi<{ status: string; mode: string }>('/admin/whatsapp/send-update', {
        method: 'POST',
        body: {
          bookingNumber: updateForm.bookingNumber.trim() || undefined,
          phone: updateForm.phone.trim() || undefined,
          recipientName: updateForm.recipientName.trim() || undefined,
          message: updateForm.message.trim(),
        },
      });
      if (res.mode === 'dry_run') {
        toast.info('Logged in Dry-Run mode (enable live Meta credentials in Configuration tab to deliver).');
      } else {
        toast.success('WhatsApp guest update sent');
      }
      setUpdateForm({ bookingNumber: '', phone: '', recipientName: '', message: '' });
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send WhatsApp update');
    } finally {
      setSendingUpdate(false);
    }
  }

  async function sendTestMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!testPhone.trim()) return;
    setSendingTest(true);
    try {
      const res = await adminApi<{ ok: boolean; mode: string; error?: string }>('/admin/whatsapp/test', {
        method: 'POST',
        body: { phone: testPhone.trim() },
      });
      if (!res.ok) {
        toast.error(res.error || 'Meta API rejected test message');
      } else if (res.mode === 'dry_run') {
        toast.info('Test message recorded in Dry-Run log (credentials not enabled yet).');
      } else {
        toast.success('Test WhatsApp message delivered to Meta Graph API');
      }
      load();
    } catch (err: any) {
      toast.error(err.message || 'Test failed');
    } finally {
      setSendingTest(false);
    }
  }

  const webhookUrl = `${originBase()}/api/public/whatsapp/webhook`;

  return (
    <AdminLayout title="WhatsApp Cloud API">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">WhatsApp Business Cloud API</h1>
            <p className="text-sm text-muted-foreground">
              Automated booking confirmations, check-in welcomes, payment proof alerts, and direct guest updates via Meta Cloud API.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
          </Button>
        </div>

        {/* Status Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Delivery Mode</p>
              <p className="mt-1 font-display text-2xl font-semibold flex items-center gap-2">
                {cfg.liveReady ? 'Live Cloud API' : 'Dry-Run Audit'}
                {cfg.liveReady && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sent / Delivered / Read</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
                {stats.sent + stats.delivered + stats.read} <span className="text-sm font-normal text-muted-foreground">({stats.read} read)</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dry-Run Logged</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{stats.dryRun}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Inbound Replies · Failed</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
                {stats.inbound} · <span className={stats.failed > 0 ? 'text-destructive' : ''}>{stats.failed}</span>
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'send' | 'config' | 'logs')}>
          <TabsList>
            <TabsTrigger value="send">Send Guest Update & Test</TabsTrigger>
            <TabsTrigger value="config">Meta Cloud API Config</TabsTrigger>
            <TabsTrigger value="logs">Message & Delivery Log ({logs.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* TAB 1: SEND GUEST UPDATE & TEST */}
        {tab === 'send' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-accent" /> Dispatch Guest WhatsApp Update
                </CardTitle>
                <CardDescription>
                  Enter a Booking Number (to auto-pull the guest&apos;s phone) or type any phone number directly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={sendGuestUpdate} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Booking # (optional)</Label>
                      <Input
                        value={updateForm.bookingNumber}
                        onChange={(e) => setUpdateForm((p) => ({ ...p, bookingNumber: e.target.value }))}
                        placeholder="e.g. OAS260001"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Phone Override</Label>
                      <Input
                        value={updateForm.phone}
                        onChange={(e) => setUpdateForm((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="0344-5537788"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Guest Name (optional)</Label>
                      <Input
                        value={updateForm.recipientName}
                        onChange={(e) => setUpdateForm((p) => ({ ...p, recipientName: e.target.value }))}
                        placeholder="Guest name"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>WhatsApp Message</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_UPDATES.map((preset) => (
                          <Button
                            key={preset.label}
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => setUpdateForm((p) => ({ ...p, message: preset.body }))}
                          >
                            <Sparkles className="h-3 w-3" /> {preset.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Textarea
                      required
                      rows={4}
                      value={updateForm.message}
                      onChange={(e) => setUpdateForm((p) => ({ ...p, message: e.target.value }))}
                      placeholder="Write check-in details, Skardu weather advisory, jeep pickup confirmation…"
                    />
                  </div>

                  <Button type="submit" variant="accent" disabled={sendingUpdate}>
                    <Send className="h-4 w-4" /> {sendingUpdate ? 'Sending…' : 'Send WhatsApp Update'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-accent" /> Connection Quick Test
                </CardTitle>
                <CardDescription>
                  Verify E.164 normalization (+{cfg.defaultCountryCode}) and Meta Graph API dispatch.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={sendTestMessage} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Test Recipient WhatsApp Number</Label>
                    <Input
                      required
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="0344-5537788 or +923..."
                    />
                  </div>
                  <Button type="submit" variant="outline" className="w-full" disabled={sendingTest}>
                    <Send className="h-4 w-4" /> {sendingTest ? 'Testing…' : 'Send Test Alert'}
                  </Button>
                </form>

                <div className="mt-5 rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-1.5">
                  <p className="font-semibold">Active Automated Triggers</p>
                  <p className="text-muted-foreground">
                    Booking Confirmed: {cfg.sendBookingConfirmation ? 'On' : 'Off'} · Check-in Welcome:{' '}
                    {cfg.sendCheckInWelcome ? 'On' : 'Off'}
                  </p>
                  <p className="text-muted-foreground">
                    Payment Proof Updates: {cfg.sendPaymentUpdates ? 'On' : 'Off'} · Check-out / Cancel:{' '}
                    {cfg.sendCheckOutThanks || cfg.sendBookingCancellation ? 'On' : 'Off'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 2: META CLOUD API CONFIG */}
        {tab === 'config' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Meta WhatsApp Cloud API Credentials</CardTitle>
                <CardDescription>
                  Enter your Meta Business Phone Number ID and Permanent System User Token (or manage via server environment variables).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveConfig} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Phone Number ID</Label>
                      <Input
                        value={cfg.phoneNumberId}
                        onChange={(e) => setCfg((p) => ({ ...p, phoneNumberId: e.target.value }))}
                        placeholder="e.g. 109283746510293"
                        disabled={!isManager}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>WhatsApp Business Account ID</Label>
                      <Input
                        value={cfg.businessAccountId}
                        onChange={(e) => setCfg((p) => ({ ...p, businessAccountId: e.target.value }))}
                        placeholder="e.g. 209384756102938"
                        disabled={!isManager}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>
                        System Access Token {cfg.hasAccessToken ? `(${cfg.accessTokenMasked})` : '(Not set)'}
                      </Label>
                      <Input
                        type="password"
                        value={cfg.accessToken}
                        onChange={(e) => setCfg((p) => ({ ...p, accessToken: e.target.value }))}
                        placeholder={cfg.envManagedToken ? 'Managed via env var' : 'Paste Meta Graph API Bearer token'}
                        disabled={!isManager || cfg.envManagedToken}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>
                        Meta App Secret {cfg.hasAppSecret ? `(${cfg.appSecretMasked})` : '(Optional)'}
                      </Label>
                      <Input
                        type="password"
                        value={cfg.appSecret}
                        onChange={(e) => setCfg((p) => ({ ...p, appSecret: e.target.value }))}
                        placeholder={cfg.envManagedSecret ? 'Managed via env var' : 'Used for X-Hub-Signature-256'}
                        disabled={!isManager || cfg.envManagedSecret}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Graph Version</Label>
                      <Input
                        value={cfg.graphApiVersion}
                        onChange={(e) => setCfg((p) => ({ ...p, graphApiVersion: e.target.value }))}
                        placeholder="v21.0"
                        disabled={!isManager}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Default Country Code</Label>
                      <Input
                        value={cfg.defaultCountryCode}
                        onChange={(e) => setCfg((p) => ({ ...p, defaultCountryCode: e.target.value }))}
                        placeholder="92"
                        disabled={!isManager}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Template Language</Label>
                      <Input
                        value={cfg.templateLanguage}
                        onChange={(e) => setCfg((p) => ({ ...p, templateLanguage: e.target.value }))}
                        placeholder="en"
                        disabled={!isManager}
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5 rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Enable Live WhatsApp Dispatch</p>
                        <p className="text-xs text-muted-foreground">When off, messages log cleanly in dry-run audit mode.</p>
                      </div>
                      <Switch
                        checked={cfg.enabled}
                        onCheckedChange={(v) => setCfg((p) => ({ ...p, enabled: v }))}
                        disabled={!isManager}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Use Approved Meta Templates for Automated Events</p>
                        <p className="text-xs text-muted-foreground">Recommended in production for initiating out-of-window chats.</p>
                      </div>
                      <Switch
                        checked={cfg.useApprovedTemplates}
                        onCheckedChange={(v) => setCfg((p) => ({ ...p, useApprovedTemplates: v }))}
                        disabled={!isManager}
                      />
                    </div>
                  </div>

                  {isManager && (
                    <Button type="submit" variant="accent" disabled={saving}>
                      {saving ? 'Saving…' : 'Save WhatsApp Config'}
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Meta Webhook & Automated Triggers</CardTitle>
                  <CardDescription>
                    Configure this callback URL in Meta Developer Portal to receive real-time Delivered / Read receipts and guest replies.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Callback URL (GET & POST)</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                      <Button type="button" variant="outline" size="icon" onClick={() => copyText(webhookUrl, 'Webhook URL')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Verify Token (`hub.verify_token`)</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={cfg.verifyToken} className="font-mono text-xs" />
                      <Button type="button" variant="outline" size="icon" onClick={() => copyText(cfg.verifyToken, 'Verify Token')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      {isManager && (
                        <Button type="button" variant="outline" size="sm" onClick={rotateVerifyToken}>
                          <RotateCw className="h-3.5 w-3.5" /> Rotate
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2.5 pt-2 text-sm">
                    {[
                      ['sendBookingConfirmation', 'Booking Confirmation'],
                      ['sendCheckInWelcome', 'Check-in Welcome & Room Info'],
                      ['sendCheckOutThanks', 'Check-out Thank You & Invoice'],
                      ['sendBookingCancellation', 'Booking Cancellation Notice'],
                      ['sendPaymentUpdates', 'Easypaisa / Bank Proof Decisions'],
                    ].map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <span>{label}</span>
                        <Switch
                          checked={Boolean((cfg as any)[key])}
                          onCheckedChange={(v) => setCfg((p) => ({ ...p, [key]: v }))}
                          disabled={!isManager}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 3: MESSAGE & DELIVERY LOG */}
        {tab === 'logs' && (
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Delivery & Reply Log</CardTitle>
              <CardDescription>Tracks automated booking confirmations, guest updates, Meta delivery receipts, and inbound replies.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Message Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        No WhatsApp messages logged yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log._id}>
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {log.direction === 'inbound' ? 'INBOUND' : log.eventType}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.bookingNumber || '—'}</TableCell>
                        <TableCell className="text-xs">
                          <p className="font-medium">{log.recipientName || 'Guest'}</p>
                          <p className="font-mono text-muted-foreground">+{log.recipientPhone}</p>
                        </TableCell>
                        <TableCell className="text-xs font-semibold capitalize">
                          <span
                            className={
                              log.status === 'failed'
                                ? 'text-destructive'
                                : log.status === 'delivered' || log.status === 'read' || log.status === 'sent'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                            }
                          >
                            {log.status.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-md text-xs text-muted-foreground">
                          <p className="line-clamp-2 whitespace-pre-line">{log.bodyPreview}</p>
                          {log.errorMessage && log.status === 'failed' && (
                            <p className="text-destructive mt-0.5">{log.errorMessage}</p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
