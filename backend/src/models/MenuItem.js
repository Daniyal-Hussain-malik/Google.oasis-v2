import { Base, Row, bool, fk, int, money, rowColumns, text } from './_base.js';

const parent = () => fk('menu_items', { required: true, onDelete: 'CASCADE' });

class MenuVariation extends Row {}
MenuVariation.setup(
  { menuItemId: parent(), name: text({ len: 120, required: true }), price: money(0, { validate: { min: 0 } }), ...rowColumns },
  { table: 'menu_item_variations', timestamps: false },
);

class MenuAddOn extends Row {}
MenuAddOn.setup(
  { menuItemId: parent(), name: text({ len: 120, required: true }), price: money(0, { validate: { min: 0 } }), ...rowColumns },
  { table: 'menu_item_addons', timestamps: false },
);

export class MenuItem extends Base {}
MenuItem.setup(
  {
    name: text({ len: 160, required: true }),
    // The category name is kept next to categoryId so old dishes and the till keep working by name.
    category: text({ len: 120, required: true }),
    categoryId: fk('restaurant_categories'),
    description: text({ big: true }),
    price: money(0, { validate: { min: 0 } }),
    image: text({ big: true }),
    available: bool(true),
    sortOrder: int(0),
    station: text({ len: 60, def: 'Kitchen' }),
    prepMinutes: int(15, { validate: { min: 0 } }),
  },
  {
    table: 'menu_items',
    children: {
      variations: { model: () => MenuVariation, fk: 'menuItemId' },
      addOns: { model: () => MenuAddOn, fk: 'menuItemId' },
    },
    indexes: [{ fields: ['categoryId'] }, { fields: ['category'] }],
  },
);

export { MenuAddOn, MenuVariation };
export default MenuItem;
