import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Drawer, LinearProgress } from '@mui/material';
import {
  Ban,
  Check,
  ChefHat,
  Clock,
  Minus,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  Upload,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  X,
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
import { Separator } from '@/src/components/ui/separator';
import { Switch } from '@/src/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Textarea } from '@/src/components/ui/textarea';
import { SUPER, useAdminAuth } from '@/src/context/AdminAuthContext';
import { adminApi, adminUploadImage, API, getAdminToken, media, pkr, pretty, todayISO, addDays } from '@/src/lib/api';

function playKitchenChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    /* ignore autoplay block */
  }
}

function minutesSince(dateStr?: string): number {
  if (!dateStr) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000));
}

function orderTypeLabel(type?: string): string {
  if (type === 'dine_in') return 'Dine-in';
  if (type === 'room_service') return 'Room Service';
  if (type === 'takeaway') return 'Takeaway';
  return type || 'Order';
}

/* ---------------- 1. Restaurant Overview ---------------- */

export function RestaurantOverviewPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi<any>('/admin/restaurant/overview');
      setData(res);
    } catch (err: any) {
      toast.error(err.message || 'Could not load restaurant overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminLayout title="Restaurant Overview">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Dining & Kitchen Today</h1>
            <p className="text-sm text-muted-foreground">
              Business date <span className="font-mono">{data?.businessDate || todayISO()}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/restaurant/kitchen">
                <ChefHat className="h-4 w-4" />
                Kitchen Display
              </Link>
            </Button>
            <Button asChild variant="accent" size="sm">
              <Link to="/admin/restaurant/pos">
                <Plus className="h-4 w-4" />
                New POS Order
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Today Orders</p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{data?.orders ?? '—'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data?.openTotal || 0} active · {data?.kotsInProgress || 0} KOTs cooking
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Gross Sales</p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{data ? pkr(data.sales) : '—'}</p>
              <p className="mt-1 text-xs text-muted-foreground">Direct + Room service</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Room Charges</p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">
                {data ? pkr(data.roomCharges) : '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Posted to guest folios</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Collected / Due</p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {data ? pkr(data.collected) : '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data?.unpaidOrders || 0} unpaid ({data ? pkr(data.unpaidAmount) : 'PKR 0'})
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="text-lg">Top Dishes Today</CardTitle>
              <CardDescription>Most ordered kitchen items on {data?.businessDate || todayISO()}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dish</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.topItems || []).map((item: any) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium">{item._id}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{pkr(item.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {(!data?.topItems || data.topItems.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        No dish sales recorded today yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Orders</CardTitle>
                <CardDescription>Latest dining tickets from till and guests</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/restaurant/orders">View All</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.recent || []).map((o: any) => (
                    <TableRow key={o._id || o.id}>
                      <TableCell className="font-mono font-medium">
                        {o.orderNumber}
                        <span className="block text-xs font-sans text-muted-foreground">{orderTypeLabel(o.type)}</span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {o.roomNo ? `Room ${o.roomNo}` : o.table ? `Table ${o.table}` : o.guestName || 'Counter'}
                        {o.guestName && (o.roomNo || o.table) && (
                          <span className="block text-xs text-muted-foreground">{o.guestName}</span>
                        )}
                      </TableCell>
                      <TableCell className="capitalize text-sm">{o.status}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{pkr(o.total)}</TableCell>
                    </TableRow>
                  ))}
                  {(!data?.recent || data.recent.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No restaurant orders yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

/* ---------------- 2. POS / New Order ---------------- */

interface PosCartLine {
  key: string;
  menuItemId: string;
  name: string;
  variationId?: string;
  variationName?: string;
  addOnIds: string[];
  addOnNames: string[];
  unitPrice: number;
  quantity: number;
  note: string;
}

export function RestaurantPOSPage() {
  const [board, setBoard] = useState<{ categories: any[]; items: any[]; rates: { tax: number; service: number } }>({
    categories: [],
    items: [],
    rates: { tax: 0, service: 0 },
  });
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<PosCartLine[]>([]);

  const [orderType, setOrderType] = useState<'dine_in' | 'room_service' | 'takeaway'>('dine_in');
  const [paymentMode, setPaymentMode] = useState<'pay_now' | 'room_charge'>('pay_now');
  const [table, setTable] = useState('');
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // In-house guest lookup
  const [guestSearch, setGuestSearch] = useState('');
  const [inHouseGuests, setInHouseGuests] = useState<any[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<any | null>(null);
  const [roomNo, setRoomNo] = useState('');

  // Optional immediate payment
  const [collectNow, setCollectNow] = useState(false);
  const [payMethod, setPayMethod] = useState('cash');
  const [payRef, setPayRef] = useState('');

  // Dish customization dialog
  const [pickItem, setPickItem] = useState<any | null>(null);
  const [pickVarId, setPickVarId] = useState('');
  const [pickAddOnIds, setPickAddOnIds] = useState<string[]>([]);
  const [pickNote, setPickNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [receiptResult, setReceiptResult] = useState<any | null>(null);

  const loadBoard = useCallback(async () => {
    try {
      const res = await adminApi<any>('/admin/restaurant/board');
      setBoard(res);
    } catch (err: any) {
      toast.error(err.message || 'Could not load POS menu');
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    const timer = setTimeout(() => {
      adminApi<any[]>(`/admin/restaurant/guests?q=${encodeURIComponent(guestSearch.trim())}`)
        .then((res) => setInHouseGuests(Array.isArray(res) ? res : []))
        .catch(() => {});
    }, 220);
    return () => clearTimeout(timer);
  }, [guestSearch]);

  const categories = useMemo(
    () => ['All', ...board.categories.map((c) => c.name)],
    [board.categories],
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return board.items.filter((item) => {
      if (category !== 'All' && item.category !== category) return false;
      if (q && !`${item.name} ${item.category} ${item.description || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [board.items, category, query]);

  function openDishOrAdd(item: any) {
    if (!item.available) {
      toast.error(`${item.name} is currently marked sold out`);
      return;
    }
    const vars = item.variations || [];
    const adds = item.addOns || [];
    if (vars.length > 0 || adds.length > 0) {
      setPickItem(item);
      setPickVarId(vars[0]?._id || vars[0]?.id ? String(vars[0]._id || vars[0].id) : '');
      setPickAddOnIds([]);
      setPickNote('');
      return;
    }
    pushToCart(item, undefined, [], '');
  }

  function pushToCart(item: any, variation: any | undefined, addOns: any[], note: string) {
    const base = variation ? Number(variation.price) : Number(item.price || 0);
    const addTotal = addOns.reduce((s, a) => s + Number(a.price || 0), 0);
    const unitPrice = base + addTotal;
    const varId = variation ? String(variation._id || variation.id) : undefined;
    const addIds = addOns.map((a) => String(a._id || a.id)).sort();
    const key = `${item._id || item.id}|${varId || ''}|${addIds.join(',')}|${note.trim()}`;

    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          key,
          menuItemId: String(item._id || item.id),
          name: item.name,
          variationId: varId,
          variationName: variation?.name,
          addOnIds: addIds,
          addOnNames: addOns.map((a) => a.name),
          unitPrice,
          quantity: 1,
          note: note.trim(),
        },
      ];
    });
  }

  function confirmPickDish(e: React.FormEvent) {
    e.preventDefault();
    if (!pickItem) return;
    const variation = (pickItem.variations || []).find((v: any) => String(v._id || v.id) === pickVarId);
    const addOns = (pickItem.addOns || []).filter((a: any) => pickAddOnIds.includes(String(a._id || a.id)));
    pushToCart(pickItem, variation, addOns, pickNote);
    setPickItem(null);
  }

  function updateQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0), [cart]);
  const taxAmount = Math.round(subtotal * ((board.rates?.tax || 0) / 100));
  const serviceAmount = Math.round(subtotal * ((board.rates?.service || 0) / 100));
  const grandTotal = subtotal + taxAmount + serviceAmount;

  async function placeOrder() {
    if (!cart.length) {
      toast.error('Add at least one dish to place an order.');
      return;
    }
    if (paymentMode === 'room_charge' && !selectedGuest) {
      toast.error('Select a checked-in guest reservation to charge the room.');
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        type: orderType,
        paymentMode,
        items: cart.map((l) => ({
          menuItemId: l.menuItemId,
          ...(l.variationId ? { variationId: l.variationId } : {}),
          ...(l.addOnIds.length ? { addOnIds: l.addOnIds } : {}),
          quantity: l.quantity,
          note: l.note,
        })),
        notes: notes.trim(),
        table: orderType === 'dine_in' ? table.trim() : '',
        reservationId: selectedGuest ? selectedGuest._id : undefined,
        roomNo: selectedGuest ? roomNo || selectedGuest.rooms?.[0] || '' : '',
        guestName: selectedGuest ? selectedGuest.guestName : guestName.trim(),
        phone: selectedGuest ? selectedGuest.phone : phone.trim(),
      };
      if (paymentMode === 'pay_now' && collectNow && grandTotal > 0) {
        body.payment = { amount: grandTotal, method: payMethod, reference: payRef.trim() };
      }

      const res = await adminApi<any>('/admin/restaurant/orders', { method: 'POST', body });
      toast.success(`Order ${res.order?.orderNumber || ''} sent to kitchen`);
      setReceiptResult(res);
      setCart([]);
      setNotes('');
      setPayRef('');
    } catch (err: any) {
      toast.error(err.message || 'Could not create order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminLayout title="POS / New Order">
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Menu board */}
        <div className="space-y-4 lg:col-span-7 xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search dishes…"
                className="pl-9"
              />
            </div>
            <Tabs value={category} onValueChange={setCategory}>
              <TabsList className="h-auto flex-wrap justify-start">
                {categories.map((cat) => (
                  <TabsTrigger key={cat} value={cat}>
                    {cat}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => {
              const id = String(item._id || item.id);
              const vars = item.variations || [];
              const startingPrice = vars.length
                ? Math.min(...vars.map((v: any) => Number(v.price || 0)))
                : Number(item.price || 0);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => openDishOrAdd(item)}
                  className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-accent/60 cursor-pointer disabled:opacity-50"
                >
                  <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
                    <ResilientImage
                      src={media(item.image)}
                      alt={item.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-3.5">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {item.category} · {item.station || 'Kitchen'}
                      </p>
                      <h3 className="mt-0.5 font-medium text-foreground">{item.name}</h3>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                        {vars.length ? `From ${pkr(startingPrice)}` : pkr(startingPrice)}
                      </span>
                      {!item.available ? (
                        <span className="text-xs font-medium text-destructive">Sold Out</span>
                      ) : (
                        <span className="text-xs font-medium text-accent">+ Add</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Ticket / Checkout */}
        <div className="lg:col-span-5 xl:col-span-4">
          <Card className="sticky top-20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShoppingBag className="h-4 w-4 text-accent" />
                  Order Ticket
                </CardTitle>
                {cart.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCart([])}>
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Order Type</Label>
                  <Select
                    value={orderType}
                    onValueChange={(v) => {
                      const next = v as 'dine_in' | 'room_service' | 'takeaway';
                      setOrderType(next);
                      if (next === 'room_service') setPaymentMode('room_charge');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dine_in">Dine-in</SelectItem>
                      <SelectItem value="room_service">Room Service</SelectItem>
                      <SelectItem value="takeaway">Takeaway</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Billing Mode</Label>
                  <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as 'pay_now' | 'room_charge')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pay_now">Pay Now</SelectItem>
                      <SelectItem value="room_charge">Post to Room Folio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {orderType === 'dine_in' && (
                <div className="space-y-1">
                  <Label>Table / Seating</Label>
                  <Input
                    value={table}
                    onChange={(e) => setTable(e.target.value)}
                    placeholder="e.g. Garden Table 4"
                  />
                </div>
              )}

              {(paymentMode === 'room_charge' || orderType === 'room_service') ? (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">In-House Guest</Label>
                  <Input
                    value={guestSearch}
                    onChange={(e) => setGuestSearch(e.target.value)}
                    placeholder="Search checked-in room or guest…"
                  />
                  {selectedGuest ? (
                    <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">{selectedGuest.guestName}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          Room {(selectedGuest.rooms || []).join(', ')} · {selectedGuest.bookingNumber}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedGuest(null);
                          setRoomNo('');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto divide-y divide-border rounded-md border border-border">
                      {inHouseGuests.map((g) => (
                        <button
                          key={g._id}
                          type="button"
                          onClick={() => {
                            setSelectedGuest(g);
                            setRoomNo(g.rooms?.[0] || '');
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted cursor-pointer"
                        >
                          <span className="font-medium">{g.guestName}</span>
                          <span className="font-mono text-muted-foreground">
                            Rm {(g.rooms || []).join(', ') || '—'}
                          </span>
                        </button>
                      ))}
                      {inHouseGuests.length === 0 && (
                        <p className="p-2 text-xs text-muted-foreground">No checked-in guests match.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Guest Name</Label>
                    <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Walk-in guest" />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300..." />
                  </div>
                </div>
              )}

              <Separator />

              <div className="max-h-60 space-y-2 overflow-y-auto">
                {cart.map((line) => (
                  <div key={line.key} className="flex items-start justify-between gap-2 rounded-lg border border-border p-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight">
                        {line.name}
                        {line.variationName && <span className="text-muted-foreground"> · {line.variationName}</span>}
                      </p>
                      {line.addOnNames.length > 0 && (
                        <p className="text-xs text-muted-foreground">+ {line.addOnNames.join(', ')}</p>
                      )}
                      {line.note && <p className="text-xs italic text-muted-foreground">“{line.note}”</p>}
                      <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                        {pkr(line.unitPrice * line.quantity)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(line.key, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center font-mono text-xs tabular-nums">{line.quantity}</span>
                      <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(line.key, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Tap dishes on the left to add them.</p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Kitchen Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, spice level, cutlery…" />
              </div>

              {paymentMode === 'pay_now' && (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pos-collect-now" className="cursor-pointer">
                      Record Payment Now
                    </Label>
                    <Switch id="pos-collect-now" checked={collectNow} onCheckedChange={setCollectNow} />
                  </div>
                  {collectNow && (
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={payMethod} onValueChange={setPayMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="easypaisa">Easypaisa</SelectItem>
                          <SelectItem value="jazzcash">JazzCash</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Ref / TID" />
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5 border-t border-border pt-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">{pkr(subtotal)}</span>
                </div>
                {board.rates?.service > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Service ({board.rates.service}%)</span>
                    <span className="font-mono tabular-nums">{pkr(serviceAmount)}</span>
                  </div>
                )}
                {board.rates?.tax > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax ({board.rates.tax}%)</span>
                    <span className="font-mono tabular-nums">{pkr(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 text-base font-semibold">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">{pkr(grandTotal)}</span>
                </div>
              </div>

              <Button type="button" variant="accent" className="w-full" size="lg" disabled={submitting || !cart.length} onClick={placeOrder}>
                {submitting ? 'Sending to Kitchen…' : 'Place Order & Fire KOT'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dish Option Picker Dialog */}
      <Dialog open={Boolean(pickItem)} onOpenChange={(open) => !open && setPickItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pickItem?.name}</DialogTitle>
            <DialogDescription>Select portion size, optional add-ons, or prep note.</DialogDescription>
          </DialogHeader>
          {pickItem && (
            <form onSubmit={confirmPickDish} className="space-y-4">
              {(pickItem.variations || []).length > 0 && (
                <div className="space-y-2">
                  <Label>Portion / Variation</Label>
                  <div className="grid gap-2">
                    {pickItem.variations.map((v: any) => {
                      const vid = String(v._id || v.id);
                      const checked = pickVarId === vid;
                      return (
                        <button
                          key={vid}
                          type="button"
                          onClick={() => setPickVarId(vid)}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                            checked ? 'border-accent bg-accent/10 font-medium' : 'border-border'
                          }`}
                        >
                          <span>{v.name}</span>
                          <span className="font-mono tabular-nums">{pkr(v.price)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(pickItem.addOns || []).length > 0 && (
                <div className="space-y-2">
                  <Label>Add-ons</Label>
                  <div className="grid gap-2">
                    {pickItem.addOns.map((a: any) => {
                      const aid = String(a._id || a.id);
                      const active = pickAddOnIds.includes(aid);
                      return (
                        <button
                          key={aid}
                          type="button"
                          onClick={() =>
                            setPickAddOnIds((prev) =>
                              active ? prev.filter((x) => x !== aid) : [...prev, aid],
                            )
                          }
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                            active ? 'border-accent bg-accent/10 font-medium' : 'border-border'
                          }`}
                        >
                          <span>{a.name}</span>
                          <span className="font-mono tabular-nums">+{pkr(a.price)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Special Instruction</Label>
                <Input value={pickNote} onChange={(e) => setPickNote(e.target.value)} placeholder="Less oil, extra spicy…" />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPickItem(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent">
                  Add to Ticket
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Confirmation Dialog */}
      <Dialog open={Boolean(receiptResult)} onOpenChange={(open) => !open && setReceiptResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Order {receiptResult?.order?.orderNumber} Fired
            </DialogTitle>
            <DialogDescription>
              Kitchen ticket sent to the kitchen display board.
            </DialogDescription>
          </DialogHeader>
          {receiptResult && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
                <p>
                  <span className="text-muted-foreground">KOT Number: </span>
                  <span className="font-mono font-semibold">{receiptResult.kots?.[0]?.kotNumber || '—'}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-mono font-semibold">{pkr(receiptResult.order?.total)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Billing: </span>
                  <span>
                    {receiptResult.order?.paymentMode === 'room_charge'
                      ? `Charged to Room ${receiptResult.order?.roomNo || ''}`
                      : `Paid ${pkr(receiptResult.order?.paidAmount)} / ${pkr(receiptResult.order?.total)}`}
                  </span>
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button asChild variant="outline">
                  <Link to="/admin/restaurant/orders">All Orders</Link>
                </Button>
                <Button variant="accent" onClick={() => setReceiptResult(null)}>
                  Start Next Order
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

/* ---------------- 3. Restaurant Orders ---------------- */

export function RestaurantOrdersPage() {
  const { can } = useAdminAuth();
  const isManager = can(...SUPER);

  const [orders, setOrders] = useState<any[]>([]);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<any | null>(null);

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payRef, setPayRef] = useState('');

  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [refundReason, setRefundReason] = useState('');

  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('Cancelled by staff');
  const [orderReceipt, setOrderReceipt] = useState<any | null>(null);

  // Add supplementary items modal for open orders
  const [addOpen, setAddOpen] = useState(false);
  const [boardItems, setBoardItems] = useState<any[]>([]);
  const [addCart, setAddCart] = useState<PosCartLine[]>([]);
  const [addSearch, setAddSearch] = useState('');
  const [pickSuppItem, setPickSuppItem] = useState<any | null>(null);
  const [pickSuppVarId, setPickSuppVarId] = useState('');
  const [pickSuppAddOnIds, setPickSuppAddOnIds] = useState<string[]>([]);
  const [pickSuppNote, setPickSuppNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ limit: '50' });
      if (status !== 'all') qs.set('status', status);
      if (query.trim()) qs.set('q', query.trim());
      const res = await adminApi<any>(`/admin/restaurant/orders?${qs.toString()}`);
      setOrders(res.items || []);
    } catch (err: any) {
      toast.error(err.message || 'Could not load orders');
    }
  }, [status, query]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(id: string | number) {
    try {
      const res = await adminApi<any>(`/admin/restaurant/orders/${id}`);
      setSelected(res);
      const due = Math.max(0, Number(res.order.total || 0) - Number(res.order.paidAmount || 0));
      setPayAmount(due > 0 ? String(due) : '');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      const res = await adminApi<any>(`/admin/restaurant/orders/${selected.order._id}/payments`, {
        method: 'POST',
        body: { amount: Number(payAmount), method: payMethod, reference: payRef.trim() },
      });
      setSelected(res);
      setPayRef('');
      toast.success('Payment recorded');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancelLine(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !cancelTarget) return;
    setBusy(true);
    try {
      const lineId = cancelTarget._id || cancelTarget.id;
      const res = await adminApi<any>(`/admin/restaurant/orders/${selected.order._id}/cancel`, {
        method: 'POST',
        body: { lineIds: [lineId], reason: cancelReason.trim() || 'Cancelled by staff' },
      });
      setSelected(res);
      setCancelTarget(null);
      setCancelReason('Cancelled by staff');
      toast.success('Item cancelled and cancellation KOT sent');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function issueRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      const res = await adminApi<any>(`/admin/restaurant/orders/${selected.order._id}/refunds`, {
        method: 'POST',
        body: { amount: Number(refundAmount), method: refundMethod, reason: refundReason.trim() || 'Manager refund' },
      });
      setSelected(res);
      setRefundAmount('');
      setRefundReason('');
      toast.success('Refund issued');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function stepKot(kotId: string | number, to: string) {
    setBusy(true);
    try {
      await adminApi(`/admin/restaurant/kots/${kotId}/status`, { method: 'POST', body: { to } });
      if (selected?.order?._id) await openDetail(selected.order._id);
      toast.success(`Ticket marked ${to}`);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openPaymentReceipt(paymentId: string | number) {
    try {
      const res = await adminApi<any>(`/admin/restaurant/payments/${paymentId}/receipt`);
      setOrderReceipt(res);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function openAddItemsModal() {
    setAddOpen(true);
    setAddCart([]);
    setAddSearch('');
    try {
      const res = await adminApi<any>('/admin/restaurant/board');
      setBoardItems((res.items || []).filter((i: any) => i.available !== false));
    } catch (err: any) {
      toast.error(err.message || 'Could not load dishes');
    }
  }

  function pushSuppLine(item: any, variation: any | undefined, addOns: any[], note: string) {
    const base = variation ? Number(variation.price) : Number(item.price || 0);
    const addTotal = addOns.reduce((s, a) => s + Number(a.price || 0), 0);
    const unitPrice = base + addTotal;
    const varId = variation ? String(variation._id || variation.id) : undefined;
    const addIds = addOns.map((a) => String(a._id || a.id)).sort();
    const key = `${item._id || item.id}|${varId || ''}|${addIds.join(',')}|${note.trim()}`;

    setAddCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          key,
          menuItemId: String(item._id || item.id),
          name: item.name,
          variationId: varId,
          variationName: variation?.name,
          addOnIds: addIds,
          addOnNames: addOns.map((a) => a.name),
          unitPrice,
          quantity: 1,
          note: note.trim(),
        },
      ];
    });
  }

  function tapSuppItem(item: any) {
    const vars = item.variations || [];
    const adds = item.addOns || [];
    if (vars.length || adds.length) {
      setPickSuppItem(item);
      setPickSuppVarId(vars[0]?._id || vars[0]?.id ? String(vars[0]._id || vars[0].id) : '');
      setPickSuppAddOnIds([]);
      setPickSuppNote('');
      return;
    }
    pushSuppLine(item, undefined, [], '');
  }

  async function submitAddItems() {
    if (!selected || addCart.length === 0) return;
    setBusy(true);
    try {
      const res = await adminApi<any>(`/admin/restaurant/orders/${selected.order._id}/items`, {
        method: 'POST',
        body: {
          items: addCart.map((l) => ({
            menuItemId: l.menuItemId,
            ...(l.variationId ? { variationId: l.variationId } : {}),
            ...(l.addOnIds.length ? { addOnIds: l.addOnIds } : {}),
            quantity: l.quantity,
            note: l.note,
          })),
        },
      });
      setSelected(res);
      setAddOpen(false);
      setAddCart([]);
      toast.success('Supplementary items added & fired to kitchen');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Could not add items');
    } finally {
      setBusy(false);
    }
  }

  const nextKotStep = (k: any): { to: string; label: string } | null => {
    if (k.type === 'cancellation') return k.status === 'new' ? { to: 'acknowledged', label: 'Acknowledge' } : null;
    if (k.status === 'new') return { to: 'accepted', label: 'Accept' };
    if (k.status === 'accepted') return { to: 'preparing', label: 'Cook' };
    if (k.status === 'preparing') return { to: 'ready', label: 'Ready' };
    if (k.status === 'ready') return { to: 'served', label: 'Served' };
    return null;
  };

  const canAddMoreItems = selected && ['new', 'accepted', 'preparing', 'ready'].includes(selected.order.status);

  return (
    <AdminLayout title="Restaurant Orders">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Order #, guest, room…" className="pl-9" />
            </div>
            <Tabs value={status} onValueChange={setStatus}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="open">Open</TabsTrigger>
                <TabsTrigger value="served">Served</TabsTrigger>
                <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <Button asChild variant="accent" size="sm">
            <Link to="/admin/restaurant/pos">
              <Plus className="h-4 w-4" />
              New Order
            </Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Guest / Table</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead className="text-right">Total / Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow
                    key={o._id || o.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => openDetail(o._id || o.id)}
                  >
                    <TableCell className="font-mono font-medium">
                      {o.orderNumber}
                      <span className="block font-sans text-xs text-muted-foreground">{orderTypeLabel(o.type)}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {o.guestName || (o.table ? `Table ${o.table}` : 'Walk-in')}
                      <span className="block text-xs text-muted-foreground">
                        {o.roomNo ? `Room ${o.roomNo}` : o.table ? `Table ${o.table}` : o.businessDate}
                      </span>
                    </TableCell>
                    <TableCell className="capitalize text-sm">{o.status}</TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">
                      {String(o.paymentStatus || o.paymentMode).replaceAll('_', ' ')}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      <span>{pkr(o.total)}</span>
                      <span className="block text-xs text-muted-foreground">Paid {pkr(o.paidAmount)}</span>
                    </TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No matching orders found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* MUI Order Folio & Action Drawer */}
      <Drawer
        anchor="right"
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 540 } } } }}
      >
        {selected && (
          <div className="flex h-full flex-col overflow-y-auto p-6 space-y-6 bg-card text-card-foreground">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <p className="font-mono text-xs uppercase text-muted-foreground">
                  {selected.order.orderNumber} · {orderTypeLabel(selected.order.type)}
                  {selected.order.roomNo ? ` · Room ${selected.order.roomNo}` : selected.order.table ? ` · Table ${selected.order.table}` : ''}
                </p>
                <h2 className="font-display text-2xl font-semibold">
                  {selected.order.guestName || (selected.order.table ? `Table ${selected.order.table}` : 'Dining Order')}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Status: <span className="capitalize font-medium text-foreground">{selected.order.status}</span> · Billing:{' '}
                  <span className="capitalize">{String(selected.order.paymentStatus || selected.order.paymentMode).replaceAll('_', ' ')}</span>
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order Lines</h3>
                {canAddMoreItems && (
                  <Button type="button" size="sm" variant="outline" onClick={openAddItemsModal}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Items
                  </Button>
                )}
              </div>
              <div className="divide-y divide-border rounded-lg border border-border">
                {(selected.order.items || []).map((line: any) => (
                  <div key={line._id || line.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className={line.status === 'cancelled' ? 'line-through text-muted-foreground' : 'font-medium'}>
                        {line.quantity} × {line.name} {line.variation ? `(${line.variation})` : ''}
                      </p>
                      {line.note && <p className="text-xs italic text-muted-foreground">{line.note}</p>}
                      {line.status === 'cancelled' && line.cancelReason && (
                        <p className="text-xs text-destructive">Cancelled: {line.cancelReason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono tabular-nums">{pkr(line.lineTotal)}</span>
                      {line.status === 'active' && selected.order.status !== 'served' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => {
                            setCancelTarget(line);
                            setCancelReason('Cancelled by staff');
                          }}
                          title="Cancel item"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 text-sm space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono">{pkr(selected.order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax &amp; Service</span>
                <span className="font-mono">
                  {pkr(Number(selected.order.taxAmount || 0) + Number(selected.order.serviceAmount || 0))}
                </span>
              </div>
              <div className="flex justify-between font-semibold pt-1">
                <span>Total · Paid</span>
                <span className="font-mono">
                  {pkr(selected.order.total)} · {pkr(selected.order.paidAmount)}
                </span>
              </div>
            </div>

            {/* Kitchen Tickets */}
            {(selected.kots || []).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kitchen Tickets (KOT)</h3>
                <div className="divide-y divide-border rounded-lg border border-border text-xs">
                  {selected.kots.map((k: any) => {
                    const step = nextKotStep(k);
                    return (
                      <div key={k._id || k.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div>
                          <p className="font-mono font-semibold">
                            {k.kotNumber}{' '}
                            <span className="font-sans font-normal capitalize text-muted-foreground">· {k.type} · {k.status}</span>
                          </p>
                          <p className="text-muted-foreground">
                            {(k.items || []).map((i: any) => `${i.quantity}× ${i.name}`).join(', ')}
                          </p>
                        </div>
                        {step && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => stepKot(k._id || k.id, step.to)}
                          >
                            {step.label}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selected.order.paymentMode === 'pay_now' && selected.order.status !== 'cancelled' && (
              <form onSubmit={submitPayment} className="space-y-3 rounded-lg border border-border p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collect Payment</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min="1"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Amount"
                  />
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="easypaisa">Easypaisa</SelectItem>
                      <SelectItem value="jazzcash">JazzCash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Reference / Slip #" />
                  <Button type="submit" variant="accent" disabled={busy}>
                    Post
                  </Button>
                </div>
              </form>
            )}

            {isManager && Number(selected.order.paidAmount || 0) > 0 && (
              <form onSubmit={issueRefund} className="space-y-3 rounded-lg border border-border p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Issue Refund</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min="1"
                    required
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="Refund amount"
                  />
                  <Select value={refundMethod} onValueChange={setRefundMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Reason" />
                  <Button type="submit" variant="destructive" disabled={busy}>
                    Refund
                  </Button>
                </div>
              </form>
            )}

            {/* Payments History */}
            {(selected.payments || []).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payments &amp; Receipts</h3>
                <div className="divide-y divide-border rounded-lg border border-border text-xs">
                  {selected.payments.map((p: any) => (
                    <div key={p._id || p.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <div>
                        <p className="font-mono font-medium">
                          {p.receiptNumber} · <span className="capitalize font-sans">{String(p.method || '').replaceAll('_', ' ')}</span>
                        </p>
                        {p.reference && <p className="text-muted-foreground">Ref: {p.reference}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-semibold ${p.kind === 'refund' ? 'text-destructive' : 'text-emerald-600'}`}>
                          {p.kind === 'refund' ? `-${pkr(p.amount)}` : pkr(p.amount)}
                        </span>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openPaymentReceipt(p._id || p.id)}>
                          <Receipt className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order History */}
            {(selected.order.history || []).length > 0 && (
              <div className="space-y-2 pb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order Activity</h3>
                <div className="space-y-1.5 rounded-lg border border-border p-3 text-xs text-muted-foreground">
                  {selected.order.history.map((h: any, idx: number) => (
                    <div key={idx} className="flex justify-between gap-2">
                      <span>
                        <span className="font-medium capitalize text-foreground">{String(h.event || '').replaceAll('_', ' ')}</span>
                        {h.note ? ` · ${h.note}` : ''}
                        {h.by?.name ? ` (${h.by.name})` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Cancel Item Dialog */}
      <Dialog open={Boolean(cancelTarget)} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel {cancelTarget?.name}?</DialogTitle>
            <DialogDescription>
              A cancellation KOT will be fired to the kitchen immediately.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={confirmCancelLine} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Cancellation Reason (min 3 characters)</Label>
              <Input
                required
                minLength={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Guest changed mind, out of stock…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCancelTarget(null)}>Keep Item</Button>
              <Button type="submit" variant="destructive" disabled={busy}>Confirm Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Supplementary Items Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Items to {selected?.order?.orderNumber}</DialogTitle>
            <DialogDescription>Fires a supplementary KOT to the kitchen without creating a second order.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={addSearch} onChange={(e) => setAddSearch(e.target.value)} placeholder="Search dishes to add…" />
            <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              {boardItems
                .filter((i) => !addSearch.trim() || `${i.name} ${i.category}`.toLowerCase().includes(addSearch.trim().toLowerCase()))
                .map((item) => {
                  const vars = item.variations || [];
                  const minP = vars.length ? Math.min(...vars.map((v: any) => Number(v.price || 0))) : Number(item.price || 0);
                  return (
                    <button
                      key={item._id || item.id}
                      type="button"
                      onClick={() => tapSuppItem(item)}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-accent cursor-pointer"
                    >
                      <span className="truncate font-medium">{item.name}</span>
                      <span className="ml-2 shrink-0 font-mono text-xs text-accent">+{pkr(minP)}</span>
                    </button>
                  );
                })}
            </div>

            {addCart.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items to Add ({addCart.length})</p>
                {addCart.map((line) => (
                  <div key={line.key} className="flex items-center justify-between gap-2 text-sm">
                    <div>
                      <span className="font-medium">{line.name}</span>
                      {line.variationName && <span className="text-xs text-muted-foreground"> ({line.variationName})</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          setAddCart((prev) =>
                            prev.map((l) => (l.key === line.key ? { ...l, quantity: l.quantity - 1 } : l)).filter((l) => l.quantity > 0),
                          )
                        }
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center font-mono text-xs">{line.quantity}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          setAddCart((prev) => prev.map((l) => (l.key === line.key ? { ...l, quantity: l.quantity + 1 } : l)))
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="button" variant="accent" disabled={busy || addCart.length === 0} onClick={submitAddItems}>
                {busy ? 'Sending…' : 'Fire Supplementary KOT'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dish Option Picker for Add Items */}
      <Dialog open={Boolean(pickSuppItem)} onOpenChange={(o) => !o && setPickSuppItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pickSuppItem?.name}</DialogTitle>
          </DialogHeader>
          {pickSuppItem && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const variation = (pickSuppItem.variations || []).find((v: any) => String(v._id || v.id) === pickSuppVarId);
                const addOns = (pickSuppItem.addOns || []).filter((a: any) => pickSuppAddOnIds.includes(String(a._id || a.id)));
                pushSuppLine(pickSuppItem, variation, addOns, pickSuppNote);
                setPickSuppItem(null);
              }}
              className="space-y-4"
            >
              {(pickSuppItem.variations || []).length > 0 && (
                <div className="space-y-2">
                  <Label>Variation</Label>
                  <div className="grid gap-2">
                    {pickSuppItem.variations.map((v: any) => {
                      const vid = String(v._id || v.id);
                      const checked = pickSuppVarId === vid;
                      return (
                        <button
                          key={vid}
                          type="button"
                          onClick={() => setPickSuppVarId(vid)}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                            checked ? 'border-accent bg-accent/10 font-medium' : 'border-border'
                          }`}
                        >
                          <span>{v.name}</span>
                          <span className="font-mono tabular-nums">{pkr(v.price)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {(pickSuppItem.addOns || []).length > 0 && (
                <div className="space-y-2">
                  <Label>Add-ons</Label>
                  <div className="grid gap-2">
                    {pickSuppItem.addOns.map((a: any) => {
                      const aid = String(a._id || a.id);
                      const active = pickSuppAddOnIds.includes(aid);
                      return (
                        <button
                          key={aid}
                          type="button"
                          onClick={() =>
                            setPickSuppAddOnIds((prev) => (active ? prev.filter((x) => x !== aid) : [...prev, aid]))
                          }
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                            active ? 'border-accent bg-accent/10 font-medium' : 'border-border'
                          }`}
                        >
                          <span>{a.name}</span>
                          <span className="font-mono tabular-nums">+{pkr(a.price)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <Input value={pickSuppNote} onChange={(e) => setPickSuppNote(e.target.value)} placeholder="Special instruction…" />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPickSuppItem(null)}>Cancel</Button>
                <Button type="submit" variant="accent">Add</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Payment Receipt Modal */}
      <Dialog open={Boolean(orderReceipt)} onOpenChange={(o) => !o && setOrderReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{orderReceipt?.hotel?.name || 'Oasis Resort'} — Receipt</DialogTitle>
            <DialogDescription>{orderReceipt?.payment?.receiptNumber}</DialogDescription>
          </DialogHeader>
          {orderReceipt && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-border p-4 space-y-1.5">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Order</span>
                  <span className="font-mono">{orderReceipt.order?.orderNumber}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Guest</span>
                  <span>{orderReceipt.payment?.guestName || 'Walk-in Guest'}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="capitalize">{String(orderReceipt.payment?.method || '').replaceAll('_', ' ')}</span>
                </p>
                <Separator className="my-2" />
                <p className="flex justify-between font-semibold text-base">
                  <span>{orderReceipt.payment?.kind === 'refund' ? 'Refunded' : 'Paid'}</span>
                  <span className="font-mono">{pkr(orderReceipt.payment?.amount)}</span>
                </p>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

/* ---------------- 4. KOT Tickets List ---------------- */

export function RestaurantKotsPage() {
  const [view, setView] = useState('active');
  const [kots, setKots] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const qs = view === 'active' ? 'view=active&limit=80' : 'limit=80';
      const res = await adminApi<any>(`/admin/restaurant/kots?${qs}`);
      setKots(res.items || []);
    } catch (err: any) {
      toast.error(err.message || 'Could not load KOTs');
    }
  }, [view]);

  useEffect(() => {
    load();
  }, [load]);

  async function moveKot(id: string | number, to: string) {
    try {
      await adminApi(`/admin/restaurant/kots/${id}/status`, { method: 'POST', body: { to } });
      toast.success(`Ticket moved to ${to}`);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <AdminLayout title="KOT Tickets">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="active">Active Queue</TabsTrigger>
              <TabsTrigger value="all">All Today & History</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button asChild variant="accent" size="sm">
              <Link to="/admin/restaurant/kitchen">Open Kitchen Display</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KOT #</TableHead>
                  <TableHead>Order / Destination</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kots.map((k) => {
                  const id = k._id || k.id;
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-mono font-medium">
                        {k.kotNumber}
                        <span className="block font-sans text-xs capitalize text-muted-foreground">{k.type}</span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-mono">{k.orderNumber}</span>
                        <span className="block text-xs text-muted-foreground">
                          {k.roomNo ? `Room ${k.roomNo}` : k.table ? `Table ${k.table}` : k.guestName || 'Counter'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {(k.items || []).map((i: any, idx: number) => (
                          <div key={idx}>
                            {i.quantity}× {i.name} {i.variation ? `(${i.variation})` : ''}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="capitalize text-sm">{k.status}</TableCell>
                      <TableCell className="text-right">
                        {k.type === 'cancellation' && k.status === 'new' && (
                          <Button size="sm" variant="destructive" onClick={() => moveKot(id, 'acknowledged')}>
                            Acknowledge
                          </Button>
                        )}
                        {k.type !== 'cancellation' && k.status === 'new' && (
                          <Button size="sm" variant="outline" onClick={() => moveKot(id, 'accepted')}>
                            Accept
                          </Button>
                        )}
                        {k.type !== 'cancellation' && k.status === 'accepted' && (
                          <Button size="sm" variant="outline" onClick={() => moveKot(id, 'preparing')}>
                            Cook
                          </Button>
                        )}
                        {k.type !== 'cancellation' && k.status === 'preparing' && (
                          <Button size="sm" variant="accent" onClick={() => moveKot(id, 'ready')}>
                            Ready
                          </Button>
                        )}
                        {k.type !== 'cancellation' && k.status === 'ready' && (
                          <Button size="sm" variant="default" onClick={() => moveKot(id, 'served')}>
                            Served
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {kots.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No KOT tickets in this queue.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

/* ---------------- 5. Real-Time Kitchen Display (KDS) ---------------- */

const KDS_LANES: Array<{ key: string; title: string; next?: string; nextLabel?: string }> = [
  { key: 'new', title: 'New Orders', next: 'accepted', nextLabel: 'Accept Ticket' },
  { key: 'accepted', title: 'Queued / Accepted', next: 'preparing', nextLabel: 'Start Preparing' },
  { key: 'preparing', title: 'Preparing', next: 'ready', nextLabel: 'Mark Ready' },
  { key: 'ready', title: 'Ready for Pickup', next: 'served', nextLabel: 'Mark Served' },
];

export function RestaurantKitchenPage() {
  const [kots, setKots] = useState<any[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [live, setLive] = useState(false);
  const [dishesOpen, setDishesOpen] = useState(false);
  const [dishes, setDishes] = useState<any[]>([]);
  const prevNewCount = useRef<number>(0);

  const load = useCallback(async () => {
    try {
      const res = await adminApi<any>('/admin/restaurant/kots?view=active&limit=100');
      const items = res.items || [];
      const newCount = items.filter((k: any) => k.status === 'new').length;
      if (newCount > prevNewCount.current && soundOn) playKitchenChime();
      prevNewCount.current = newCount;
      setKots(items);
    } catch {
      /* ignore background errors */
    }
  }, [soundOn]);

  useEffect(() => {
    load();
    const token = getAdminToken();
    const source = new EventSource(`${API}/admin/restaurant/stream?token=${encodeURIComponent(token)}`);
    source.onopen = () => setLive(true);
    source.onmessage = () => load();
    source.onerror = () => setLive(false);
    const poll = setInterval(load, 15000);
    return () => {
      source.close();
      clearInterval(poll);
    };
  }, [load]);

  async function advance(id: string | number, to: string) {
    try {
      await adminApi(`/admin/restaurant/kots/${id}/status`, { method: 'POST', body: { to } });
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function openSoldOutBoard() {
    setDishesOpen(true);
    try {
      const res = await adminApi<any[]>('/admin/restaurant/dishes');
      setDishes(res || []);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function toggleDishAvailability(dish: any) {
    try {
      await adminApi(`/admin/restaurant/menu/${dish._id}/availability`, {
        method: 'POST',
        body: { available: !dish.available },
      });
      setDishes((prev) => prev.map((d) => (d._id === dish._id ? { ...d, available: !d.available } : d)));
      toast.success(`${dish.name} marked ${!dish.available ? 'Available' : 'Sold Out'}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const cancellations = kots.filter((k) => k.type === 'cancellation' && k.status === 'new');
  const activeOrders = kots.filter((k) => k.type !== 'cancellation');

  return (
    <AdminLayout title="Kitchen Display System">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Live Kitchen Board</h1>
            <p className="text-xs text-muted-foreground">
              {live ? 'Live stream active' : 'Auto-refreshing every 15s'} · {activeOrders.length} active tickets
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSoundOn((s) => !s)}>
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {soundOn ? 'Chime On' : 'Muted'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={openSoldOutBoard}>
              <Ban className="h-4 w-4" />
              86 / Sold-Out Board
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {cancellations.length > 0 && (
          <div className="space-y-2">
            {cancellations.map((c) => (
              <div
                key={c._id || c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4"
              >
                <div className="text-sm">
                  <p className="font-semibold text-destructive">
                    Cancellation Notice · {c.kotNumber} ({c.orderNumber})
                  </p>
                  <p className="text-foreground">
                    {(c.items || []).map((i: any) => `${i.quantity}× ${i.name}`).join(', ')}
                    {c.reason ? ` — Reason: ${c.reason}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="destructive" onClick={() => advance(c._id || c.id, 'acknowledged')}>
                  Acknowledge Cancellation
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {KDS_LANES.map((lane) => {
            const laneTickets = activeOrders.filter((k) => k.status === lane.key);
            return (
              <div key={lane.key} className="flex flex-col rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold">{lane.title}</h2>
                  <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                    {laneTickets.length}
                  </span>
                </div>
                <div className="flex-1 space-y-3 p-3">
                  {laneTickets.map((k) => {
                    const id = k._id || k.id;
                    const age = minutesSince(k.createdAt);
                    return (
                      <div key={id} className="rounded-lg border border-border bg-background p-3.5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-sm font-semibold">
                              {k.kotNumber}
                              {k.type === 'supplementary' && (
                                <span className="ml-1.5 text-xs font-sans font-medium text-accent">ADD-ON</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {k.orderNumber} · {k.roomNo ? `Room ${k.roomNo}` : k.table ? `Table ${k.table}` : orderTypeLabel(k.orderType)}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-xs tabular-nums ${
                              age >= 20 ? 'text-destructive font-semibold' : 'text-muted-foreground'
                            }`}
                          >
                            <Clock className="h-3 w-3" />
                            {age}m
                          </span>
                        </div>

                        <ul className="space-y-1.5 border-y border-border py-2.5 text-sm">
                          {(k.items || []).map((item: any, idx: number) => (
                            <li key={idx} className="leading-snug">
                              <span className="font-mono font-semibold">{item.quantity}×</span> {item.name}
                              {item.variation && <span className="text-xs text-muted-foreground"> ({item.variation})</span>}
                              {item.addOns?.length > 0 && (
                                <span className="block pl-5 text-xs text-muted-foreground">+ {item.addOns.join(', ')}</span>
                              )}
                              {item.note && (
                                <span className="block pl-5 text-xs italic text-accent">Note: {item.note}</span>
                              )}
                            </li>
                          ))}
                        </ul>

                        {k.notes && <p className="text-xs italic text-muted-foreground">Order Note: {k.notes}</p>}

                        {lane.next && (
                          <Button
                            type="button"
                            variant={lane.key === 'preparing' ? 'accent' : 'default'}
                            className="w-full"
                            size="sm"
                            onClick={() => advance(id, lane.next!)}
                          >
                            {lane.nextLabel}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  {laneTickets.length === 0 && (
                    <p className="py-10 text-center text-xs text-muted-foreground">Queue clear</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sold-Out Board */}
      <Dialog open={dishesOpen} onOpenChange={setDishesOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dish Availability (Kitchen 86 Board)</DialogTitle>
            <DialogDescription>Toggle off ingredients or dishes that have run out for today.</DialogDescription>
          </DialogHeader>
          <div className="divide-y divide-border">
            {dishes.map((d) => (
              <div key={d._id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{d.available ? 'Available' : 'Sold Out'}</span>
                  <Switch checked={Boolean(d.available)} onCheckedChange={() => toggleDishAvailability(d)} />
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

/* ---------------- 6. Menu & Rates Management ---------------- */

export function RestaurantMenuPage() {
  const { can } = useAdminAuth();
  const isManager = can(...SUPER);

  const [items, setItems] = useState<any[]>([]);
  const [rates, setRates] = useState({ tax: '0', service: '0' });
  const [editing, setEditing] = useState<any | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [station, setStation] = useState('Kitchen');
  const [price, setPrice] = useState('');
  const [prepMinutes, setPrepMinutes] = useState('15');
  const [sortOrder, setSortOrder] = useState('0');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [available, setAvailable] = useState(true);
  const [variations, setVariations] = useState<Array<{ _id?: string; name: string; price: string }>>([]);
  const [addOns, setAddOns] = useState<Array<{ _id?: string; name: string; price: string }>>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [menuRes, ratesRes] = await Promise.all([
        adminApi<any[]>('/admin/restaurant/menu'),
        adminApi<{ tax: number; service: number }>('/admin/restaurant/rates'),
      ]);
      setItems(menuRes || []);
      setRates({ tax: String(ratesRes.tax ?? 0), service: String(ratesRes.service ?? 0) });
    } catch (err: any) {
      toast.error(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing({});
    setName('');
    setCategory('');
    setStation('Kitchen');
    setPrice('');
    setPrepMinutes('15');
    setSortOrder('0');
    setDescription('');
    setImage('');
    setAvailable(true);
    setVariations([]);
    setAddOns([]);
  }

  function openEdit(item: any) {
    setEditing(item);
    setName(item.name || '');
    setCategory(item.category || '');
    setStation(item.station || 'Kitchen');
    setPrice(String(item.price ?? 0));
    setPrepMinutes(String(item.prepMinutes ?? 15));
    setSortOrder(String(item.sortOrder ?? 0));
    setDescription(item.description || '');
    setImage(item.image || '');
    setAvailable(item.available !== false);
    setVariations(
      (item.variations || []).map((v: any) => ({
        ...(v._id || v.id ? { _id: String(v._id || v.id) } : {}),
        name: v.name || '',
        price: String(v.price ?? 0),
      })),
    );
    setAddOns(
      (item.addOns || []).map((a: any) => ({
        ...(a._id || a.id ? { _id: String(a._id || a.id) } : {}),
        name: a.name || '',
        price: String(a.price ?? 0),
      })),
    );
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await adminUploadImage(file);
      setImage(res.url);
      toast.success('Dish photo uploaded');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function saveDish(e: React.FormEvent) {
    e.preventDefault();
    const id = editing?._id || editing?.id;
    try {
      await adminApi(id ? `/admin/restaurant/menu/${id}` : '/admin/restaurant/menu', {
        method: id ? 'PATCH' : 'POST',
        body: {
          name: name.trim(),
          category: category.trim() || 'Mains',
          station: station.trim() || 'Kitchen',
          price: Number(price) || 0,
          prepMinutes: Number(prepMinutes) || 15,
          sortOrder: Number(sortOrder) || 0,
          description: description.trim(),
          image: image.trim(),
          available,
          variations: variations
            .filter((v) => v.name.trim())
            .map((v) => ({ ...(v._id ? { _id: v._id } : {}), name: v.name.trim(), price: Number(v.price) || 0 })),
          addOns: addOns
            .filter((a) => a.name.trim())
            .map((a) => ({ ...(a._id ? { _id: a._id } : {}), name: a.name.trim(), price: Number(a.price) || 0 })),
        },
      });
      toast.success(id ? 'Dish updated' : 'Dish created');
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function deleteDish(id: string | number) {
    try {
      await adminApi(`/admin/restaurant/menu/${id}`, { method: 'DELETE' });
      toast.success('Dish removed');
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function saveRates(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminApi('/admin/restaurant/rates', {
        method: 'PUT',
        body: { tax: Number(rates.tax), service: Number(rates.service) },
      });
      toast.success('Tax & service charge rates saved');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <AdminLayout title="Menu Management">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Dining Menu & Charges</h1>
            <p className="text-sm text-muted-foreground">{items.length} menu dishes configured</p>
          </div>
          {isManager && (
            <Button variant="accent" size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Add Dish
            </Button>
          )}
        </div>

        {isManager && (
          <Card>
            <CardContent className="p-5">
              <form onSubmit={saveRates} className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <Label>Restaurant Tax (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-36"
                    value={rates.tax}
                    onChange={(e) => setRates({ ...rates, tax: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Service Charge (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-36"
                    value={rates.service}
                    onChange={(e) => setRates({ ...rates, service: e.target.value })}
                  />
                </div>
                <Button type="submit" variant="outline">
                  Update Rates
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dish</TableHead>
                  <TableHead>Category & Station</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Available</TableHead>
                  {isManager && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const id = item._id || item.id;
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">
                        {item.name}
                        {item.description && (
                          <span className="block text-xs text-muted-foreground line-clamp-1 max-w-md">{item.description}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.category} · {item.station || 'Kitchen'}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">{pkr(item.price)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={item.available !== false}
                          onCheckedChange={async (checked) => {
                            await adminApi(`/admin/restaurant/menu/${id}/availability`, {
                              method: 'POST',
                              body: { available: checked },
                            });
                            load();
                          }}
                        />
                      </TableCell>
                      {isManager && (
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteDish(id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?._id || editing?.id ? 'Edit Dish' : 'Add New Dish'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveDish} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Dish Name</Label>
                <Input required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input required value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Mains, Breakfast…" />
              </div>
              <div className="space-y-1.5">
                <Label>Station</Label>
                <Input value={station} onChange={(e) => setStation(e.target.value)} placeholder="Kitchen / Grill / Bakery" />
              </div>
              <div className="space-y-1.5">
                <Label>Base Price (PKR)</Label>
                <Input type="number" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Prep Minutes</Label>
                <Input type="number" min="0" value={prepMinutes} onChange={(e) => setPrepMinutes(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Display Order</Label>
                <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Available on Menu</Label>
              <Switch checked={available} onCheckedChange={setAvailable} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Image URL or Upload</Label>
              <div className="flex gap-2">
                <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="/photos/menu/..." />
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted">
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? 'Uploading…' : 'Upload'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
            </div>

            {/* Portion / Variations */}
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <Label>Portion Variations (optional, e.g. Half / Full)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setVariations((prev) => [...prev, { name: '', price: '' }])}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Variation
                </Button>
              </div>
              {variations.map((v, idx) => (
                <div key={v._id || idx} className="flex items-center gap-2">
                  <Input
                    required
                    placeholder="Variation name (e.g. Full)"
                    value={v.name}
                    onChange={(e) =>
                      setVariations((prev) => prev.map((x, j) => (j === idx ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  <Input
                    type="number"
                    min="0"
                    required
                    className="w-28"
                    placeholder="Price"
                    value={v.price}
                    onChange={(e) =>
                      setVariations((prev) => prev.map((x, j) => (j === idx ? { ...x, price: e.target.value } : x)))
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive shrink-0"
                    onClick={() => setVariations((prev) => prev.filter((_, j) => j !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {variations.length === 0 && (
                <p className="text-xs text-muted-foreground">Single standard portion (uses Base Price).</p>
              )}
            </div>

            {/* Optional Add-ons */}
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <Label>Optional Add-ons (e.g. Extra Naan / Cheese)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAddOns((prev) => [...prev, { name: '', price: '' }])}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Option
                </Button>
              </div>
              {addOns.map((a, idx) => (
                <div key={a._id || idx} className="flex items-center gap-2">
                  <Input
                    required
                    placeholder="Add-on name"
                    value={a.name}
                    onChange={(e) =>
                      setAddOns((prev) => prev.map((x, j) => (j === idx ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  <Input
                    type="number"
                    min="0"
                    required
                    className="w-28"
                    placeholder="Price"
                    value={a.price}
                    onChange={(e) =>
                      setAddOns((prev) => prev.map((x, j) => (j === idx ? { ...x, price: e.target.value } : x)))
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive shrink-0"
                    onClick={() => setAddOns((prev) => prev.filter((_, j) => j !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {addOns.length === 0 && <p className="text-xs text-muted-foreground">No add-ons attached.</p>}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent">
                Save Dish
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

/* ---------------- 7. Categories ---------------- */

export function RestaurantCategoriesPage() {
  const { can } = useAdminAuth();
  const isManager = can(...SUPER);

  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await adminApi<any[]>('/admin/restaurant/categories');
      setRows(res || []);
    } catch (err: any) {
      toast.error(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminApi('/admin/restaurant/categories', {
        method: 'POST',
        body: { name: name.trim(), description: description.trim(), active: true },
      });
      setName('');
      setDescription('');
      toast.success('Category added');
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <AdminLayout title="Menu Categories">
      <div className="space-y-6">
        {isManager && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add Category</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={addCategory} className="grid gap-3 sm:grid-cols-3">
                <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" />
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short note (optional)" />
                <Button type="submit" variant="accent">
                  <Plus className="h-4 w-4" />
                  Create Category
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Dishes</TableHead>
                  <TableHead>Visible on Menu</TableHead>
                  {isManager && <TableHead className="text-right">Remove</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((cat) => {
                  const id = cat._id || cat.id;
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">
                        {cat.name}
                        {cat.description && <span className="block text-xs text-muted-foreground">{cat.description}</span>}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">{cat.items ?? 0}</TableCell>
                      <TableCell>
                        <Switch
                          disabled={!isManager}
                          checked={cat.active !== false}
                          onCheckedChange={async (checked) => {
                            await adminApi(`/admin/restaurant/categories/${id}`, {
                              method: 'PATCH',
                              body: { active: checked },
                            });
                            load();
                          }}
                        />
                      </TableCell>
                      {isManager && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={async () => {
                              try {
                                await adminApi(`/admin/restaurant/categories/${id}`, { method: 'DELETE' });
                                toast.success('Category deleted');
                                load();
                              } catch (err: any) {
                                toast.error(err.message);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

/* ---------------- 8. Restaurant Payments ---------------- */

export function RestaurantPaymentsPage() {
  const [from, setFrom] = useState(addDays(todayISO(), -7));
  const [to, setTo] = useState(todayISO());
  const [query, setQuery] = useState('');
  const [data, setData] = useState<any>({ items: [], received: 0, refunded: 0 });
  const [receipt, setReceipt] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ from, to, limit: '60' });
      if (query.trim()) qs.set('q', query.trim());
      const res = await adminApi<any>(`/admin/restaurant/payments?${qs.toString()}`);
      setData(res);
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [from, to, query]);

  useEffect(() => {
    load();
  }, [load]);

  async function viewReceipt(id: string | number) {
    try {
      const res = await adminApi<any>(`/admin/restaurant/payments/${id}/receipt`);
      setReceipt(res);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <AdminLayout title="Restaurant Payments">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label>Search</Label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Receipt #, Order #, Guest…" />
            </div>
          </div>

          <div className="flex gap-4 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Received</p>
              <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{pkr(data.received)}</p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div>
              <p className="text-xs text-muted-foreground">Refunded</p>
              <p className="font-mono font-semibold text-destructive">{pkr(data.refunded)}</p>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>Order / Guest</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.items || []).map((p: any) => (
                  <TableRow key={p._id || p.id}>
                    <TableCell className="font-mono font-medium">
                      {p.receiptNumber}
                      <span className="block font-sans text-xs text-muted-foreground">{pretty(p.businessDate)}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-mono">{p.orderNumber}</span>
                      <span className="block text-xs text-muted-foreground">{p.guestName || 'Counter'}</span>
                    </TableCell>
                    <TableCell className="capitalize text-sm">
                      {String(p.method || '').replaceAll('_', ' ')}
                      {p.kind === 'refund' && <span className="ml-1.5 text-xs text-destructive">Refund</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{pkr(p.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => viewReceipt(p._id || p.id)}>
                        <Receipt className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!data.items || data.items.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No dining payments in selected dates.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(receipt)} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{receipt?.hotel?.name || 'Oasis Resort'} — Receipt</DialogTitle>
            <DialogDescription>{receipt?.payment?.receiptNumber}</DialogDescription>
          </DialogHeader>
          {receipt && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-border p-4 space-y-1.5">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Order</span>
                  <span className="font-mono">{receipt.order?.orderNumber}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Guest</span>
                  <span>{receipt.payment?.guestName || 'Walk-in Guest'}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="capitalize">{String(receipt.payment?.method || '').replaceAll('_', ' ')}</span>
                </p>
                <Separator className="my-2" />
                <p className="flex justify-between font-semibold text-base">
                  <span>{receipt.payment?.kind === 'refund' ? 'Refunded' : 'Paid'}</span>
                  <span className="font-mono">{pkr(receipt.payment?.amount)}</span>
                </p>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

/* ---------------- 9. Restaurant Reports ---------------- */

export function RestaurantReportsPage() {
  const [from, setFrom] = useState(addDays(todayISO(), -29));
  const [to, setTo] = useState(todayISO());
  const [report, setReport] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ from, to });
      const res = await adminApi<any>(`/admin/restaurant/reports?${qs.toString()}`);
      setReport(res);
    } catch (err: any) {
      toast.error(err.message || 'Could not load restaurant reports');
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const maxDailySales = useMemo(
    () => Math.max(1, ...(report?.daily || []).map((d: any) => Number(d.sales || 0))),
    [report],
  );

  return (
    <AdminLayout title="Restaurant Reports">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Dining Revenue & Prep Analytics</h1>
            <p className="text-sm text-muted-foreground">
              {pretty(from)} – {pretty(to)}
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
            <Button variant="outline" onClick={load}>
              Apply
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Orders</p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{report?.totals?.orders ?? '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Sales</p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">
                {report ? pkr(report.totals?.sales) : '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tax & Service</p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">
                {report ? pkr(Number(report.totals?.tax || 0) + Number(report.totals?.service || 0)) : '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Avg Prep Time</p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">
                {report?.kots?.averagePrepMinutes != null ? `${report.kots.averagePrepMinutes} min` : '—'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="text-lg">Daily Sales Trend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(report?.daily || []).map((d: any) => (
                <div key={d._id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono">{pretty(d._id)} ({d.orders} orders)</span>
                    <span className="font-mono font-medium">{pkr(d.sales)}</span>
                  </div>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, (Number(d.sales || 0) / maxDailySales) * 100)}
                  />
                </div>
              ))}
              {(!report?.daily || report.daily.length === 0) && (
                <p className="py-8 text-center text-sm text-muted-foreground">No sales data in this date range.</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="text-lg">Popular Dishes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dish</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(report?.popular || []).map((item: any) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium">{item._id}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{pkr(item.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {(!report?.popular || report.popular.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        No dish data available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Settlement Mix</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Refunded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(report?.paymentMethods || []).map((m: any) => (
                  <TableRow key={m.method}>
                    <TableCell className="capitalize font-medium">{String(m.method).replaceAll('_', ' ')}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{pkr(m.received)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-destructive">{pkr(m.refunded)}</TableCell>
                  </TableRow>
                ))}
                {(!report?.paymentMethods || report.paymentMethods.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      No settlements recorded in range.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
