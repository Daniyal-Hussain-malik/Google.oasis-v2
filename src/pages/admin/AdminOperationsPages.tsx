import React, { useCallback, useEffect, useState } from 'react';
import { Rating } from '@mui/material';
import { Check, Plus, RefreshCw, Send, Trash2, Upload, X } from 'lucide-react';
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
import { Textarea } from '@/src/components/ui/textarea';
import { SUPER, useAdminAuth } from '@/src/context/AdminAuthContext';
import { adminApi, adminUploadImage, media, pkr } from '@/src/lib/api';

export function AdminPaymentProofsPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [status, setStatus] = useState('pending');
  const [rejectItem, setRejectItem] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    try {
      const qs = status === 'all' ? '' : `?status=${status}`;
      const res = await adminApi<{ items?: any[] } | any[]>(`/admin/payment-claims${qs}`);
      setClaims(Array.isArray(res) ? res : res.items || []);
    } catch (err: any) {
      toast.error(err.message || 'Could not load payment proofs');
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmClaim(id: string | number) {
    try {
      await adminApi(`/admin/payment-claims/${id}/confirm`, { method: 'POST' });
      toast.success('Payment verified and posted to folio');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not confirm payment');
    }
  }

  async function rejectClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectItem) return;
    try {
      await adminApi(`/admin/payment-claims/${rejectItem._id || rejectItem.id}/reject`, {
        method: 'POST',
        body: { reason: rejectReason.trim() || 'Transaction ID could not be matched' },
      });
      setRejectItem(null);
      setRejectReason('');
      toast.success('Payment proof rejected');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not reject');
    }
  }

  return (
    <AdminLayout title="Payment Proofs">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">Transfer & Easypaisa Proofs</h1>
            <p className="text-sm text-muted-foreground">Verify bank & wallet Transaction IDs before crediting guest folios.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Channel & TID</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No payment proofs in this queue.
                    </TableCell>
                  </TableRow>
                ) : (
                  claims.map((c) => {
                    const id = c._id || c.id;
                    return (
                      <TableRow key={id}>
                        <TableCell className="font-mono text-xs font-medium">{c.targetLabel || c.bookingNumber || c.orderNumber}</TableCell>
                        <TableCell>
                          <p className="text-xs font-medium capitalize">{c.method?.replaceAll('_', ' ')}</p>
                          <p className="font-mono text-xs text-muted-foreground">{c.reference}</p>
                          {c.proofImageUrl && (
                            <a
                              href={media(c.proofImageUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-medium text-accent underline"
                            >
                              View Receipt
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{c.senderName || '—'}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">{pkr(c.amount)}</TableCell>
                        <TableCell className="text-xs capitalize">{c.status}</TableCell>
                        <TableCell className="text-right">
                          {c.status === 'pending' ? (
                            <div className="inline-flex gap-1.5">
                              <Button size="sm" variant="accent" onClick={() => confirmClaim(id)}>
                                <Check className="h-3.5 w-3.5" /> Confirm
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setRejectItem(c)}>
                                <X className="h-3.5 w-3.5" /> Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">{c.rejectReason || 'Processed'}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(rejectItem)} onOpenChange={(o) => !o && setRejectItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Payment Proof</DialogTitle>
            <DialogDescription>Provide a short reason so the guest can re-submit a corrected TID.</DialogDescription>
          </DialogHeader>
          <form onSubmit={rejectClaim} className="space-y-4">
            <Input required value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Amount mismatch or TID not found" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRejectItem(null)}>Cancel</Button>
              <Button type="submit" variant="destructive">Reject Proof</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

export function AdminEnquiriesPage() {
  const { can } = useAdminAuth();
  const [items, setItems] = useState<any[]>([]);
  const [replyTarget, setReplyTarget] = useState<any | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi<any[]>('/admin/enquiries')
      .then(setItems)
      .catch((err) => toast.error(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyTarget) return;
    setBusy(true);
    try {
      await adminApi(`/admin/enquiries/${replyTarget._id}/reply`, {
        method: 'POST',
        body: { message: replyBody.trim() },
      });
      toast.success('Reply sent to guest');
      setReplyTarget(null);
      setReplyBody('');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Reply failed');
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(id: string | number, status: string) {
    try {
      await adminApi(`/admin/enquiries/${id}`, { method: 'PATCH', body: { status } });
      toast.success(`Enquiry marked ${status}`);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not update status');
    }
  }

  async function confirmRemove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi(`/admin/enquiries/${deleteTarget._id}`, { method: 'DELETE' });
      toast.success('Enquiry removed');
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminLayout title="Enquiries">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-semibold">Guest Enquiries &amp; Messages</h1>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>
        </div>

        <div className="space-y-4">
          {items.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No enquiries logged yet.</CardContent></Card>
          ) : (
            items.map((item) => (
              <Card key={item._id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-accent">{item.topic} · {item.status}</p>
                      <CardTitle className="text-base">{item.name} ({item.email})</CardTitle>
                      {item.phone && <CardDescription>{item.phone}</CardDescription>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={item.status || 'new'} onValueChange={(v) => updateStatus(item._id, v)}>
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="replied">Replied</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReplyTarget(item);
                          setReplyBody(item.reply || '');
                        }}
                      >
                        <Send className="h-3.5 w-3.5" /> Reply
                      </Button>
                      {can(...SUPER) && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(item)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>{item.message}</p>
                  {item.reply && (
                    <div className="rounded-lg bg-secondary/50 p-3 text-xs text-foreground space-y-1">
                      <p><span className="font-semibold">Desk Reply:</span> {item.reply}</p>
                      {item.replyDelivery?.status && (
                        <p className="text-muted-foreground">
                          Delivery: <span className="capitalize font-medium">{item.replyDelivery.status}</span>
                          {item.replyDelivery.sentTo ? ` → ${item.replyDelivery.sentTo}` : ''}
                          {item.replyDelivery.failure ? ` (${item.replyDelivery.failure})` : ''}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={Boolean(replyTarget)} onOpenChange={(o) => !o && setReplyTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to {replyTarget?.name}</DialogTitle>
            <DialogDescription>{replyTarget?.email}</DialogDescription>
          </DialogHeader>
          <form onSubmit={sendReply} className="space-y-4">
            <Textarea required rows={5} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Write your response from the Oasis Skardu front desk..." />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setReplyTarget(null)}>Cancel</Button>
              <Button type="submit" variant="accent" disabled={busy}>{busy ? 'Sending…' : 'Send Reply'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Enquiry?</DialogTitle>
            <DialogDescription>
              Remove the message from {deleteTarget?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={confirmRemove}>
              {busy ? 'Removing…' : 'Delete Enquiry'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

export function AdminFeedbackPage() {
  const { can } = useAdminAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adminApi<any[]>('/admin/feedback')
      .then(setItems)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublish(item: any, published: boolean) {
    try {
      await adminApi(`/admin/feedback/${item._id}`, { method: 'PATCH', body: { published } });
      toast.success(published ? 'Review published to website' : 'Review hidden');
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <AdminLayout title="Guest Feedback">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Guest Ratings &amp; Feedback</h1>
            <p className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? 'submission' : 'submissions'} from the home page &amp; checked-out stays.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {items.length === 0 && !loading ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No guest feedback recorded yet. Submissions from the Home page Guest Feedback form appear here automatically.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) => {
              const isHomePage = !item.bookingNumber || item.bookingNumber === 'HOMEPAGE';
              const createdLabel = item.createdAt
                ? new Date(item.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
                : '';

              return (
                <Card key={item._id}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground">{item.guestName}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">
                            {isHomePage ? 'Home Page Feedback' : `Booking ${item.bookingNumber}`}
                          </span>
                          {item.stayTitle ? ` · ${item.stayTitle}` : ''}
                          {createdLabel ? ` · ${createdLabel}` : ''}
                        </p>
                        {item.email && (
                          <p className="text-xs text-muted-foreground">{item.email}</p>
                        )}
                      </div>
                      <Rating value={item.rating} readOnly size="small" />
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/90">{item.comment || 'No written comment'}</p>
                    {can(...SUPER) && (
                      <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                        <span className="text-muted-foreground">
                          {item.published ? 'Published on Guest Reviews & Home page' : 'Pending approval · Hidden from public site'}
                        </span>
                        <Switch checked={Boolean(item.published)} onCheckedChange={(v) => togglePublish(item, v)} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export function AdminRoomTypesPage() {
  const { can } = useAdminAuth();
  const [types, setTypes] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [galleryInput, setGalleryInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi<any[]>('/admin/room-types').then(setTypes).catch((err) => toast.error(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openEditor(rt: any | null) {
    setGalleryInput('');
    if (!rt) {
      setEditing({
        name: '',
        slug: '',
        bed: 'King bed',
        size: '320 sq ft',
        maxAdults: 2,
        maxChildren: 2,
        baseRate: 18000,
        weekendRate: 21000,
        sortOrder: 0,
        description: '',
        image: '',
        gallery: [],
        amenitiesText: '',
        active: true,
      });
    } else {
      setEditing({
        ...rt,
        sortOrder: rt.sortOrder ?? 0,
        gallery: Array.isArray(rt.gallery) ? rt.gallery : [],
        amenitiesText: Array.isArray(rt.amenities) ? rt.amenities.join('\n') : '',
      });
    }
  }

  async function saveType(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      const amenities = String(editing.amenitiesText || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        name: editing.name,
        slug: editing.slug,
        bed: editing.bed,
        size: editing.size,
        maxAdults: Number(editing.maxAdults),
        maxChildren: Number(editing.maxChildren),
        baseRate: Number(editing.baseRate),
        weekendRate: Number(editing.weekendRate),
        sortOrder: Number(editing.sortOrder || 0),
        description: editing.description,
        image: editing.image || '',
        gallery: Array.isArray(editing.gallery) ? editing.gallery.filter(Boolean) : [],
        amenities,
        active: editing.active !== false,
      };
      if (editing._id) {
        await adminApi(`/admin/room-types/${editing._id}`, { method: 'PATCH', body: payload });
      } else {
        await adminApi('/admin/room-types', { method: 'POST', body: payload });
      }
      toast.success('Room type saved');
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeType() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi(`/admin/room-types/${deleteTarget._id}`, { method: 'DELETE' });
      toast.success('Room category removed');
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not remove category');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminLayout title="Room Types">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-semibold">Room Categories &amp; Rates</h1>
          {can(...SUPER) && (
            <Button variant="accent" size="sm" onClick={() => openEditor(null)}>
              <Plus className="h-4 w-4" /> Add Category
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Bed / Size</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead className="text-right">Weekday Rate</TableHead>
                  <TableHead className="text-right">Weekend Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((rt) => (
                  <TableRow key={rt._id}>
                    <TableCell className="font-medium">
                      {rt.name}
                      {rt.active === false && <span className="ml-2 text-xs text-muted-foreground">(Hidden)</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{rt.bed} · {rt.size}</TableCell>
                    <TableCell className="text-xs tabular-nums">{rt.maxAdults}A / {rt.maxChildren}C</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">{pkr(rt.baseRate)}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">{pkr(rt.weekendRate)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {can(...SUPER) && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openEditor(rt)}>Edit</Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setDeleteTarget(rt)}
                            aria-label={`Delete ${rt.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?._id ? `Edit ${editing.name}` : 'New Room Category'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={saveType} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Name</Label><Input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div className="space-y-1"><Label>Slug</Label><Input required value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
                <div className="space-y-1"><Label>Base Rate (PKR)</Label><Input type="number" required value={editing.baseRate} onChange={(e) => setEditing({ ...editing, baseRate: e.target.value })} /></div>
                <div className="space-y-1"><Label>Weekend Rate (PKR)</Label><Input type="number" required value={editing.weekendRate} onChange={(e) => setEditing({ ...editing, weekendRate: e.target.value })} /></div>
                <div className="space-y-1"><Label>Max Adults</Label><Input type="number" min="1" required value={editing.maxAdults} onChange={(e) => setEditing({ ...editing, maxAdults: e.target.value })} /></div>
                <div className="space-y-1"><Label>Max Children</Label><Input type="number" min="0" required value={editing.maxChildren} onChange={(e) => setEditing({ ...editing, maxChildren: e.target.value })} /></div>
                <div className="space-y-1"><Label>Bed</Label><Input value={editing.bed} onChange={(e) => setEditing({ ...editing, bed: e.target.value })} /></div>
                <div className="space-y-1"><Label>Size</Label><Input value={editing.size} onChange={(e) => setEditing({ ...editing, size: e.target.value })} /></div>
                <div className="space-y-1"><Label>Display Order</Label><Input type="number" value={editing.sortOrder ?? 0} onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value })} /></div>
              </div>
              <div className="space-y-1">
                <Label>Main Photo URL or Upload</Label>
                <div className="flex gap-2">
                  <Input value={editing.image || ''} onChange={(e) => setEditing({ ...editing, image: e.target.value })} placeholder="/photos/..." />
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted">
                    <Upload className="h-3.5 w-3.5" />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const res = await adminUploadImage(file);
                          setEditing((prev: any) => ({ ...prev, image: res.url }));
                          toast.success('Room photo uploaded');
                        } catch (err: any) {
                          toast.error(err.message);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Gallery Photos ({(editing.gallery || []).length})</Label>
                <div className="flex gap-2">
                  <Input
                    value={galleryInput}
                    onChange={(e) => setGalleryInput(e.target.value)}
                    placeholder="Add gallery URL (/photos/...)"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const val = galleryInput.trim();
                      if (!val) return;
                      setEditing((prev: any) => ({ ...prev, gallery: [...(prev.gallery || []), val] }));
                      setGalleryInput('');
                    }}
                  >
                    Add
                  </Button>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted">
                    <Upload className="h-3.5 w-3.5" />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const res = await adminUploadImage(file);
                          setEditing((prev: any) => ({ ...prev, gallery: [...(prev.gallery || []), res.url] }));
                          toast.success('Gallery photo added');
                        } catch (err: any) {
                          toast.error(err.message);
                        }
                      }}
                    />
                  </label>
                </div>
                {(editing.gallery || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {editing.gallery.map((url: string, idx: number) => (
                      <div key={`${url}-${idx}`} className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                        <span className="max-w-[160px] truncate">{url}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditing((prev: any) => ({
                              ...prev,
                              gallery: prev.gallery.filter((_: string, j: number) => j !== idx),
                            }))
                          }
                          className="text-muted-foreground hover:text-destructive cursor-pointer"
                          aria-label="Remove gallery photo"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label>Amenities (one per line)</Label>
                <Textarea
                  rows={3}
                  value={editing.amenitiesText || ''}
                  onChange={(e) => setEditing({ ...editing, amenitiesText: e.target.value })}
                  placeholder={'King bed\nPrivate terrace\n24-hour hot water'}
                />
              </div>
              <div className="space-y-1"><Label>Description</Label><Textarea rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="flex items-center justify-between pt-1">
                <Label>Visible on Public Website</Label>
                <Switch checked={editing.active !== false} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" variant="accent" disabled={busy}>{busy ? 'Saving…' : 'Save Category'}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>
              Categories with assigned rooms cannot be deleted until rooms are moved or removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={removeType}>
              {busy ? 'Deleting…' : 'Delete Category'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

export function AdminRoomsPage() {
  const { can } = useAdminAuth();
  const isManager = can(...SUPER);
  const [rooms, setRooms] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [newNo, setNewNo] = useState('');
  const [newFloor, setNewFloor] = useState('');
  const [newType, setNewType] = useState('');
  const [editingRoom, setEditingRoom] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [r, t] = await Promise.all([adminApi<any[]>('/admin/rooms'), adminApi<any[]>('/admin/room-types')]);
    setRooms(r);
    setTypes(t);
    if (t[0] && !newType) setNewType(String(t[0]._id));
  }, [newType]);

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function patchRoom(room: any, body: Record<string, unknown>, label: string) {
    try {
      await adminApi(`/admin/rooms/${room._id}`, { method: 'PATCH', body });
      toast.success(label);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function addRoom(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await adminApi('/admin/rooms', {
        method: 'POST',
        body: { roomNo: newNo.trim(), floor: newFloor.trim(), roomType: Number(newType) || newType },
      });
      setNewNo('');
      setNewFloor('');
      toast.success('Room added');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveRoomModal(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRoom) return;
    setBusy(true);
    try {
      await adminApi(`/admin/rooms/${editingRoom._id}`, {
        method: 'PATCH',
        body: {
          ...(isManager
            ? {
                roomNo: editingRoom.roomNo,
                roomType: Number(editingRoom.roomTypeId) || editingRoom.roomTypeId,
                floor: editingRoom.floor || '',
                status: editingRoom.status,
              }
            : {}),
          housekeeping: editingRoom.housekeeping,
          notes: editingRoom.notes || '',
        },
      });
      toast.success(`Room ${editingRoom.roomNo} updated`);
      setEditingRoom(null);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteRoom() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi(`/admin/rooms/${deleteTarget._id}`, { method: 'DELETE' });
      toast.success(`Room ${deleteTarget.roomNo} removed`);
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not remove room');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminLayout title="Rooms Inventory">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-semibold">Huts &amp; Rooms Inventory</h1>
          {isManager && (
            <form onSubmit={addRoom} className="flex flex-wrap items-center gap-2">
              <Input className="w-24" required placeholder="Room #" value={newNo} onChange={(e) => setNewNo(e.target.value)} />
              <Input className="w-28" placeholder="Wing / Floor" value={newFloor} onChange={(e) => setNewFloor(e.target.value)} />
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => <SelectItem key={t._id} value={String(t._id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="submit" variant="accent" size="sm" disabled={busy}>Add Room</Button>
            </form>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room #</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Housekeeping</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell className="font-mono font-semibold">
                      {r.roomNo}
                      {r.floor && <span className="block font-sans text-xs font-normal text-muted-foreground">{r.floor}</span>}
                    </TableCell>
                    <TableCell>{r.roomType?.name || '—'}</TableCell>
                    <TableCell>
                      <Select
                        value={r.housekeeping || 'clean'}
                        onValueChange={(v) => patchRoom(r, { housekeeping: v }, `Room ${r.roomNo} marked ${v}`)}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clean">Clean</SelectItem>
                          <SelectItem value="dirty">Dirty</SelectItem>
                          <SelectItem value="inspected">Inspected</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{r.notes || '—'}</TableCell>
                    <TableCell>
                      <Select
                        disabled={!isManager}
                        value={r.status || 'active'}
                        onValueChange={(v) => patchRoom(r, { status: v }, `Room ${r.roomNo} marked ${v.replaceAll('_', ' ')}`)}
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="out_of_order">Out of Order</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEditingRoom({
                            ...r,
                            roomTypeId: String(r.roomType?._id || r.roomType || ''),
                          })
                        }
                      >
                        Edit
                      </Button>
                      {isManager && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setDeleteTarget(r)}
                          aria-label={`Delete Room ${r.roomNo}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(editingRoom)} onOpenChange={(o) => !o && setEditingRoom(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Room {editingRoom?.roomNo}</DialogTitle>
          </DialogHeader>
          {editingRoom && (
            <form onSubmit={saveRoomModal} className="space-y-3">
              {isManager && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Room #</Label>
                      <Input required value={editingRoom.roomNo} onChange={(e) => setEditingRoom({ ...editingRoom, roomNo: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Wing / Floor</Label>
                      <Input value={editingRoom.floor || ''} onChange={(e) => setEditingRoom({ ...editingRoom, floor: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Select value={editingRoom.roomTypeId} onValueChange={(v) => setEditingRoom({ ...editingRoom, roomTypeId: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {types.map((t) => <SelectItem key={t._id} value={String(t._id)}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Housekeeping</Label>
                  <Select value={editingRoom.housekeeping || 'clean'} onValueChange={(v) => setEditingRoom({ ...editingRoom, housekeeping: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clean">Clean</SelectItem>
                      <SelectItem value="dirty">Dirty</SelectItem>
                      <SelectItem value="inspected">Inspected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isManager && (
                  <div className="space-y-1">
                    <Label>Inventory Status</Label>
                    <Select value={editingRoom.status || 'active'} onValueChange={(v) => setEditingRoom({ ...editingRoom, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="out_of_order">Out of Order</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label>Room Notes</Label>
                <Textarea rows={2} value={editingRoom.notes || ''} onChange={(e) => setEditingRoom({ ...editingRoom, notes: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingRoom(null)}>Cancel</Button>
                <Button type="submit" variant="accent" disabled={busy}>Save Room</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Room {deleteTarget?.roomNo}?</DialogTitle>
            <DialogDescription>
              Rooms with booking history cannot be deleted; mark them Out of Order instead.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={confirmDeleteRoom}>
              {busy ? 'Deleting…' : 'Delete Room'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
