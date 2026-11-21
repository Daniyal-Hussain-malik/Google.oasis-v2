import { Base, D, Row, bool, fk, int, rowColumns, text } from './_base.js';

class RoomTypeImage extends Row {}
RoomTypeImage.setup(
  { roomTypeId: fk('room_types', { required: true, onDelete: 'CASCADE' }), value: { type: D.TEXT, allowNull: false }, ...rowColumns },
  { table: 'room_type_gallery', timestamps: false },
);

class RoomTypeAmenity extends Row {}
RoomTypeAmenity.setup(
  { roomTypeId: fk('room_types', { required: true, onDelete: 'CASCADE' }), value: text({ len: 120, required: true }), ...rowColumns },
  { table: 'room_type_amenities', timestamps: false },
);

export class RoomType extends Base {}
RoomType.setup(
  {
    name: { ...text({ len: 120, required: true }), unique: true },
    slug: { ...text({ len: 120, required: true, lower: true }), unique: true },
    description: text({ big: true }),
    image: text({ big: true }),
    bed: text({ len: 80 }),
    size: text({ len: 80 }),
    maxAdults: int(2, { validate: { min: 1 } }),
    maxChildren: int(2, { validate: { min: 0 } }),
    baseRate: { type: D.DOUBLE, allowNull: false, validate: { min: 0 } },
    weekendRate: { type: D.DOUBLE, allowNull: true, validate: { min: 0 } },
    sortOrder: int(0),
    active: bool(true),
  },
  {
    table: 'room_types',
    children: {
      gallery: { model: () => RoomTypeImage, fk: 'roomTypeId', scalar: true },
      amenities: { model: () => RoomTypeAmenity, fk: 'roomTypeId', scalar: true },
    },
  },
);

export { RoomTypeAmenity, RoomTypeImage };
export default RoomType;
