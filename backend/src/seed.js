// Loads the resort's rooms, menu and website copy. Safe to run more than once:
// existing records are updated by name, reservations are never touched.
// Pass --reset to wipe rooms, menu and settings first (reservations stay).
import { connectDb, disconnectDb } from './config/db.js';
import { createSchema } from './db/schema.js';
import { migrateRoles } from './services/rolesMigration.js';
import { env } from './config/env.js';
import MenuItem from './models/MenuItem.js';
import Room from './models/Room.js';
import RoomType from './models/RoomType.js';
import Settings from './models/Settings.js';
import User from './models/User.js';
import RestaurantCategory from './models/RestaurantCategory.js';
import { ensureCategories } from './services/restaurant.js';

const roomTypes = [
  {
    name: 'Superior Twin',
    slug: 'superior-twin',
    description: 'A carved bed, a chair, and a television. The quieter hut on the row, with the same breakfast as the rest of the house.',
    image: '/photos/room-chair.jpg',
    bed: 'Twin beds',
    size: '260 sq ft',
    maxAdults: 2,
    maxChildren: 1,
    baseRate: 15000,
    weekendRate: 17000,
    amenities: ['Valley window', 'Twin beds', 'Heater', 'Tea tray', 'Breakfast included'],
    sortOrder: 1,
    rooms: ['118', '119'],
  },
  {
    name: 'Deluxe Hut',
    slug: 'deluxe-hut',
    description: 'The dune and the ridge are the view from the bed. Yellow curtains, two chairs, and breakfast included.',
    image: '/photos/official/room-window.jpg',
    bed: 'King bed',
    size: '320 sq ft',
    maxAdults: 2,
    maxChildren: 2,
    baseRate: 18000,
    weekendRate: 21000,
    amenities: ['Valley view', 'King bed', 'Carved wood', 'Heater', 'Breakfast included'],
    sortOrder: 2,
    // 101 is the step-free room.
    rooms: ['101', '102', '103', '104', '105', '106', '107', '108'],
  },
  {
    name: 'Premium Hut',
    slug: 'premium-hut',
    description: 'The red-wall room: a carved bed, a kilim, and air conditioning. An extra mattress is PKR 2,500 if you ask the desk ahead.',
    image: '/photos/official/cottage.jpg',
    bed: 'King bed',
    size: '360 sq ft',
    maxAdults: 3,
    maxChildren: 2,
    baseRate: 22000,
    weekendRate: 25000,
    amenities: ['Terrace doors', 'King bed', 'Oasis linen', 'Heater', 'Extra mattress on request'],
    sortOrder: 3,
    rooms: ['109', '110', '111'],
  },
  {
    name: 'Executive Room',
    slug: 'executive-room',
    description: 'Two armchairs at the valley window, a kilim, and the television on the side wall. Breakfast is included.',
    image: '/photos/official/executive.jpg',
    bed: 'King bed',
    size: '400 sq ft',
    maxAdults: 2,
    maxChildren: 2,
    baseRate: 25000,
    weekendRate: 28000,
    amenities: ['Valley view', 'King bed', 'Carved wood', 'Heater', 'Breakfast included'],
    sortOrder: 4,
    rooms: ['112', '113', '114', '115'],
  },
  {
    name: 'Family Hut',
    slug: 'family-hut',
    description: 'Room for four adults and three children: a carved king bed, a second bed, a kilim, and the heater already on in winter.',
    image: '/photos/room-red.jpg',
    bed: 'King + twin',
    size: '480 sq ft',
    maxAdults: 4,
    maxChildren: 3,
    baseRate: 32000,
    weekendRate: 36000,
    amenities: ['Terrace doors', 'King and twin beds', 'Oasis linen', 'Heater', 'Extra mattress on request'],
    sortOrder: 5,
    rooms: ['116', '117'],
  },
];

const menu = [
  ['Chicken Karahi', 'Mains', 'Cooked to order in the iron karahi, with naan.', 2800, '/photos/menu/karahi.jpg'],
  ['Chicken Biryani', 'Mains', 'Basmati, spice, and raita on the side.', 1800, '/photos/menu/biryani.jpg'],
  ['Daal Mash', 'Mains', 'The kitchen’s daal, with rice or roti.', 1100, '/photos/menu/daal.jpg'],
  ['Grilled Trout', 'Mains', 'River fish from the valley, grilled, with lemon and salad.', 3200, '/photos/menu/grilled-fish.jpg'],
  ['Cheese Omelette', 'Breakfast', 'Included with breakfast. Charged as a room-service order after eleven.', 650, '/photos/menu/omelette.jpg'],
  ['Sweet Lassi', 'Drinks', 'Yoghurt, sugar, and ice.', 450, '/photos/menu/lassi.jpg'],
  ['Fresh Lime', 'Drinks', 'Sweet or salted, with soda.', 400, '/photos/menu/lime.jpg'],
  ['Coffee', 'Drinks', 'Brewed, with milk on the side.', 500, '/photos/menu/coffee.jpg'],
];

