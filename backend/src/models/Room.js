import { Base, enumCol, fk, text } from './_base.js';

export class Room extends Base {}
Room.setup(
  {
    roomNo: { ...text({ len: 20, required: true }), unique: true },
    roomType: fk('room_types', { required: true }),
    floor: text({ len: 40 }),
    notes: text({ big: true }),
    status: enumCol(['active', 'out_of_order'], 'active'),
    housekeeping: enumCol(['clean', 'dirty', 'inspected'], 'clean'),
  },
  { table: 'rooms', indexes: [{ fields: ['roomType'] }] },
);

export default Room;
