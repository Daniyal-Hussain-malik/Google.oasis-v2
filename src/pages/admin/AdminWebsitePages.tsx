import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from '@mui/material';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Lock,
  Plus,
  RefreshCw,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from '@/src/pages/admin/AdminLayout';
import { ResilientImage } from '@/src/components/guest/ResilientImage';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Switch } from '@/src/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Textarea } from '@/src/components/ui/textarea';
import { ROLE_LABELS, SUPER, useAdminAuth } from '@/src/context/AdminAuthContext';
import { adminApi, adminUploadImage, media, pkr } from '@/src/lib/api';

/* ---------------- 1. Complete Blog & Journal CMS ---------------- */

const BLOG_STATUS_LABEL: Record<string, string> = {
  pending: 'Needs review',
  published: 'Published',
  rejected: 'Declined',
  hidden: 'Hidden',
};

export function AdminBlogPage() {
  const { can } = useAdminAuth();
  const isManager = can(...SUPER);

  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<any | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState('Oasis team');
  const [excerpt, setExcerpt] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (tab !== 'all') qs.set('status', tab);
      if (query.trim()) qs.set('q', query.trim());
      const res = await adminApi<any>(`/admin/blog?${qs.toString()}`);
      setPosts(Array.isArray(res) ? res : res.items || []);
      if (res.counts) setCounts(res.counts);
    } catch (err: any) {
      toast.error(err.message || 'Could not load journal posts');
    }
  }, [tab, query]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing({});
    setTitle('');
    setAuthorName('Oasis team');
    setExcerpt('');
    setBody('');
    setImage('');
  }

  function openPost(post: any) {
    setEditing(post);
    setTitle(post.title || '');
    setAuthorName(post.authorName || 'Oasis team');
    setExcerpt(post.excerpt || '');
    setBody(post.body || '');
    setImage(post.image || '');
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await adminUploadImage(file);
      setImage(res.url);
      toast.success('Photo uploaded');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function savePost(extra: Record<string, unknown> = {}, msg = 'Saved.') {
    setBusy(true);
    try {
      const isNew = !editing?._id && !editing?.id;
      const id = editing?._id || editing?.id;
      await adminApi(isNew ? '/admin/blog' : `/admin/blog/${id}`, {
        method: isNew ? 'POST' : 'PATCH',
        body: { title, body, excerpt, image, authorName, ...extra },
      });
      toast.success(msg);
      setEditing(null);
      setDeclineOpen(false);
      setDeclineReason('');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deletePost() {
    const id = editing?._id || editing?.id;
    if (!id) return;
    setBusy(true);
    try {
      await adminApi(`/admin/blog/${id}`, { method: 'DELETE' });
      toast.success('Post permanently deleted');
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminLayout title="Journal & Blog">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Blog &amp; Guest Stories</h1>
            <p className="text-sm text-muted-foreground">
              Stories sent by checked-out guests and editorial articles from the Oasis team.
            </p>
          </div>
          {isManager && (
            <Button variant="accent" size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              New Blog Post
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">
                Needs review{counts.pending ? ` (${counts.pending})` : ''}
              </TabsTrigger>
              <TabsTrigger value="published">Published</TabsTrigger>
              <TabsTrigger value="rejected">Declined</TabsTrigger>
              <TabsTrigger value="hidden">Hidden</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, author, booking no…"
            className="w-64"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead>Author &amp; Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((p) => (
                  <TableRow key={p._id || p.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openPost(p)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {p.image && (
                          <div className="h-10 w-14 shrink-0 overflow-hidden rounded-md border border-border">
                            <ResilientImage src={media(p.image)} alt={p.title} className="h-full w-full object-cover" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.title}</p>
                          <p className="truncate max-w-md text-xs text-muted-foreground">{p.excerpt}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.authorName || 'Oasis Team'}
                      <span className="block text-xs">
                        {p.source === 'guest' ? `Guest · ${p.bookingNumber}` : 'Team post'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{BLOG_STATUS_LABEL[p.status] || p.status}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm">
                        {p.status === 'pending' ? 'Review' : 'Edit'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {posts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      {tab === 'pending' ? 'No guest stories waiting for review.' : 'No posts in this view.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Blog Editor Modal */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?._id || editing?.id ? editing.title : 'New Blog Post'}</DialogTitle>
            {editing?._id && (
              <DialogDescription>
                {editing.source === 'guest' ? `Guest submission · ${editing.bookingNumber}` : 'Team editorial'} · Status:{' '}
                {BLOG_STATUS_LABEL[editing.status] || editing.status}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} disabled={!isManager} />
              </div>
              <div className="space-y-1.5">
                <Label>Shown Author Name</Label>
                <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} maxLength={80} disabled={!isManager} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Short Summary ({excerpt.length}/300)</Label>
              <Textarea rows={2} maxLength={300} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} disabled={!isManager} />
            </div>
            <div className="space-y-1.5">
              <Label>Story Body ({body.length}/6000)</Label>
              <Textarea rows={8} maxLength={6000} value={body} onChange={(e) => setBody(e.target.value)} disabled={!isManager} />
            </div>
            <div className="space-y-1.5">
              <Label>Photo URL or Upload</Label>
              <div className="flex gap-2">
                <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="/photos/... or /uploads/..." disabled={!isManager} />
                {isManager && (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted">
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? 'Uploading…' : 'Upload'}
                    <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
                  </label>
                )}
              </div>
            </div>

            {isManager && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                <div className="flex flex-wrap gap-2">
                  {(editing?._id || editing?.id) && (
                    <Button type="button" variant="ghost" className="text-destructive" disabled={busy} onClick={deletePost}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  )}
                  {editing?.status === 'published' && (
                    <Button type="button" variant="outline" disabled={busy} onClick={() => savePost({ status: 'hidden' }, 'Hidden from public website')}>
                      Hide
                    </Button>
                  )}
                  {(editing?._id || editing?.id) && editing.status !== 'rejected' && editing.source === 'guest' && (
                    <Button type="button" variant="outline" className="text-destructive" disabled={busy} onClick={() => setDeclineOpen(true)}>
                      Decline…
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                    Close
                  </Button>
                  {!(editing?._id || editing?.id) ? (
                    <Button type="button" variant="accent" disabled={busy || !title.trim() || !body.trim()} onClick={() => savePost({ status: 'published' }, 'Post published!')}>
                      Publish Post
                    </Button>
                  ) : (
                    <>
                      <Button type="button" variant="outline" disabled={busy} onClick={() => savePost({}, 'Changes saved')}>
                        Save Changes
                      </Button>
                      {editing.status !== 'published' && (
                        <Button type="button" variant="accent" disabled={busy} onClick={() => savePost({ status: 'published' }, 'Post approved & published!')}>
                          {editing.status === 'pending' ? 'Approve & Publish' : 'Publish'}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Decline Reason Dialog */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Guest Story?</DialogTitle>
            <DialogDescription>The writer will be sent your explanation by email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              rows={3}
              required
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Kindly explain what needs to change…"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeclineOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={busy || !declineReason.trim()}
                onClick={() => savePost({ status: 'rejected', rejectReason: declineReason.trim() }, 'Story declined and writer notified.')}
              >
                Confirm Decline
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

/* ---------------- 2. Complete Website Content & Settings CMS ---------------- */

const FACILITY_TAGS = ['Included', 'Charged to room', 'Chargeable', 'On request', 'Ask the desk', 'On the grounds'];
const FACILITY_ICONS: Array<[string, string]> = [
  ['water', 'Hot water'],
  ['heat', 'Heating'],
  ['balcony', 'Balcony'],
  ['safe', 'Safe'],
  ['phone', 'Telephone'],
  ['wifi', 'Wi-Fi'],
  ['breakfast', 'Breakfast'],
  ['restaurant', 'Restaurant'],
  ['service', 'Room service'],
  ['minibar', 'Minibar'],
  ['pool', 'Pool'],
  ['jacuzzi', 'Jacuzzi'],
  ['games', 'Games'],
  ['kids', 'Kids'],
  ['court', 'Court'],
  ['parking', 'Parking'],
  ['star', 'General'],
];

const cleanFacility = (x: any) => ({
  ...(x._id ? { _id: x._id } : {}),
  name: x.name,
  detail: x.detail || '',
  group: x.group || 'On the grounds',
  tag: x.tag || 'Included',
  icon: x.icon || 'star',
  active: x.active !== false,
});

const cleanExperience = (x: any) => ({
  ...(x._id ? { _id: x._id } : {}),
  ...(x.slug ? { slug: x.slug } : {}),
  title: x.title,
  kicker: x.kicker || '',
  summary: x.summary || '',
  body: x.body || '',
  image: x.image || '',
  active: x.active !== false,
});

export function AdminSiteSettingsPage() {
  const { can } = useAdminAuth();
  const canEdit = can(...SUPER);

  const [unlockToken, setUnlockToken] = useState('');
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [phonesText, setPhonesText] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeSection, setActiveSection] = useState('homepage');

  // Facility Editor Modal
  const [editFacility, setEditFacility] = useState<any | null>(null);
  // Experience Editor Modal
  const [editExperience, setEditExperience] = useState<any | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const callSettingsApi = useCallback(
    async (path: string, options: { method?: string; body?: unknown } = {}) => {
      try {
        return await adminApi<any>(path, { ...options, unlockToken });
      } catch (err: any) {
        if (/Enter your password/i.test(err?.message || '')) {
          setUnlockToken('');
          setSettings(null);
        }
        throw err;
      }
    },
    [unlockToken],
  );

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setUnlockError('');
    try {
      const res = await adminApi<{ token: string }>('/admin/settings/unlock', {
        method: 'POST',
        body: { password },
      });
      setUnlockToken(res.token);
      setPassword('');
      const data = await adminApi<any>('/admin/settings', { unlockToken: res.token });
      setSettings(data);
      setPhonesText((data.phones || []).join('\n'));
      toast.success('Website Content & Settings unlocked');
    } catch (err: any) {
      const msg = err?.message || 'Invalid password or could not unlock settings';
      setUnlockError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function saveAllSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    try {
      const body = {
        ...settings,
        phones: phonesText.split('\n').map((s) => s.trim()).filter(Boolean),
        taxRate: Number(settings.taxRate || 0),
        maxAdvanceDays: Number(settings.maxAdvanceDays || 365),
        maxNights: Number(settings.maxNights || 30),
        maxRoomsPerBooking: Number(settings.maxRoomsPerBooking || 4),
        activities: (settings.activities || []).map((a: any) => ({
          title: a.title,
          body: a.body || '',
          image: a.image || '',
        })),
        facilities: (settings.facilities || []).map(cleanFacility),
        experiences: (settings.experiences || []).map(cleanExperience),
      };
      const updated = await callSettingsApi('/admin/settings', { method: 'PUT', body });
      setSettings(updated);
      setPhonesText((updated.phones || []).join('\n'));
      toast.success('All website content & settings saved live!');
    } catch (err: any) {
      toast.error(err.message || 'Could not save settings');
    } finally {
      setBusy(false);
    }
  }

  async function uploadCmsImage(file: File, onUrl: (url: string) => void) {
    setUploadingImage(true);
    try {
      const res = await adminUploadImage(file);
      onUrl(res.url);
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingImage(false);
    }
  }

  // Direct Immediate Saves for Facilities & Experiences & Payments
  async function persistFacilities(nextList: any[], msg: string) {
    setBusy(true);
    try {
      const saved = await callSettingsApi('/admin/settings', {
        method: 'PUT',
        body: { facilities: nextList.map(cleanFacility) },
      });
      setSettings((s: any) => ({ ...s, facilities: saved.facilities }));
      setEditFacility(null);
      toast.success(msg);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function persistExperiences(nextList: any[], msg: string) {
    setBusy(true);
    try {
      const saved = await callSettingsApi('/admin/settings', {
        method: 'PUT',
        body: { experiences: nextList.map(cleanExperience) },
      });
      setSettings((s: any) => ({ ...s, experiences: saved.experiences }));
      setEditExperience(null);
      toast.success(msg);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePaymentsOnly() {
    setBusy(true);
    try {
      const saved = await callSettingsApi('/admin/settings', {
        method: 'PUT',
        body: { payments: settings.payments },
      });
      setSettings((s: any) => ({ ...s, payments: saved.payments }));
      toast.success('Payment accounts saved. Website updated immediately.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return (
      <AdminLayout title="Content & Settings">
        <Card className="mx-auto max-w-md mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-accent" />
              Confirm Admin Password
            </CardTitle>
            <CardDescription>
              Enter your Super Admin login password to edit homepage copy, activities, facilities, experiences, payment accounts, hotel details, and booking rules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={unlock} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Super Admin Password</Label>
                <Input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your Super Admin password"
                />
              </div>
              {unlockError && <Alert severity="error">{unlockError}</Alert>}
              <Button type="submit" variant="accent" className="w-full" disabled={busy}>
                <Unlock className="h-4 w-4" />
                {busy ? 'Unlocking…' : 'Unlock Website CMS & Settings'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  const facilityGroups = Array.from(
    new Set((settings.facilities || []).map((f: any) => f.group).filter(Boolean)),
  ) as string[];

  return (
    <AdminLayout title="Content & Settings">
      <form onSubmit={saveAllSettings} className="space-y-6 pb-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Website Content &amp; Full Resort Settings</h1>
            <p className="text-sm text-muted-foreground">
              Full Super Admin CMS control over homepage, activities, facilities, experiences, payments, policies, and booking limits.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setUnlockToken('');
                setSettings(null);
              }}
            >
              <Lock className="h-4 w-4" />
              Lock Settings
            </Button>
            {canEdit && (
              <Button type="submit" variant="accent" size="sm" disabled={busy}>
                <Check className="h-4 w-4" />
                {busy ? 'Saving…' : 'Save All Changes'}
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeSection} onValueChange={setActiveSection}>
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="homepage">Homepage &amp; Activities</TabsTrigger>
            <TabsTrigger value="facilities">Facilities ({(settings.facilities || []).length})</TabsTrigger>
            <TabsTrigger value="experiences">Experiences ({(settings.experiences || []).length})</TabsTrigger>
            <TabsTrigger value="payments">Payment Accounts</TabsTrigger>
            <TabsTrigger value="hotel">Hotel Details &amp; Policies</TabsTrigger>
            <TabsTrigger value="rules">Booking Rules</TabsTrigger>
          </TabsList>

          {/* TAB 1: HOMEPAGE COPY + ACTIVITIES */}
          <TabsContent value="homepage" className="space-y-6 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Homepage Hero</CardTitle>
                <CardDescription>Displayed at the top of the public home page.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Hero Title</Label>
                  <Input
                    disabled={!canEdit}
                    value={settings.heroTitle || ''}
                    onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Hero Subtitle Text</Label>
                  <Textarea
                    rows={3}
                    disabled={!canEdit}
                    value={settings.heroLede || ''}
                    onChange={(e) => setSettings({ ...settings, heroLede: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Activities</CardTitle>
                  <CardDescription>Shown on both the Home Page and the /activities page.</CardDescription>
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        activities: [...(settings.activities || []), { title: '', body: '', image: '' }],
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add Activity
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {(settings.activities || []).map((act: any, idx: number) => (
                  <div key={act._id || idx} className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-[1fr_260px]">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label>Activity Title</Label>
                        <Input
                          required
                          disabled={!canEdit}
                          value={act.title || ''}
                          onChange={(e) => {
                            const next = [...settings.activities];
                            next[idx] = { ...next[idx], title: e.target.value };
                            setSettings({ ...settings, activities: next });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Description</Label>
                        <Textarea
                          rows={3}
                          disabled={!canEdit}
                          value={act.body || ''}
                          onChange={(e) => {
                            const next = [...settings.activities];
                            next[idx] = { ...next[idx], body: e.target.value };
                            setSettings({ ...settings, activities: next });
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      {act.image && (
                        <div className="h-28 overflow-hidden rounded-lg border border-border">
                          <ResilientImage src={media(act.image)} alt={act.title} className="h-full w-full object-cover" />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Input
                          disabled={!canEdit}
                          value={act.image || ''}
                          placeholder="/photos/..."
                          onChange={(e) => {
                            const next = [...settings.activities];
                            next[idx] = { ...next[idx], image: e.target.value };
                            setSettings({ ...settings, activities: next });
                          }}
                        />
                        {canEdit && (
                          <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border px-2.5 text-xs hover:bg-muted">
                            <Upload className="h-3.5 w-3.5" />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                uploadCmsImage(file, (url) => {
                                  const next = [...settings.activities];
                                  next[idx] = { ...next[idx], image: url };
                                  setSettings({ ...settings, activities: next });
                                });
                              }}
                            />
                          </label>
                        )}
                      </div>
                      {canEdit && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              activities: settings.activities.filter((_: any, j: number) => j !== idx),
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove activity
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {(settings.activities || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No activities added yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: FACILITIES CMS */}
          <TabsContent value="facilities" className="space-y-4 pt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Resort Facilities</CardTitle>
                  <CardDescription>
                    Shown on the Home page and /facilities page. Reorder, toggle visibility, or add new amenities.
                  </CardDescription>
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    variant="accent"
                    size="sm"
                    onClick={() =>
                      setEditFacility({
                        _idx: -1,
                        name: '',
                        detail: '',
                        group: facilityGroups[0] || 'On the grounds',
                        tag: 'Included',
                        icon: 'star',
                        active: true,
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add Facility
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {(settings.facilities || []).map((fac: any, idx: number) => (
                    <div
                      key={fac._id || idx}
                      className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 ${
                        fac.active === false ? 'opacity-60 bg-muted/30' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {fac.name}
                          {fac.active === false && <span className="ml-2 text-xs text-muted-foreground">(Hidden)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fac.group} · {fac.tag}
                          {fac.detail ? ` · ${fac.detail}` : ''}
                        </p>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={busy || idx === 0}
                            onClick={() => {
                              const next = [...settings.facilities];
                              const [item] = next.splice(idx, 1);
                              next.splice(idx - 1, 0, item);
                              persistFacilities(next, 'Facility order saved');
                            }}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={busy || idx === settings.facilities.length - 1}
                            onClick={() => {
                              const next = [...settings.facilities];
                              const [item] = next.splice(idx, 1);
                              next.splice(idx + 1, 0, item);
                              persistFacilities(next, 'Facility order saved');
                            }}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              const next = settings.facilities.map((x: any, j: number) =>
                                j === idx ? { ...x, active: x.active === false } : x,
                              );
                              persistFacilities(next, `${fac.name} is now ${fac.active === false ? 'visible' : 'hidden'}`);
                            }}
                          >
                            {fac.active === false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            {fac.active === false ? 'Show' : 'Hide'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditFacility({ ...fac, _idx: idx })}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            disabled={busy}
                            onClick={() =>
                              persistFacilities(
                                settings.facilities.filter((_: any, j: number) => j !== idx),
                                `${fac.name} removed`,
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: EXPERIENCES CMS */}
          <TabsContent value="experiences" className="space-y-4 pt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Resort Experiences</CardTitle>
                  <CardDescription>
                    Powers /experiences list, each /experiences/:slug article page, and Home page highlights.
                  </CardDescription>
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    variant="accent"
                    size="sm"
                    onClick={() =>
                      setEditExperience({
                        _idx: -1,
                        title: '',
                        kicker: '',
                        summary: '',
                        body: '',
                        image: '',
                        active: true,
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add Experience
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {(settings.experiences || []).map((exp: any, idx: number) => (
                    <div
                      key={exp._id || idx}
                      className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 ${
                        exp.active === false ? 'opacity-60 bg-muted/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {exp.image && (
                          <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md border border-border">
                            <ResilientImage src={media(exp.image)} alt={exp.title} className="h-full w-full object-cover" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">
                            {exp.title}
                            {exp.active === false && <span className="ml-2 text-xs text-muted-foreground">(Hidden)</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {exp.kicker ? `${exp.kicker} · ` : ''}
                            {exp.summary}
                          </p>
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={busy || idx === 0}
                            onClick={() => {
                              const next = [...settings.experiences];
                              const [item] = next.splice(idx, 1);
                              next.splice(idx - 1, 0, item);
                              persistExperiences(next, 'Experience order saved');
                            }}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={busy || idx === settings.experiences.length - 1}
                            onClick={() => {
                              const next = [...settings.experiences];
                              const [item] = next.splice(idx, 1);
                              next.splice(idx + 1, 0, item);
                              persistExperiences(next, 'Experience order saved');
                            }}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              const next = settings.experiences.map((x: any, j: number) =>
                                j === idx ? { ...x, active: x.active === false } : x,
                              );
                              persistExperiences(next, `${exp.title} is now ${exp.active === false ? 'visible' : 'hidden'}`);
                            }}
                          >
                            {exp.active === false ? 'Show' : 'Hide'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditExperience({ ...exp, _idx: idx })}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            disabled={busy}
                            onClick={() =>
                              persistExperiences(
                                settings.experiences.filter((_: any, j: number) => j !== idx),
                                `${exp.title} removed`,
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: PAYMENT ACCOUNTS */}
          <TabsContent value="payments" className="pt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Payment Accounts</CardTitle>
                  <CardDescription>
                    Shown to guests on booking confirmation, booking lookup, and food ordering checkout.
                  </CardDescription>
                </div>
                {canEdit && (
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={savePaymentsOnly}>
                    Save Payment Accounts
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-xl border border-border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Easypaisa Account</Label>
                    <Switch
                      disabled={!canEdit}
                      checked={Boolean(settings.payments?.easypaisa?.enabled)}
                      onCheckedChange={(v) =>
                        setSettings({
                          ...settings,
                          payments: {
                            ...settings.payments,
                            easypaisa: { ...settings.payments?.easypaisa, enabled: v },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Account Holder Name</Label>
                      <Input
                        disabled={!canEdit}
                        value={settings.payments?.easypaisa?.accountName || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payments: {
                              ...settings.payments,
                              easypaisa: { ...settings.payments?.easypaisa, accountName: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Easypaisa Number (11 digits, e.g. 03001234567)</Label>
                      <Input
                        disabled={!canEdit}
                        value={settings.payments?.easypaisa?.number || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payments: {
                              ...settings.payments,
                              easypaisa: { ...settings.payments?.easypaisa, number: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Bank Transfer Account</Label>
                    <Switch
                      disabled={!canEdit}
                      checked={Boolean(settings.payments?.bank?.enabled)}
                      onCheckedChange={(v) =>
                        setSettings({
                          ...settings,
                          payments: {
                            ...settings.payments,
                            bank: { ...settings.payments?.bank, enabled: v },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Account Title</Label>
                      <Input
                        disabled={!canEdit}
                        value={settings.payments?.bank?.accountTitle || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payments: {
                              ...settings.payments,
                              bank: { ...settings.payments?.bank, accountTitle: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Bank Name</Label>
                      <Input
                        disabled={!canEdit}
                        value={settings.payments?.bank?.bankName || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payments: {
                              ...settings.payments,
                              bank: { ...settings.payments?.bank, bankName: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Branch / Bank Address</Label>
                      <Input
                        disabled={!canEdit}
                        value={settings.payments?.bank?.branchAddress || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payments: {
                              ...settings.payments,
                              bank: { ...settings.payments?.bank, branchAddress: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Account Number (Digits only)</Label>
                      <Input
                        disabled={!canEdit}
                        value={settings.payments?.bank?.accountNumber || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payments: {
                              ...settings.payments,
                              bank: { ...settings.payments?.bank, accountNumber: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>IBAN (Check-digit verified)</Label>
                      <Input
                        disabled={!canEdit}
                        value={settings.payments?.bank?.iban || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payments: {
                              ...settings.payments,
                              bank: { ...settings.payments?.bank, iban: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>SWIFT Code</Label>
                      <Input
                        disabled={!canEdit}
                        value={settings.payments?.bank?.swift || ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payments: {
                              ...settings.payments,
                              bank: { ...settings.payments?.bank, swift: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Transfer Instructions Shown to Guests</Label>
                  <Textarea
                    rows={2}
                    disabled={!canEdit}
                    value={settings.payments?.instructions || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        payments: { ...settings.payments, instructions: e.target.value },
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: HOTEL DETAILS & POLICIES */}
          <TabsContent value="hotel" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Hotel Identity, Contact &amp; Policies</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Resort Name</Label>
                  <Input disabled={!canEdit} value={settings.name || ''} onChange={(e) => setSettings({ ...settings, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" disabled={!canEdit} value={settings.email || ''} onChange={(e) => setSettings({ ...settings, email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Main Phone</Label>
                  <Input disabled={!canEdit} value={settings.phone || ''} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>WhatsApp (digits only, e.g. 923445537788)</Label>
                  <Input disabled={!canEdit} value={settings.whatsapp || ''} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Other Phones (one per line)</Label>
                  <Textarea rows={2} disabled={!canEdit} value={phonesText} onChange={(e) => setPhonesText(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Address</Label>
                  <Textarea rows={2} disabled={!canEdit} value={settings.address || ''} onChange={(e) => setSettings({ ...settings, address: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Check-in Time</Label>
                  <Input type="time" disabled={!canEdit} value={settings.checkInTime || '14:00'} onChange={(e) => setSettings({ ...settings, checkInTime: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Check-out Time</Label>
                  <Input type="time" disabled={!canEdit} value={settings.checkOutTime || '12:00'} onChange={(e) => setSettings({ ...settings, checkOutTime: e.target.value })} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Hotel Policies (Cancellation, ID &amp; Stay Rules)</Label>
                  <Textarea rows={4} disabled={!canEdit} value={settings.policies || ''} onChange={(e) => setSettings({ ...settings, policies: e.target.value })} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Child &amp; Extra Mattress Policy</Label>
                  <Textarea rows={3} disabled={!canEdit} value={settings.childPolicy || ''} onChange={(e) => setSettings({ ...settings, childPolicy: e.target.value })} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 6: BOOKING RULES */}
          <TabsContent value="rules" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Booking Limits &amp; Room Tax</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label>Room Tax Rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    disabled={!canEdit}
                    value={settings.taxRate ?? 0}
                    onChange={(e) => setSettings({ ...settings, taxRate: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Book Ahead Window (Days)</Label>
                  <Input
                    type="number"
                    min="1"
                    disabled={!canEdit}
                    value={settings.maxAdvanceDays ?? 365}
                    onChange={(e) => setSettings({ ...settings, maxAdvanceDays: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Max Nights / Stay</Label>
                  <Input
                    type="number"
                    min="1"
                    disabled={!canEdit}
                    value={settings.maxNights ?? 30}
                    onChange={(e) => setSettings({ ...settings, maxNights: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Max Rooms / Booking</Label>
                  <Input
                    type="number"
                    min="1"
                    disabled={!canEdit}
                    value={settings.maxRoomsPerBooking ?? 4}
                    onChange={(e) => setSettings({ ...settings, maxRoomsPerBooking: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {canEdit && (
          <div className="sticky bottom-4 z-20 flex items-center justify-end rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
            <Button type="submit" variant="accent" disabled={busy}>
              <Check className="h-4 w-4" />
              {busy ? 'Saving…' : 'Save All Website Content & Settings'}
            </Button>
          </div>
        )}
      </form>

      {/* Facility Editor Dialog */}
      <Dialog open={Boolean(editFacility)} onOpenChange={(open) => !open && setEditFacility(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editFacility?._idx >= 0 ? `Edit ${editFacility.name}` : 'New Facility'}</DialogTitle>
          </DialogHeader>
          {editFacility && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const current = settings.facilities || [];
                const next =
                  editFacility._idx >= 0
                    ? current.map((x: any, j: number) => (j === editFacility._idx ? editFacility : x))
                    : [...current, editFacility];
                persistFacilities(next, `${editFacility.name} saved`);
              }}
              className="space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input required value={editFacility.name} onChange={(e) => setEditFacility({ ...editFacility, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Group</Label>
                  <Input required value={editFacility.group} onChange={(e) => setEditFacility({ ...editFacility, group: e.target.value })} placeholder="On the grounds" />
                </div>
                <div className="space-y-1">
                  <Label>Billing Tag</Label>
                  <Select value={editFacility.tag} onValueChange={(v) => setEditFacility({ ...editFacility, tag: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FACILITY_TAGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Icon</Label>
                  <Select value={editFacility.icon} onValueChange={(v) => setEditFacility({ ...editFacility, icon: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FACILITY_ICONS.map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Detail</Label>
                <Textarea rows={3} maxLength={300} value={editFacility.detail || ''} onChange={(e) => setEditFacility({ ...editFacility, detail: e.target.value })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Show on website</Label>
                <Switch checked={editFacility.active !== false} onCheckedChange={(v) => setEditFacility({ ...editFacility, active: v })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditFacility(null)}>Cancel</Button>
                <Button type="submit" variant="accent" disabled={busy}>Save Facility</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Experience Editor Dialog */}
      <Dialog open={Boolean(editExperience)} onOpenChange={(open) => !open && setEditExperience(null)}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editExperience?._idx >= 0 ? `Edit ${editExperience.title}` : 'New Experience'}</DialogTitle>
          </DialogHeader>
          {editExperience && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const current = settings.experiences || [];
                const next =
                  editExperience._idx >= 0
                    ? current.map((x: any, j: number) => (j === editExperience._idx ? editExperience : x))
                    : [...current, editExperience];
                persistExperiences(next, `${editExperience.title} saved`);
              }}
              className="space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Input required maxLength={100} value={editExperience.title} onChange={(e) => setEditExperience({ ...editExperience, title: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Small Heading (Kicker)</Label>
                  <Input maxLength={60} value={editExperience.kicker || ''} onChange={(e) => setEditExperience({ ...editExperience, kicker: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Short Summary</Label>
                <Textarea rows={2} maxLength={300} value={editExperience.summary || ''} onChange={(e) => setEditExperience({ ...editExperience, summary: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Full Article Description</Label>
                <Textarea rows={6} maxLength={3000} value={editExperience.body || ''} onChange={(e) => setEditExperience({ ...editExperience, body: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-1">
                  <Label>Image URL or Upload</Label>
                  <div className="flex gap-2">
                    <Input value={editExperience.image || ''} onChange={(e) => setEditExperience({ ...editExperience, image: e.target.value })} placeholder="/photos/..." />
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted">
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingImage ? '…' : 'Upload'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          uploadCmsImage(file, (url) => setEditExperience((prev: any) => ({ ...prev, image: url })));
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <Switch checked={editExperience.active !== false} onCheckedChange={(v) => setEditExperience({ ...editExperience, active: v })} />
                  <Label>Show on website</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditExperience(null)}>Cancel</Button>
                <Button type="submit" variant="accent" disabled={busy}>Save Experience</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

/* ---------------- 3. Website Insights & Staff Accounts ---------------- */

export function AdminInsightsPage() {
  const [days, setDays] = useState('30');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi(`/admin/insights?days=${days}`);
      setData(res);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const totalViews = data?.counts?.view ?? 0;

  return (
    <AdminLayout title="Website Insights">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Visitor Behaviour &amp; Funnel</h1>
            <p className="text-sm text-muted-foreground">
              Page views, room interest, booking drop-off rate, and exit feedback.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="180">Last 180 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">{days}d Page Views</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{data ? totalViews : '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">Unique Sessions</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{data?.sessions ?? '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">Website Bookings / Conversion</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                {data ? `${data.bookings} (${data.conversion}%)` : '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">Booking Form Drop Rate</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                {data ? `${data.bookingDropRate}%` : '—'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-lg">Top Pages Viewed</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Path</TableHead><TableHead className="text-right">Views</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data?.topPages || []).map((p: any) => (
                    <TableRow key={p._id}>
                      <TableCell className="font-mono text-sm">{p._id}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{p.views}</TableCell>
                    </TableRow>
                  ))}
                  {(!data?.topPages || data.topPages.length === 0) && (
                    <TableRow><TableCell colSpan={2} className="py-6 text-center text-muted-foreground">No page view data yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Most Viewed Room Categories</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Room Category</TableHead><TableHead className="text-right">Views</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data?.rooms || []).map((r: any) => (
                    <TableRow key={r._id}>
                      <TableCell className="text-sm font-medium">{r._id}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{r.views}</TableCell>
                    </TableRow>
                  ))}
                  {(!data?.rooms || data.rooms.length === 0) && (
                    <TableRow><TableCell colSpan={2} className="py-6 text-center text-muted-foreground">No room category views recorded yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Visitor Exit Reasons</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Reason</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data?.exitReasons || []).map((er: any) => (
                  <TableRow key={er.reason}>
                    <TableCell className="font-medium capitalize">{String(er.reason || 'other').replaceAll('_', ' ')}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{(er.notes || []).join(' · ') || '—'}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{er.count}</TableCell>
                  </TableRow>
                ))}
                {(!data?.exitReasons || data.exitReasons.length === 0) && (
                  <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">No exit feedback recorded in this window.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

const ROLE_CARDS = [
  {
    role: 'Super Admin',
    desc: 'Full control over rates, Website CMS, staff logins, refunds, night audit, folio reversals, and restaurant settings.',
  },
  {
    role: 'Front Desk',
    desc: 'Check-ins, check-outs, walk-in bookings, guest enquiries, payment proof verification, and restaurant POS.',
  },
  {
    role: 'Kitchen Chef',
    desc: 'Real-time Kitchen Display (KDS), KOT ticket progression, and the 86 / Sold-Out board.',
  },
];

export function AdminUsersPage() {
  const { user: currentUser } = useAdminAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('frontdesk');
  const [editPassword, setEditPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi<any>('/admin/users')
      .then((res) => setUsers(Array.isArray(res) ? res : res.items || []))
      .catch((err) => toast.error(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await adminApi('/admin/users', { method: 'POST', body: { name, email, password, role } });
      setName('');
      setEmail('');
      setPassword('');
      setCreating(false);
      toast.success('Staff account created');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      const id = editing._id || editing.id;
      const body: Record<string, unknown> = {
        name: editing.name,
        role: editing.role,
      };
      if (editPassword.trim()) body.password = editPassword.trim();
      await adminApi(`/admin/users/${id}`, { method: 'PATCH', body });
      toast.success('Staff account updated');
      setEditing(null);
      setEditPassword('');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi(`/admin/users/${deleteTarget._id || deleteTarget.id}`, { method: 'DELETE' });
      toast.success('Staff account deleted');
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(id: string | number, currentActive: boolean) {
    try {
      await adminApi(`/admin/users/${id}`, { method: 'PATCH', body: { active: !currentActive } });
      toast.success('Staff status updated');
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <AdminLayout title="Staff Accounts">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold">Team &amp; Permissions</h1>
            <p className="text-sm text-muted-foreground">{users.length} staff logins</p>
          </div>
          <Button variant="accent" size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Add Staff Account
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {ROLE_CARDS.map((rc) => (
            <Card key={rc.role}>
              <CardContent className="p-4 space-y-1">
                <p className="text-sm font-semibold">{rc.role}</p>
                <p className="text-xs text-muted-foreground">{rc.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const id = u._id || u.id;
                  const isSelf = String(id) === String(currentUser?.id ?? (currentUser as any)?._id ?? '');
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">
                        {u.name}
                        {isSelf && <span className="ml-2 text-xs text-accent">(You)</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{u.email}</TableCell>
                      <TableCell className="text-sm">{ROLE_LABELS[u.role] || u.role}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                      </TableCell>
                      <TableCell>
                        <Switch
                          disabled={isSelf}
                          checked={u.active !== false}
                          onCheckedChange={() => toggleActive(id, u.active !== false)}
                        />
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditPassword('');
                            setEditing({ ...u });
                          }}
                        >
                          Edit
                        </Button>
                        {!isSelf && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setDeleteTarget(u)}
                            aria-label={`Delete ${u.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Staff Account</DialogTitle></DialogHeader>
          <form onSubmit={addStaff} className="space-y-4">
            <div className="space-y-1.5"><Label>Full Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Temporary Password (min 8 chars)</Label><Input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="frontdesk">Front Desk</SelectItem>
                  <SelectItem value="chef">Kitchen Chef</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              <Button type="submit" variant="accent" disabled={busy}>Create Account</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.name}</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          {editing && (
            <form onSubmit={saveEdit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={editing.role} onValueChange={(v) => setEditing({ ...editing, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="frontdesk">Front Desk</SelectItem>
                    <SelectItem value="chef">Kitchen Chef</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Reset Password (leave blank to keep current)</Label>
                <Input
                  type="password"
                  minLength={8}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Min 8 characters if changing"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" variant="accent" disabled={busy}>Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Staff Account?</DialogTitle>
            <DialogDescription>
              Delete login for {deleteTarget?.name} ({deleteTarget?.email})? They will immediately lose portal access.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={confirmDelete}>
              {busy ? 'Removing…' : 'Delete Account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