const activities = [
  ['/photos/evening-jeep.jpg', 'Jeep safari', 'A loop through the dunes. The jeep waits by the hut. The desk books it for the afternoon you name, and the charge posts to the room bill.'],
  ['/photos/cottages-cloud.jpg', 'Sandboarding', 'Boards are at reception. Go out while the sand is still cool. In winter this is a snow walk on the same ground, not a board.'],
  ['/photos/night-grounds.jpg', 'Open-air cinema', 'A film after dark when the wind allows. Ask at breakfast. There is no ticket. If the weather turns, the evening moves inside.'],
  ['/photos/bonfire-fire.jpg', 'Bonfire', 'Laid on the dune side. Tell the desk by six if you want one that night, and say how many chairs.'],
  ['/photos/deluxe-nook.jpg', 'A quiet hour', 'The window seat is the lounge. Board games are at the desk. No booking, and no separate bill.'],
  ['/photos/shangrila-lake.jpg', 'Shangrila day', 'Lower Kachura, not the resort. The desk arranges the jeep and a return time so you are back before dark.'],
];

const settings = {
  name: 'Oasis Resort Skardu',
  phone: '0344-5537788',
  phones: ['0308-1472888', '0344-5537788', '0355-4114567'],
  email: 'oasisresortskardu@gmail.com',
  whatsapp: '923445537788',
  address: 'Cold desert, Katpana, Skardu 16100, Gilgit-Baltistan, Pakistan',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  policies: 'Check-in is from 2:00 PM and check-out is by 12:00 PM. Cancellation is free until 48 hours before arrival; after that the first night is charged. Every adult shows an identity document at the desk, and guests who are not Pakistani also show a visa.',
  childPolicy: 'Children stay free with the adults named on the booking and eat from the same breakfast. An extra mattress is PKR 2,500 if you tell the desk ahead.',
  heroTitle: 'Oasis Resort',
  heroLede: 'A peaceful retreat surrounded by desert dunes and majestic mountains.',
  activities: activities.map(([image, title, body]) => ({ image, title, body })),
};

async function seed() {
  const reset = process.argv.includes('--reset');
  await connectDb();
  await createSchema();
  await migrateRoles();

  if (reset) {
    await MenuItem.destroy({ where: {} });
    await Settings.destroy({ where: {} });
    console.log('Cleared menu and settings.');
  }

  for (const { rooms, ...type } of roomTypes) {
    const saved = (await RoomType.findOne({ where: { slug: type.slug } })) || RoomType.make({ slug: type.slug });
    Object.assign(saved, type);
    await saved.save();
    for (const roomNo of rooms) {
      const room = await Room.findOne({ where: { roomNo } });
      if (room) {
        room.roomType = saved.id;
        await room.save();
      } else {
        await Room.create({ roomNo, roomType: saved.id, status: 'active', notes: roomNo === '101' ? 'Step-free room' : '' });
      }
    }
  }
  console.log(`Room types: ${roomTypes.length}, rooms: ${await Room.count()}`);

  for (const [index, [name, category, description, price, image]] of menu.entries()) {
    const item = (await MenuItem.findOne({ where: { name } })) || MenuItem.make({ name });
    Object.assign(item, { category, description, price, image, sortOrder: index, available: true });
    await item.save();
  }
  console.log(`Menu items: ${await MenuItem.count()}`);
  await ensureCategories();
  console.log(`Restaurant categories: ${await RestaurantCategory.count()}`);

  const hotel = (await Settings.findOne({ where: { key: 'hotel' } })) || Settings.make({ key: 'hotel' });
  Object.assign(hotel, settings);
  await hotel.save();
  console.log('Hotel settings saved.');

  if (!(await User.count({ where: { email: env.adminEmail.toLowerCase() } }))) {
    await User.create({ name: 'Resort Admin', email: env.adminEmail, password: env.adminPassword, role: 'super_admin' });
    console.log(`Admin created: ${env.adminEmail} (change the password after the first sign-in)`);
  } else {
    console.log(`Admin exists: ${env.adminEmail}`);
  }

  await disconnectDb();
}

seed().catch(async (error) => {
  console.error(error);
  await disconnectDb();
  process.exit(1);
});
