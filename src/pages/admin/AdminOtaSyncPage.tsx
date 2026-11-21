import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  Globe2,
  Link2,
  Plus,
  RefreshCw,
  RotateCw,
  Send,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from '@/src/pages/admin/AdminLayout';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Switch } from '@/src/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { SUPER, useAdminAuth } from '@/src/context/AdminAuthContext';
import { adminApi, pkr, pretty } from '@/src/lib/api';

interface IcalSource {
  _id: string;
  room: string;
  provider: 'airbnb' | 'booking_com' | 'vrbo' | 'ical';
  label: string;
  url: string;
  enabled: boolean;
  autoSync: boolean;
  lastSyncAt?: string;
  lastStatus: 'idle' | 'ok' | 'conflict' | 'error';
  lastMessage?: string;
  eventsCount: number;
  blockedNightsCount: number;
}

interface OtaRoomRow {
  _id: string;
  roomNo: string;
  roomTypeId: string;
  roomTypeName: string;
  status: string;
  exportPath: string;
  lastExportedAt?: string;
  inboundSources: IcalSource[];
}

interface OtaBlockRow {
  _id: string;
  roomNo: string;
  provider: string;
  externalUid: string;
  summary: string;
  checkIn: string;
  checkOut: string;
  status: 'active' | 'conflict' | 'cancelled';
  conflictNote?: string;
}

interface RoomMappingRow {
  roomTypeId: string;
  roomTypeName: string;
  activeRooms: number;
  baseRate: number;
  weekendRate: number;
  otaSampleRate: number;
  externalRoomTypeId: string;
  externalRatePlanId: string;
  rateMarkupPct: number;
  minStay: number;
  maxStay: number;
  stopSell: boolean;
  enabled: boolean;
}

interface SyncLogRow {
  _id: string;
  kind: string;
  provider: string;
  direction: string;
  status: string;
  summary: string;
  itemsProcessed: number;
  createdAt: string;
}

function originBase(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin.replace(/\/$/, '');
}

const PROVIDER_LABELS: Record<string, string> = {
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
  vrbo: 'Vrbo',
  ical: 'iCal Feed',
  channex: 'Channex.io',
  beds24: 'Beds24',
  siteminder: 'SiteMinder',
  custom_webhook: 'Custom Webhook',
  disabled: 'Disabled',
};

