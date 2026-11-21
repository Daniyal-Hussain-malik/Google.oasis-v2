import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Step, StepLabel, Stepper } from '@mui/material';
import { Minus, Plus, ShoppingBag, Trash2, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { GuestLayout } from '@/src/components/guest/GuestLayout';
import { GuestOtpGate } from '@/src/components/guest/GuestOtpGate';
import { InfoHoverCard, ShowcaseHoverCard } from '@/src/components/guest/InteractiveHoverCard';
import { PaymentAccounts, PaymentProofForm } from '@/src/components/guest/PaymentSection';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Separator } from '@/src/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/src/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Textarea } from '@/src/components/ui/textarea';
import { api, media, pkr } from '@/src/lib/api';

const KITCHEN_STEPS = [
  ['new', 'Received'],
  ['accepted', 'Accepted'],
  ['preparing', 'Preparing'],
  ['ready', 'Ready'],
  ['served', 'Served'],
];

const ORDER_TYPES: Array<[string, string]> = [
  ['room_service', 'To My Room'],
  ['dine_in', 'In the Restaurant'],
  ['takeaway', 'Takeaway (Collect)'],
];

interface CartLine {
  key: string;
  menuItemId: number | string;
  name: string;
  price: number;
  variation: { id: number | string; name: string; price: number } | null;
  addOns: Array<{ id: number | string; name: string; price: number }>;
  quantity: number;
  note: string;
}

function lineUnit(line: CartLine) {
  const base = line.variation ? line.variation.price : line.price;
  return base + line.addOns.reduce((sum, a) => sum + a.price, 0);
}

