import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from '@mui/material';
import { Activity, Bell, CheckCircle2, Database, Download, HardDrive, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from '@/src/pages/admin/AdminLayout';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { API, adminApi } from '@/src/lib/api';

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function AdminSystemPage() {
  const [status, setStatus] = useState<any | null>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, b] = await Promise.all([
        adminApi<any>('/admin/system/status'),
        adminApi<{ items: any[] }>('/admin/system/backups'),
      ]);
      setStatus(s);
      setBackups(b.items || []);
    } catch (err: any) {
      toast.error(err.message || 'Could not load system diagnostics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function triggerBackup() {
    setBackingUp(true);
    try {
      const res = await adminApi<any>('/admin/system/backups/run', { method: 'POST' });
      toast.success(`Backup saved: ${res.filename} (${formatBytes(res.sizeBytes)})`);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Database backup failed');
    } finally {
      setBackingUp(false);
    }
  }

  async function triggerTestAlert() {
    setTestingAlert(true);
    try {
      await adminApi('/admin/system/alerts/test', { method: 'POST' });
      toast.success('Verification alert dispatched');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Alert verification failed');
    } finally {
      setTestingAlert(false);
    }
  }

  async function downloadBackup(filename: string) {
    try {
      const res = await fetch(`${API}/admin/system/backups/${encodeURIComponent(filename)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || 'Could not download backup');
    }
  }

  return (
    <AdminLayout title="System & Backups">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">Observability, Alerts & Backups</h1>
            <p className="text-sm text-muted-foreground">
              Pino JSON logging, Sentry crash tracking, uptime alerts, and daily automated database snapshots.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={triggerTestAlert} disabled={testingAlert}>
              <Bell className="h-4 w-4" />
              {testingAlert ? 'Sending…' : 'Send Test Alert'}
            </Button>
            <Button variant="accent" size="sm" onClick={triggerBackup} disabled={backingUp}>
              <Database className="h-4 w-4" />
              {backingUp ? 'Running Backup…' : 'Run Backup Now'}
            </Button>
          </div>
        </div>

        {status && !status.ok && (
          <Alert severity="error">Database health check is degraded: {status.dbError || 'Connection error'}</Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Service Health</span>
                <Activity className="h-4 w-4 text-accent" />
              </div>
              <p className="font-display text-2xl font-semibold flex items-center gap-2">
                <CheckCircle2 className={`h-5 w-5 ${status?.ok ? 'text-emerald-600' : 'text-destructive'}`} />
                {status ? (status.ok ? 'Healthy' : 'Degraded') : '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                DB {status?.dbDialect || '—'} · {status?.dbLatencyMs ?? '—'} ms · Uptime {status?.uptimeSeconds ?? 0}s
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Crash & Log Pipeline</span>
                <ShieldCheck className="h-4 w-4 text-accent" />
              </div>
              <p className="font-display text-2xl font-semibold">
                {status?.sentry?.initialized ? 'Sentry Active' : 'Pino JSON'}
              </p>
              <p className="text-xs text-muted-foreground">
                Log level: {status?.logging?.level || 'info'} · 5xx (15m): {status?.errorsLast15m ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Daily DB Backups</span>
                <Database className="h-4 w-4 text-accent" />
              </div>
              <p className="font-display text-2xl font-semibold tabular-nums">
                {backups.length} {backups.length === 1 ? 'archive' : 'archives'}
              </p>
              <p className="text-xs text-muted-foreground">
                Every {status?.backup?.intervalHours ?? 24}h · Retain {status?.backup?.retentionDays ?? 14}d
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Cloud Storage & Alerts</span>
                <HardDrive className="h-4 w-4 text-accent" />
              </div>
              <p className="font-display text-2xl font-semibold capitalize">
                {status?.storage?.configured ? status.storage.provider : 'Local Dev'}
              </p>
              <p className="text-xs text-muted-foreground">
                Webhook: {status?.alerts?.webhookConfigured ? 'Configured' : 'Off'} · Email alerts: {status?.alerts?.emailRecipients ?? 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Automated Database Backups</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Archive File</TableHead>
                  <TableHead>Created (UTC)</TableHead>
                  <TableHead className="text-right">Compressed Size</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No backup archives created yet. Click &ldquo;Run Backup Now&rdquo; to generate the first snapshot.
                    </TableCell>
                  </TableRow>
                ) : (
                  backups.map((b) => (
                    <TableRow key={b.filename}>
                      <TableCell className="font-mono text-xs font-medium">{b.filename}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">{formatBytes(b.sizeBytes)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => downloadBackup(b.filename)}>
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {status?.alerts?.recent?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">Recent Monitoring Alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {status.alerts.recent.map((a: any) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-xs">
                  <div>
                    <p className="font-semibold text-foreground">
                      [{String(a.severity || 'info').toUpperCase()}] {a.title}
                    </p>
                    <p className="text-muted-foreground">{a.message}</p>
                  </div>
                  <span className="font-mono text-muted-foreground">{new Date(a.at).toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