export function AdminOtaSyncPage() {
  const { can } = useAdminAuth();
  const isManager = can(...SUPER);

  const [tab, setTab] = useState<'ical' | 'channel' | 'logs'>('ical');
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [pushingAri, setPushingAri] = useState(false);

  const [rooms, setRooms] = useState<OtaRoomRow[]>([]);
  const [blocks, setBlocks] = useState<OtaBlockRow[]>([]);
  const [mappings, setMappings] = useState<RoomMappingRow[]>([]);
  const [logs, setLogs] = useState<SyncLogRow[]>([]);

  const [channelForm, setChannelForm] = useState({
    provider: 'disabled',
    enabled: false,
    autoSyncOnBooking: true,
    syncIntervalMinutes: 15,
    horizonDays: 90,
    propertyId: '',
    apiBaseUrl: '',
    apiKey: '',
    webhookSecret: '',
    hasApiKey: false,
    apiKeyMasked: '',
    hasWebhookSecret: false,
    webhookSecretMasked: '',
    envManagedKey: false,
    lastPushAt: '',
    lastPushStatus: 'idle',
    lastPushMessage: '',
  });
  const [savingConfig, setSavingConfig] = useState(false);

  const [addFeedRoom, setAddFeedRoom] = useState<OtaRoomRow | null>(null);
  const [feedForm, setFeedForm] = useState({ provider: 'airbnb', label: '', url: '' });
  const [savingFeed, setSavingFeed] = useState(false);

  const [mappingDrafts, setMappingDrafts] = useState<Record<string, RoomMappingRow>>({});
  const [savingMapId, setSavingMapId] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewJson, setPreviewJson] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi('/admin/ota/overview');
      setRooms(res.rooms || []);
      setBlocks(res.blocks || []);
      setLogs(res.logs || []);

      const nextMappings: RoomMappingRow[] = res.mappings || [];
      setMappings(nextMappings);
      setMappingDrafts(Object.fromEntries(nextMappings.map((m) => [m.roomTypeId, { ...m }])));

      if (res.channelConfig) {
        setChannelForm((prev) => ({
          ...prev,
          provider: res.channelConfig.provider || 'disabled',
          enabled: Boolean(res.channelConfig.enabled),
          autoSyncOnBooking: res.channelConfig.autoSyncOnBooking !== false,
          syncIntervalMinutes: Number(res.channelConfig.syncIntervalMinutes || 15),
          horizonDays: Number(res.channelConfig.horizonDays || 90),
          propertyId: res.channelConfig.propertyId || '',
          apiBaseUrl: res.channelConfig.apiBaseUrl || '',
          apiKey: '',
          webhookSecret: '',
          hasApiKey: Boolean(res.channelConfig.hasApiKey),
          apiKeyMasked: res.channelConfig.apiKeyMasked || '',
          hasWebhookSecret: Boolean(res.channelConfig.hasWebhookSecret),
          webhookSecretMasked: res.channelConfig.webhookSecretMasked || '',
          envManagedKey: Boolean(res.channelConfig.envManagedKey),
          lastPushAt: res.channelConfig.lastPushAt || '',
          lastPushStatus: res.channelConfig.lastPushStatus || 'idle',
          lastPushMessage: res.channelConfig.lastPushMessage || '',
        }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not load OTA sync settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copyText(textToCopy: string, label: string) {
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Clipboard permission unavailable');
    }
  }

  async function rotateToken(room: OtaRoomRow) {
    try {
      await adminApi(`/admin/ota/rooms/${room._id}/rotate-token`, { method: 'POST' });
      toast.success(`Feed token rotated for Room ${room.roomNo}`);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not rotate token');
    }
  }

  async function addInboundFeed(e: React.FormEvent) {
    e.preventDefault();
    if (!addFeedRoom) return;
    setSavingFeed(true);
    try {
      const res = await adminApi<{ source: IcalSource; sync?: any }>('/admin/ota/ical-sources', {
        method: 'POST',
        body: {
          roomId: addFeedRoom._id,
          provider: feedForm.provider,
          label: feedForm.label.trim() || `${PROVIDER_LABELS[feedForm.provider]} — Room ${addFeedRoom.roomNo}`,
          url: feedForm.url.trim(),
          syncNow: true,
        },
      });
      if (res.source?.lastStatus === 'error') {
        toast.warning(`Feed added, initial sync returned an error: ${res.source.lastMessage}`);
      } else if (res.source?.lastStatus === 'conflict') {
        toast.warning(`Feed synced with overlap conflicts: ${res.source.lastMessage}`);
      } else {
        toast.success(`iCal feed connected for Room ${addFeedRoom.roomNo}`);
      }
      setAddFeedRoom(null);
      setFeedForm({ provider: 'airbnb', label: '', url: '' });
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not add iCal feed');
    } finally {
      setSavingFeed(false);
    }
  }

  async function syncSingleSource(sourceId: string) {
    try {
      const res = await adminApi(`/admin/ota/ical-sources/${sourceId}/sync`, { method: 'POST' });
      if (res.conflicts > 0) {
        toast.warning(`Synced with ${res.conflicts} overlap conflict(s)`);
      } else {
        toast.success(`Synced ${res.eventsCount} event(s), ${res.blockedNightsCount} night(s) blocked`);
      }
      load();
    } catch (err: any) {
      toast.error(err.message || 'iCal sync failed');
      load();
    }
  }

  async function deleteSource(sourceId: string) {
    try {
      await adminApi(`/admin/ota/ical-sources/${sourceId}`, { method: 'DELETE' });
      toast.success('iCal feed removed and external blocks released');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not remove iCal feed');
    }
  }

  async function syncAllFeeds() {
    setSyncingAll(true);
    try {
      const res = await adminApi<{ results: any[] }>('/admin/ota/ical/sync-all', { method: 'POST' });
      const okCount = (res.results || []).filter((r) => r.ok).length;
      toast.success(`Synced ${okCount} of ${(res.results || []).length} active iCal feeds`);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Batch sync failed');
    } finally {
      setSyncingAll(false);
    }
  }

  async function saveChannelConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await adminApi('/admin/ota/channel-config', {
        method: 'PUT',
        body: {
          provider: channelForm.provider,
          enabled: channelForm.enabled,
          autoSyncOnBooking: channelForm.autoSyncOnBooking,
          syncIntervalMinutes: channelForm.syncIntervalMinutes,
          horizonDays: channelForm.horizonDays,
          propertyId: channelForm.propertyId.trim(),
          apiBaseUrl: channelForm.apiBaseUrl.trim(),
          ...(channelForm.apiKey.trim() ? { apiKey: channelForm.apiKey.trim() } : {}),
          ...(channelForm.webhookSecret.trim() ? { webhookSecret: channelForm.webhookSecret.trim() } : {}),
        },
      });
      toast.success('Channel Manager configuration saved');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not save Channel Manager settings');
    } finally {
      setSavingConfig(false);
    }
  }

  async function rotateWebhookSecret() {
    try {
      await adminApi('/admin/ota/channel-config', {
        method: 'PUT',
        body: { rotateWebhookSecret: true },
      });
      toast.success('Webhook secret rotated');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not rotate webhook secret');
    }
  }

  async function saveMapping(roomTypeId: string) {
    const draft = mappingDrafts[roomTypeId];
    if (!draft) return;
    setSavingMapId(roomTypeId);
    try {
      await adminApi(`/admin/ota/mappings/${roomTypeId}`, {
        method: 'PUT',
        body: {
          externalRoomTypeId: draft.externalRoomTypeId,
          externalRatePlanId: draft.externalRatePlanId,
          rateMarkupPct: draft.rateMarkupPct,
          minStay: draft.minStay,
          maxStay: draft.maxStay,
          stopSell: draft.stopSell,
          enabled: draft.enabled,
        },
      });
      toast.success(`Mapping saved for ${draft.roomTypeName}`);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not save mapping');
    } finally {
      setSavingMapId(null);
    }
  }

  async function triggerAriPush() {
    setPushingAri(true);
    try {
      const res = await adminApi<{ status: string; summary: string }>('/admin/ota/channel/push-ari', {
        method: 'POST',
        body: { reason: 'admin_manual_push' },
      });
      if (res.status === 'success') toast.success(res.summary);
      else toast.info(res.summary);
      load();
    } catch (err: any) {
      toast.error(err.message || 'ARI push failed');
      load();
    } finally {
      setPushingAri(false);
    }
  }

  async function openPayloadPreview() {
    try {
      const res = await adminApi('/admin/ota/channel/preview-ari?days=3');
      setPreviewJson(JSON.stringify(res.payload, null, 2));
      setPreviewOpen(true);
    } catch (err: any) {
      toast.error(err.message || 'Could not build ARI payload preview');
    }
  }

  const totalSources = rooms.reduce((sum, r) => sum + r.inboundSources.length, 0);
  const conflictBlocks = blocks.filter((b) => b.status === 'conflict');
  const activeBlocks = blocks.filter((b) => b.status === 'active');
  const webhookEndpoint = `${originBase()}/api/public/ota/webhook/${channelForm.provider === 'disabled' ? 'channex' : channelForm.provider}`;

  return (
    <AdminLayout title="OTA & Channel Sync">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">OTA & Channel Manager Sync</h1>
            <p className="text-sm text-muted-foreground">
              Two-way Airbnb / Booking.com iCal feeds and real-time Channel Manager ARI distribution (Channex, Beds24, SiteMinder).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={syncAllFeeds} disabled={syncingAll || totalSources === 0}>
              <Calendar className="h-4 w-4" /> {syncingAll ? 'Syncing iCal…' : 'Sync All iCal'}
            </Button>
            <Button variant="accent" size="sm" onClick={triggerAriPush} disabled={pushingAri}>
              <Send className="h-4 w-4" /> {pushingAri ? 'Pushing ARI…' : 'Push Live ARI'}
            </Button>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Hut iCal Feeds</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{rooms.length} Export · {totalSources} Import</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">OTA Blocked Stays</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{activeBlocks.length} Active</p>
            </CardContent>
          </Card>
          <Card className={conflictBlocks.length > 0 ? 'border-amber-500/60 bg-amber-500/5' : ''}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Calendar Conflicts</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums flex items-center gap-2">
                {conflictBlocks.length}
                {conflictBlocks.length > 0 && <AlertTriangle className="h-5 w-5 text-amber-500" />}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Channel Manager API</p>
              <p className="mt-1 font-display text-2xl font-semibold">
                {channelForm.enabled ? PROVIDER_LABELS[channelForm.provider] : 'Standby'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'ical' | 'channel' | 'logs')}>
          <TabsList>
            <TabsTrigger value="ical">Phase 1 · iCal (.ics) Two-Way</TabsTrigger>
            <TabsTrigger value="channel">Phase 2 · Channel Manager API</TabsTrigger>
            <TabsTrigger value="logs">Sync & Webhook Logs ({logs.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* TAB 1: PHASE 1 ICAL TWO-WAY SYNC */}
        {tab === 'ical' && (
          <div className="space-y-6">
            {conflictBlocks.length > 0 && (
              <Card className="border-amber-500/60 bg-amber-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" /> Overbooking Conflict Alerts ({conflictBlocks.length})
                  </CardTitle>
                  <CardDescription>
                    These external OTA dates overlapped an existing Oasis reservation or block and were held out of RoomNights for staff review.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {conflictBlocks.map((b) => (
                    <div key={b._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-background/80 px-3 py-2 text-xs">
                      <div>
                        <span className="font-semibold">Room {b.roomNo}</span> ·{' '}
                        <span className="uppercase font-mono">{PROVIDER_LABELS[b.provider] || b.provider}</span> ·{' '}
                        <span>{pretty(b.checkIn)} → {pretty(b.checkOut)}</span>
                        {b.summary && <span className="text-muted-foreground"> ({b.summary})</span>}
                      </div>
                      <span className="text-amber-600 dark:text-amber-400">{b.conflictNote}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Per-Hut iCal (.ics) Calendar Sync</CardTitle>
                <CardDescription>
                  Copy each room&apos;s private Export URL into Airbnb / Booking.com (&ldquo;Import calendar&rdquo;), and paste their Export URLs here so external bookings block Oasis dates automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hut / Room</TableHead>
                      <TableHead>Outbound Export Feed (.ics)</TableHead>
                      <TableHead>Inbound OTA Calendars</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rooms.map((room) => {
                      const fullExportUrl = `${originBase()}${room.exportPath}`;
                      return (
                        <TableRow key={room._id}>
                          <TableCell className="align-top">
                            <p className="font-mono text-sm font-semibold">Room {room.roomNo}</p>
                            <p className="text-xs text-muted-foreground">{room.roomTypeName}</p>
                          </TableCell>
                          <TableCell className="align-top max-w-sm">
                            <div className="flex items-center gap-1.5">
                              <Input readOnly value={fullExportUrl} className="h-8 font-mono text-[11px]" />
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 shrink-0"
                                title="Copy Export .ics URL"
                                onClick={() => copyText(fullExportUrl, `Room ${room.roomNo} .ics URL`)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                asChild
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 shrink-0"
                                title="Download .ics"
                              >
                                <a href={room.exportPath} download={`oasis-room-${room.roomNo}.ics`}>
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              {isManager && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 shrink-0"
                                  title="Rotate private token"
                                  onClick={() => rotateToken(room)}
                                >
                                  <RotateCw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            {room.inboundSources.length === 0 ? (
                              <span className="text-xs text-muted-foreground">No external calendars linked</span>
                            ) : (
                              <div className="space-y-2">
                                {room.inboundSources.map((src) => (
                                  <div key={src._id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 font-medium">
                                        <span className="uppercase font-mono text-[10px] text-accent">
                                          {PROVIDER_LABELS[src.provider] || src.provider}
                                        </span>
                                        <span className="truncate">{src.label}</span>
                                        {src.lastStatus === 'ok' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                                        {src.lastStatus === 'conflict' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                      </div>
                                      <p className="truncate text-[11px] text-muted-foreground">
                                        {src.lastMessage || `${src.eventsCount} events · ${src.blockedNightsCount} nights`}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => syncSingleSource(src._id)}>
                                        <RefreshCw className="h-3 w-3" /> Sync
                                      </Button>
                                      {isManager && (
                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteSource(src._id)}>
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="align-top text-right">
                            {isManager && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setAddFeedRoom(room);
                                  setFeedForm({ provider: 'airbnb', label: `Airbnb — Room ${room.roomNo}`, url: '' });
                                }}
                              >
                                <Plus className="h-3.5 w-3.5" /> Link OTA iCal
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Imported OTA Calendar Blocks ({activeBlocks.length})</CardTitle>
                <CardDescription>Dates currently blocked on Oasis availability via external Airbnb/Booking.com iCal feeds.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Stay Dates</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeBlocks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                          No active external OTA blocks imported yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      activeBlocks.map((b) => (
                        <TableRow key={b._id}>
                          <TableCell className="font-mono text-xs font-semibold">Room {b.roomNo}</TableCell>
                          <TableCell className="text-xs font-medium">{PROVIDER_LABELS[b.provider] || b.provider}</TableCell>
                          <TableCell className="text-xs">{pretty(b.checkIn)} → {pretty(b.checkOut)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{b.summary || 'Reserved'}</TableCell>
                          <TableCell className="text-xs font-medium capitalize text-emerald-600 dark:text-emerald-400">{b.status}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 2: PHASE 2 CHANNEL MANAGER API */}
        {tab === 'channel' && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-accent" /> Channel Manager Connection
                  </CardTitle>
                  <CardDescription>
                    Connect Channex.io, Beds24, or SiteMinder to push live inventory & rates automatically whenever rooms are booked or updated.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={saveChannelConfig} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Channel Manager Provider</Label>
                        <Select
                          value={channelForm.provider}
                          onValueChange={(v) => setChannelForm((p) => ({ ...p, provider: v }))}
                          disabled={!isManager}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="disabled">Disabled (iCal only)</SelectItem>
                            <SelectItem value="channex">Channex.io</SelectItem>
                            <SelectItem value="beds24">Beds24</SelectItem>
                            <SelectItem value="siteminder">SiteMinder</SelectItem>
                            <SelectItem value="custom_webhook">Custom Channel Bridge</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>External Property / Hotel ID</Label>
                        <Input
                          value={channelForm.propertyId}
                          onChange={(e) => setChannelForm((p) => ({ ...p, propertyId: e.target.value }))}
                          placeholder="e.g. channex-prop-uuid"
                          disabled={!isManager}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>API Base URL (HTTPS, optional override)</Label>
                      <Input
                        value={channelForm.apiBaseUrl}
                        onChange={(e) => setChannelForm((p) => ({ ...p, apiBaseUrl: e.target.value }))}
                        placeholder="https://app.channex.io/api/v1"
                        disabled={!isManager}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>
                          API Key {channelForm.hasApiKey ? `(${channelForm.apiKeyMasked})` : '(Not set)'}
                        </Label>
                        <Input
                          type="password"
                          value={channelForm.apiKey}
                          onChange={(e) => setChannelForm((p) => ({ ...p, apiKey: e.target.value }))}
                          placeholder={channelForm.envManagedKey ? 'Managed via server env var' : 'Enter new API key to update'}
                          disabled={!isManager || channelForm.envManagedKey}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>ARI Horizon (Days)</Label>
                        <Input
                          type="number"
                          min={7}
                          max={365}
                          value={channelForm.horizonDays}
                          onChange={(e) => setChannelForm((p) => ({ ...p, horizonDays: Number(e.target.value) || 90 }))}
                          disabled={!isManager}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={channelForm.enabled}
                          onCheckedChange={(v) => setChannelForm((p) => ({ ...p, enabled: v }))}
                          disabled={!isManager}
                        />
                        <div>
                          <p className="text-sm font-medium">Enable Live Upstream ARI Push</p>
                          <p className="text-xs text-muted-foreground">When off, ARI updates run in dry-run audit mode.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={channelForm.autoSyncOnBooking}
                          onCheckedChange={(v) => setChannelForm((p) => ({ ...p, autoSyncOnBooking: v }))}
                          disabled={!isManager}
                        />
                        <span className="text-xs font-medium">Auto-push on booking</span>
                      </div>
                    </div>

                    {isManager && (
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" variant="accent" disabled={savingConfig}>
                          {savingConfig ? 'Saving…' : 'Save Channel Config'}
                        </Button>
                        <Button type="button" variant="outline" onClick={openPayloadPreview}>
                          Preview ARI Payload
                        </Button>
                      </div>
                    )}
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-accent" /> Inbound Reservation Webhook
                  </CardTitle>
                  <CardDescription>
                    Paste this endpoint into your Channel Manager so Booking.com / Airbnb reservations & cancellations book into Oasis automatically with row-locked inventory.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Webhook Receiver URL (POST)</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={webhookEndpoint} className="font-mono text-xs" />
                      <Button type="button" variant="outline" size="icon" onClick={() => copyText(webhookEndpoint, 'Webhook URL')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Webhook Signing / Bearer Secret</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={channelForm.hasWebhookSecret ? channelForm.webhookSecretMasked : 'Not generated'}
                        className="font-mono text-xs"
                      />
                      {isManager && (
                        <Button type="button" variant="outline" size="sm" onClick={rotateWebhookSecret}>
                          <RotateCw className="h-3.5 w-3.5" /> Rotate
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Supports <code>X-Webhook-Secret</code>, <code>Authorization: Bearer</code>, or HMAC-SHA256 via <code>X-Signature-256</code> / <code>X-Channex-Signature</code>.
                    </p>
                  </div>

                  {channelForm.lastPushMessage && (
                    <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-1">
                      <p className="font-semibold">
                        Last ARI Sync: <span className="uppercase font-mono">{channelForm.lastPushStatus}</span>
                      </p>
                      <p className="text-muted-foreground">{channelForm.lastPushMessage}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Room Type & Rate Plan Mappings</CardTitle>
                <CardDescription>
                  Map each Oasis room category to its Channex/Beds24/SiteMinder ID and configure OTA commission markup %, min stay, and stop-sell rules.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Oasis Room Type</TableHead>
                      <TableHead>Direct vs OTA Rate</TableHead>
                      <TableHead>External Room Type ID</TableHead>
                      <TableHead>External Rate Plan ID</TableHead>
                      <TableHead>Markup %</TableHead>
                      <TableHead>Min Stay</TableHead>
                      <TableHead>Stop Sell</TableHead>
                      <TableHead className="text-right">Save</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((row) => {
                      const draft = mappingDrafts[row.roomTypeId] || row;
                      const previewOta = Math.round(draft.baseRate * (1 + Number(draft.rateMarkupPct || 0) / 100));
                      return (
                        <TableRow key={row.roomTypeId}>
                          <TableCell>
                            <p className="font-medium text-sm">{draft.roomTypeName}</p>
                            <p className="text-xs text-muted-foreground">{draft.activeRooms} active huts</p>
                          </TableCell>
                          <TableCell className="text-xs tabular-nums">
                            <p>Direct: {pkr(draft.baseRate)}</p>
                            <p className="font-semibold text-accent">OTA: {pkr(previewOta)}</p>
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 font-mono text-xs min-w-[140px]"
                              value={draft.externalRoomTypeId}
                              onChange={(e) =>
                                setMappingDrafts((p) => ({
                                  ...p,
                                  [row.roomTypeId]: { ...draft, externalRoomTypeId: e.target.value },
                                }))
                              }
                              placeholder={`oasis-rt-${row.roomTypeId}`}
                              disabled={!isManager}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 font-mono text-xs min-w-[140px]"
                              value={draft.externalRatePlanId}
                              onChange={(e) =>
                                setMappingDrafts((p) => ({
                                  ...p,
                                  [row.roomTypeId]: { ...draft, externalRatePlanId: e.target.value },
                                }))
                              }
                              placeholder={`oasis-rp-${row.roomTypeId}`}
                              disabled={!isManager}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-20 text-xs"
                              value={draft.rateMarkupPct}
                              onChange={(e) =>
                                setMappingDrafts((p) => ({
                                  ...p,
                                  [row.roomTypeId]: { ...draft, rateMarkupPct: Number(e.target.value) || 0 },
                                }))
                              }
                              disabled={!isManager}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              max={30}
                              className="h-8 w-16 text-xs"
                              value={draft.minStay}
                              onChange={(e) =>
                                setMappingDrafts((p) => ({
                                  ...p,
                                  [row.roomTypeId]: { ...draft, minStay: Number(e.target.value) || 1 },
                                }))
                              }
                              disabled={!isManager}
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={draft.stopSell}
                              onCheckedChange={(v) =>
                                setMappingDrafts((p) => ({
                                  ...p,
                                  [row.roomTypeId]: { ...draft, stopSell: v },
                                }))
                              }
                              disabled={!isManager}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {isManager && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={savingMapId === row.roomTypeId}
                                onClick={() => saveMapping(row.roomTypeId)}
                              >
                                {savingMapId === row.roomTypeId ? 'Saving…' : 'Save'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 3: SYNC LOGS */}
        {tab === 'logs' && (
          <Card>
            <CardHeader>
              <CardTitle>OTA Sync & Webhook Audit Trail</CardTitle>
              <CardDescription>Recent iCal imports, ARI inventory/rate pushes, and incoming Channel Manager booking webhooks.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No OTA sync events recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((l) => (
                      <TableRow key={l._id}>
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(l.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{l.kind}</TableCell>
                        <TableCell className="text-xs font-medium">{PROVIDER_LABELS[l.provider] || l.provider}</TableCell>
                        <TableCell className="text-xs font-semibold capitalize">{l.status}</TableCell>
                        <TableCell className="text-xs">{l.summary}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add External iCal Feed Dialog */}
      <Dialog open={Boolean(addFeedRoom)} onOpenChange={(o) => !o && setAddFeedRoom(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link External OTA Calendar — Room {addFeedRoom?.roomNo}</DialogTitle>
            <DialogDescription>
              Paste the HTTPS `.ics` export link from Airbnb, Booking.com, or Vrbo. Dates will automatically block on Oasis.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={addInboundFeed} className="space-y-4">
            <div className="space-y-1.5">
              <Label>OTA Platform</Label>
              <Select
                value={feedForm.provider}
                onValueChange={(v) =>
                  setFeedForm((p) => ({
                    ...p,
                    provider: v,
                    label: `${PROVIDER_LABELS[v] || v} — Room ${addFeedRoom?.roomNo || ''}`,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="airbnb">Airbnb</SelectItem>
                  <SelectItem value="booking_com">Booking.com</SelectItem>
                  <SelectItem value="vrbo">Vrbo</SelectItem>
                  <SelectItem value="ical">Other iCal (.ics)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Feed Label</Label>
              <Input
                required
                value={feedForm.label}
                onChange={(e) => setFeedForm((p) => ({ ...p, label: e.target.value }))}
                placeholder="Airbnb — Hut 101"
              />
            </div>
            <div className="space-y-1.5">
              <Label>External iCal (.ics) HTTPS URL</Label>
              <Input
                required
                type="url"
                value={feedForm.url}
                onChange={(e) => setFeedForm((p) => ({ ...p, url: e.target.value }))}
                placeholder="https://www.airbnb.com/calendar/ical/..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddFeedRoom(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={savingFeed}>
                {savingFeed ? 'Connecting…' : 'Connect & Sync Now'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ARI Payload Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Channel Manager ARI Payload Preview (3 Days)</DialogTitle>
            <DialogDescription>
              Exact real-time availability, rates, min-stay, and stop-sell payload formatted for the selected provider.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs">
            {previewJson}
          </pre>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