export function OrderPage() {
  const [session, setSession] = useState<any>(null);

  const [menuData, setMenuData] = useState<any>({ items: [], categories: [], rates: { tax: 0, service: 0 } });
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeItem, setActiveItem] = useState<any | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState('room_service');
  const [roomNo, setRoomNo] = useState('');
  const [tableNo, setTableNo] = useState('');
  const [paymentMode, setPaymentMode] = useState<'room_charge' | 'pay_now'>('room_charge');
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [payingOrder, setPayingOrder] = useState<any | null>(null);

  const rooms: Array<{ roomNo: string; type?: string }> = session?.guest?.rooms || [];
  const canOrder = Boolean(session?.canOrder);

  useEffect(() => {
    if (rooms.length === 1 && !roomNo) {
      setRoomNo(rooms[0].roomNo);
    }
  }, [rooms, roomNo]);

  const loadMenu = useCallback(() => {
    api<any>('/public/restaurant/menu')
      .then((res) => setMenuData(res))
      .catch(() => {});
  }, []);

  const openDiningSession = useCallback(async (bookingNumber?: string) => {
    const res = await api<any>('/public/restaurant/session', {
      method: 'POST',
      body: bookingNumber ? { bookingNumber } : {},
    });
    setSession(res);
    const firstRoom = res?.guest?.rooms?.[0]?.roomNo || '';
    if (res?.guest?.rooms?.length === 1) setRoomNo(firstRoom);
    return res;
  }, []);

  const loadOrders = useCallback(async () => {
    if (!session) return;
    try {
      const list = await api<any[]>('/public/restaurant/orders');
      setOrders(list);
    } catch (err: any) {
      if (/expired|ended|open|book|verify|passcode/i.test(err.message || '')) {
        setSession(null);
      }
    }
  }, [session]);

  useEffect(() => {
    loadMenu();
    openDiningSession().catch(() => {});
  }, [loadMenu, openDiningSession]);

  useEffect(() => {
    if (!session) return;
    loadOrders();
    const timer = window.setInterval(loadOrders, 15000);
    return () => window.clearInterval(timer);
  }, [session, loadOrders]);

  async function signOut() {
    await api('/public/guest/logout', { method: 'POST' }).catch(() => {});
    setSession(null);
    setOrders([]);
    setRoomNo('');
  }

  function addToCart(line: Omit<CartLine, 'key'>) {
    const key = [
      line.menuItemId,
      line.variation?.id || '',
      line.addOns.map((a) => a.id).sort().join(','),
      line.note,
    ].join('|');

    setCart((prev) => {
      const existing = prev.find((p) => p.key === key);
      if (existing) {
        return prev.map((p) => (p.key === key ? { ...p, quantity: p.quantity + line.quantity } : p));
      }
      return [...prev, { ...line, key }];
    });
    toast.success(`Added ${line.name}`);
  }

  function adjustQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => (item.key === key ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  const taxRate = Number(menuData?.rates?.tax || 0);
  const serviceRate = Number(menuData?.rates?.service || 0);
  const subtotal = useMemo(() => cart.reduce((sum, l) => sum + lineUnit(l) * l.quantity, 0), [cart]);
  const tax = Math.round((subtotal * taxRate) / 100);
  const service = Math.round((subtotal * serviceRate) / 100);
  const grandTotal = subtotal + tax + service;

  async function placeOrder() {
    if (!cart.length) return;
    if (rooms.length > 1 && !roomNo) {
      toast.error('Please choose which room this order is for.');
      return;
    }
    setPlacing(true);
    try {
      const created = await api<any>('/public/restaurant/orders', {
        method: 'POST',
        body: {
          type: orderType,
          paymentMode,
          roomNo: roomNo || rooms[0]?.roomNo || '',
          table: orderType === 'dine_in' ? tableNo.trim() : undefined,
          notes: notes.trim(),
          items: cart.map((l) => ({
            menuItemId: l.menuItemId,
            variationId: l.variation?.id || null,
            addOnIds: l.addOns.map((a) => a.id),
            quantity: l.quantity,
            note: l.note,
          })),
        },
      });
      setCart([]);
      setNotes('');
      setTableNo('');
      setCartOpen(false);
      await loadOrders();
      toast.success(`Order ${created.orderNumber} sent to kitchen`);
      if (paymentMode === 'pay_now') setPayingOrder(created);
    } catch (err: any) {
      toast.error(err.message || 'Could not place order');
    } finally {
      setPlacing(false);
    }
  }

  async function cancelOrder(id: string | number) {
    try {
      await api(`/public/restaurant/orders/${id}/cancel`, { method: 'POST' });
      toast.success('Order cancelled');
      await loadOrders();
    } catch (err: any) {
      toast.error(err.message || 'Cannot cancel this order');
    }
  }

  const categories = ['All', ...Array.from(new Set((menuData.items || []).map((i: any) => i.category))) as string[]];
  const visibleItems = (menuData.items || []).filter(
    (item: any) => activeCategory === 'All' || item.category === activeCategory,
  );

  const CartSummary = (
    <div className="space-y-4">
      {cart.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Tap Add on a dish to start.</p>
      ) : (
        <>
          <div className="space-y-3">
            {cart.map((line) => (
              <div key={line.key} className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {line.name}
                    {line.variation ? ` · ${line.variation.name}` : ''}
                  </p>
                  {line.addOns.length > 0 && (
                    <p className="text-xs text-muted-foreground">+ {line.addOns.map((a) => a.name).join(', ')}</p>
                  )}
                  <Input
                    className="mt-1.5 h-7 text-xs"
                    placeholder="Special instructions"
                    maxLength={200}
                    value={line.note}
                    onChange={(e) =>
                      setCart((list) => list.map((x) => (x.key === line.key ? { ...x, note: e.target.value } : x)))
                    }
                  />
                  <p className="mt-1 font-mono text-xs font-medium tabular-nums">{pkr(lineUnit(line) * line.quantity)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => adjustQty(line.key, -1)}>
                    {line.quantity === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  </Button>
                  <span className="w-6 text-center font-mono text-xs tabular-nums">{line.quantity}</span>
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => adjustQty(line.key, 1)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Deliver</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {ORDER_TYPES.map(([k, label]) => (
                <Button
                  key={k}
                  type="button"
                  size="sm"
                  variant={orderType === k ? 'default' : 'outline'}
                  className="text-xs px-2 h-auto py-1.5"
                  onClick={() => setOrderType(k)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {rooms.length > 1 && (
            <div className="space-y-1.5">
              <Label>Room</Label>
              <Select value={roomNo} onValueChange={setRoomNo}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose room…" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.roomNo} value={r.roomNo}>
                      Room {r.roomNo} {r.type ? `· ${r.type}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {orderType === 'dine_in' && (
            <div className="space-y-1.5">
              <Label>Table (optional)</Label>
              <Input value={tableNo} onChange={(e) => setTableNo(e.target.value)} placeholder="e.g. Garden 2" />
            </div>
          )}

          <div className="space-y-2">
            <Label>Payment</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={paymentMode === 'room_charge' ? 'accent' : 'outline'}
                onClick={() => setPaymentMode('room_charge')}
              >
                Charge to Room
              </Button>
              <Button
                type="button"
                size="sm"
                variant={paymentMode === 'pay_now' ? 'accent' : 'outline'}
                onClick={() => setPaymentMode('pay_now')}
              >
                Pay Now
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {paymentMode === 'room_charge'
                ? 'Added to your bill when served and paid at checkout.'
                : 'Settle separately by Easypaisa or bank transfer in My Orders.'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Notes for the Kitchen</Label>
            <Textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Spice level, cutlery, tea timing..." />
          </div>

          <div className="space-y-1 border-t border-border pt-3 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{pkr(subtotal)}</span>
            </div>
            {tax > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax ({taxRate}%)</span>
                <span className="font-mono tabular-nums">{pkr(tax)}</span>
              </div>
            )}
            {service > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Service charge ({serviceRate}%)</span>
                <span className="font-mono tabular-nums">{pkr(service)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-sm font-semibold text-foreground">
              <span>Total</span>
              <span className="font-mono tabular-nums">{pkr(grandTotal)}</span>
            </div>
          </div>

          <Button type="button" variant="accent" className="w-full" disabled={placing} onClick={placeOrder}>
            {placing ? 'Placing order…' : `Place Order · ${pkr(grandTotal)}`}
          </Button>
        </>
      )}
    </div>
  );

  return (
    <GuestLayout>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {!session ? (
          <div className="mx-auto max-w-xl space-y-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-accent">In-Room Dining</p>
              <h1 className="font-display mt-1 text-4xl font-semibold sm:text-5xl">Order from the kitchen</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Available to checked-in guests. Enter your booking number and phone to send dishes to your hut and post to your room bill.
              </p>
            </div>

            <Card>
              <CardContent className="p-6">
                <GuestOtpGate
                  ctaLabel="Open Dining Menu"
                  onVerified={async (res) => {
                    try {
                      await openDiningSession(res.bookingNumber);
                      toast.success(`Signed in for ${res.guestName}`);
                    } catch (err: any) {
                      toast.error(err.message || 'This booking is not open for ordering yet');
                    }
                  }}
                />
              </CardContent>
            </Card>

            <Alert severity="info">
              Not checked in yet? Browse our <Link to="/dining" className="font-semibold underline">dining notes</Link> or inspect your <Link to="/booking" className="font-semibold underline">booking status</Link>.
            </Alert>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
              <div>
                <p className="font-mono text-xs text-accent">
                  {rooms.length ? `Room ${rooms.map((r) => r.roomNo).join(', ')} · ` : ''}
                  {session.guest?.bookingNumber}
                </p>
                <h1 className="font-display mt-1 text-4xl font-semibold">Oasis Kitchen</h1>
                <p className="text-sm text-muted-foreground">Signed in as {session.guest?.name}</p>
              </div>
              <div className="flex items-center gap-3">
                {canOrder && (
                  <Sheet open={cartOpen} onOpenChange={setCartOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" className="lg:hidden">
                        <ShoppingBag className="h-4 w-4" />
                        Tray ({cart.reduce((s, i) => s + i.quantity, 0)})
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle className="font-display text-2xl">Your Dining Tray</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">{CartSummary}</div>
                    </SheetContent>
                  </Sheet>
                )}
                <Button variant="ghost" size="sm" onClick={signOut}>
                  Exit Dining
                </Button>
              </div>
            </div>

            {!canOrder && (
              <Alert severity="info">
                Food ordering opens once reception marks your stay as checked in.
              </Alert>
            )}

            {orders.length > 0 && (
              <div className="space-y-4">
                <h2 className="font-display text-2xl font-semibold">My Orders</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {orders.map((ord) => {
                    const stepIdx = Math.max(0, KITCHEN_STEPS.findIndex(([k]) => k === ord.status));
                    const orderId = ord.id || ord._id;
                    return (
                      <Card key={orderId}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="font-mono text-base">
                                {ord.orderNumber} {ord.roomNo ? `· Room ${ord.roomNo}` : ''}
                              </CardTitle>
                              <CardDescription>
                                {(ord.items || []).map((i: any) => `${i.quantity}× ${i.name}${i.variation ? ` (${i.variation})` : ''}`).join(', ')}
                              </CardDescription>
                            </div>
                            <span className="font-mono text-sm font-semibold tabular-nums">{pkr(ord.total)}</span>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {ord.status === 'cancelled' ? (
                            <Alert severity="warning">
                              Order cancelled{ord.cancelReason ? `: ${ord.cancelReason}` : ''}
                            </Alert>
                          ) : (
                            <Stepper activeStep={stepIdx} alternativeLabel>
                              {KITCHEN_STEPS.map(([k, label]) => (
                                <Step key={k}>
                                  <StepLabel>{label}</StepLabel>
                                </Step>
                              ))}
                            </Stepper>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>
                              {ord.paymentMode === 'room_charge' ? 'Room charge' : `Pay now · ${ord.paymentStatus?.replaceAll('_', ' ')}`}
                            </span>
                            <div className="flex gap-2">
                              {ord.status === 'new' && (
                                <Button type="button" variant="destructive" size="sm" onClick={() => cancelOrder(orderId)}>
                                  Cancel Order
                                </Button>
                              )}
                              {ord.paymentMode === 'pay_now' && ord.paidAmount < ord.total && ord.status !== 'cancelled' && (
                                <Button type="button" variant="outline" size="sm" onClick={() => setPayingOrder(ord)}>
                                  Submit Payment Proof
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={`grid gap-8 ${canOrder ? 'lg:grid-cols-[1fr_360px]' : ''}`}>
              <div className="space-y-6">
                <Tabs value={activeCategory} onValueChange={setActiveCategory}>
                  <TabsList className="flex-wrap h-auto">
                    {categories.map((cat) => (
                      <TabsTrigger key={cat} value={cat}>
                        {cat}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                <div className="grid gap-4 sm:grid-cols-2">
                  {visibleItems.map((item: any) => {
                    const hasVars = item.variations?.length > 0;
                    const priceLabel = hasVars
                      ? `from ${pkr(Math.min(...item.variations.map((v: any) => v.price)))}`
                      : pkr(item.price);
                    const addButton = (
                      <Button
                        type="button"
                        variant="accent"
                        size="sm"
                        className="w-full"
                        disabled={!canOrder}
                        onClick={() => setActiveItem(item)}
                      >
                        <UtensilsCrossed className="h-3.5 w-3.5" />
                        Add to Tray
                      </Button>
                    );

                    return item.image ? (
                      <ShowcaseHoverCard
                        key={item._id}
                        image={media(item.image)}
                        alt={item.name}
                        kicker={item.category}
                        price={priceLabel}
                        title={item.name}
                        description={item.description}
                        heightClass="h-64"
                        actions={addButton}
                      />
                    ) : (
                      <div key={item._id} className="space-y-2">
                        <InfoHoverCard
                          label={item.category}
                          title={item.name}
                          detail={item.description || 'Prepared fresh in the Oasis kitchen.'}
                          meta={priceLabel}
                          heightClass="min-h-[160px]"
                        />
                        {addButton}
                      </div>
                    );
                  })}
                </div>
              </div>

              {canOrder && (
                <aside className="hidden lg:block h-fit sticky top-24">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="font-display text-2xl">Your Dining Tray</CardTitle>
                    </CardHeader>
                    <CardContent>{CartSummary}</CardContent>
                  </Card>
                </aside>
              )}
            </div>
          </div>
        )}
      </div>

      <ItemCustomizeDialog item={activeItem} onClose={() => setActiveItem(null)} onAdd={addToCart} />

      <Dialog open={Boolean(payingOrder)} onOpenChange={(o) => !o && setPayingOrder(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {payingOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Pay Order {payingOrder.orderNumber}</DialogTitle>
                <DialogDescription>Transfer {pkr(payingOrder.total - payingOrder.paidAmount)} and submit your TID.</DialogDescription>
              </DialogHeader>
              <PaymentAccounts amount={payingOrder.total - payingOrder.paidAmount} />
              <Separator />
              <PaymentProofForm
                defaultAmount={payingOrder.total - payingOrder.paidAmount}
                submit={(f) =>
                  api(`/public/restaurant/orders/${payingOrder.id || payingOrder._id}/payment-claim`, {
                    method: 'POST',
                    body: f,
                  })
                }
                onSent={() => {
                  setPayingOrder(null);
                  loadOrders();
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </GuestLayout>
  );
}

function ItemCustomizeDialog({
  item,
  onClose,
  onAdd,
}: {
  item: any | null;
  onClose: () => void;
  onAdd: (line: Omit<CartLine, 'key'>) => void;
}) {
  const [variationId, setVariationId] = useState<string>('');
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!item) return;
    const firstVar = item.variations?.[0];
    setVariationId(firstVar ? String(firstVar.id ?? firstVar._id) : '');
    setAddOnIds([]);
    setQuantity(1);
    setNote('');
  }, [item]);

  if (!item) return null;

  const chosenVar = (item.variations || []).find((v: any) => String(v.id ?? v._id) === variationId) || null;
  const chosenAddOns = (item.addOns || []).filter((a: any) => addOnIds.includes(String(a.id ?? a._id)));
  const unitPrice = (chosenVar ? chosenVar.price : item.price) + chosenAddOns.reduce((s: number, a: any) => s + a.price, 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({
      menuItemId: item._id,
      name: item.name,
      price: item.price,
      variation: chosenVar ? { id: chosenVar.id ?? chosenVar._id, name: chosenVar.name, price: chosenVar.price } : null,
      addOns: chosenAddOns.map((a: any) => ({ id: a.id ?? a._id, name: a.name, price: a.price })),
      quantity,
      note: note.trim(),
    });
    onClose();
  }

  return (
    <Dialog open={Boolean(item)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">{item.name}</DialogTitle>
          {item.description && <DialogDescription>{item.description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {item.variations?.length > 0 && (
            <div className="space-y-2">
              <Label>Portion / Style</Label>
              <div className="space-y-1.5">
                {item.variations.map((v: any) => {
                  const vid = String(v.id ?? v._id);
                  return (
                    <label
                      key={vid}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${
                        variationId === vid ? 'border-accent bg-accent/10' : 'border-border'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="variation"
                          checked={variationId === vid}
                          onChange={() => setVariationId(vid)}
                        />
                        {v.name}
                      </span>
                      <span className="font-mono font-medium tabular-nums">{pkr(v.price)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {item.addOns?.length > 0 && (
            <div className="space-y-2">
              <Label>Add-ons</Label>
              <div className="space-y-1.5">
                {item.addOns.map((a: any) => {
                  const sid = String(a.id ?? a._id);
                  const checked = addOnIds.includes(sid);
                  return (
                    <label
                      key={sid}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setAddOnIds((prev) => (e.target.checked ? [...prev, sid] : prev.filter((x) => x !== sid)))
                          }
                        />
                        {a.name}
                      </span>
                      <span className="font-mono text-xs tabular-nums">+{pkr(a.price)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min={1} max={20} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div className="space-y-1.5">
              <Label>Special Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Less spicy..." />
            </div>
          </div>

          <Button type="submit" variant="accent" className="w-full">
            Add to Tray · <span className="font-mono tabular-nums">{pkr(unitPrice * quantity)}</span>
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
