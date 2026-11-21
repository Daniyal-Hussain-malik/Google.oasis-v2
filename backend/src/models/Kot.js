import { Base, D, Row, bool, dt, enumCol, fk, int, rowColumns, text } from './_base.js';

export const KOT_STATUSES = ['new', 'accepted', 'preparing', 'ready', 'served'];
export const KOT_TYPES = ['original', 'supplementary', 'cancellation'];

class KotItemAddOn extends Row {}
KotItemAddOn.setup(
  { kotItemId: fk('kot_items', { required: true, onDelete: 'CASCADE' }), value: text({ len: 120 }), ...rowColumns },
  { table: 'kot_item_addons', timestamps: false },
);

class KotItem extends Row {}
KotItem.setup(
  {
    kotId: fk('kots', { required: true, onDelete: 'CASCADE' }),
    // The order line this ticket item is for.
    line: fk('restaurant_order_items'),
    name: text({ len: 160 }),
    variation: text({ len: 120 }),
    quantity: int(1),
    note: text({ len: 400 }),
    station: text({ len: 60, def: 'Kitchen' }),
    cancelled: bool(false),
    ...rowColumns,
  },
  { table: 'kot_items', timestamps: false, rowChildren: { addOns: { model: () => KotItemAddOn, fk: 'kotItemId', scalar: true } } },
);

export class Kot extends Base {}
Kot.setup(
  {
    kotNumber: { ...text({ len: 30, required: true }), unique: true },
    type: enumCol(KOT_TYPES, 'original'),
    sequence: int(1),
    status: enumCol([...KOT_STATUSES, 'cancelled', 'acknowledged'], 'new'),
    order: fk('restaurant_orders', { required: true, onDelete: 'CASCADE' }),
    orderNumber: text({ len: 30, allowNull: true }),
    orderType: text({ len: 30, allowNull: true }),
    guestName: text({ len: 120 }),
    roomNo: text({ len: 20 }),
    table: text({ len: 40 }),
    notes: text({ big: true }),
    reason: text({ len: 400 }),
    cancels: fk('kots'),
    businessDate: { type: D.STRING(10), allowNull: true },
    times_accepted: dt(),
    times_preparing: dt(),
    times_ready: dt(),
    times_served: dt(),
    times_cancelled: dt(),
    times_acknowledged: dt(),
    printCount: int(0),
    by: fk('users'),
  },
  {
    table: 'kots',
    nested: { times: ['accepted', 'preparing', 'ready', 'served', 'cancelled', 'acknowledged'] },
    children: { items: { model: () => KotItem, fk: 'kotId' } },
    indexes: [{ fields: ['status'] }, { fields: ['order'] }, { fields: ['businessDate'] }],
  },
);

export { KotItem, KotItemAddOn };
export default Kot;
