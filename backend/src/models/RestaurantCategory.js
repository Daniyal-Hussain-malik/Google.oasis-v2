import { Base, bool, int, text } from './_base.js';

export class RestaurantCategory extends Base {}
RestaurantCategory.setup(
  {
    name: { ...text({ len: 120, required: true }), unique: true },
    description: text({ len: 400 }),
    sortOrder: int(0),
    active: bool(true),
  },
  { table: 'restaurant_categories' },
);

export default RestaurantCategory;
