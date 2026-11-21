import { Base, D, fk } from './_base.js';

// One row per room per night that is sold. The unique (room, date) pair is what
// stops two bookings taking the same room on the same night.
export class RoomNight extends Base {}
RoomNight.setup(
  {
    room: fk('rooms', { required: true, onDelete: 'CASCADE' }),
    date: { type: D.STRING(10), allowNull: false },
    reservation: fk('reservations', { required: true, onDelete: 'CASCADE' }),
  },
  { table: 'room_nights', timestamps: false, indexes: [{ unique: true, fields: ['room', 'date'] }, { fields: ['date'] }, { fields: ['reservation'] }] },
);

export default RoomNight;
