import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { createSchema } from './db/schema.js';
import BlogPost from './models/BlogPost.js';
import Enquiry from './models/Enquiry.js';
import Feedback from './models/Feedback.js';
import MenuItem from './models/MenuItem.js';
import { purgeInsights } from './models/Insight.js';
import Reservation from './models/Reservation.js';
import RestaurantCategory from './models/RestaurantCategory.js';
import Room from './models/Room.js';
import RoomNight from './models/RoomNight.js';
import RoomType from './models/RoomType.js';
import Settings from './models/Settings.js';
import User from './models/User.js';
import { createReservation } from './services/booking.js';
import { ensureCategories } from './services/restaurant.js';
import { migrateRoles } from './services/rolesMigration.js';
import { addDays, todayIn } from './utils/dates.js';

const roomTypesSeed = [
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

const menuSeed = [
  { name: 'Chicken Karahi', category: 'Mains', description: 'Cooked to order in the iron karahi, with naan.', price: 2800, image: '/photos/menu/karahi.jpg', variations: [{ name: 'Half Karahi', price: 1650 }, { name: 'Full Karahi', price: 2800 }], addOns: [{ name: 'Extra Butter Naan', price: 150 }, { name: 'Fresh Mint Raita', price: 220 }] },
  { name: 'Chicken Biryani', category: 'Mains', description: 'Basmati, spice, and raita on the side.', price: 1800, image: '/photos/menu/biryani.jpg', variations: [], addOns: [{ name: 'Shami Kabab (2 pcs)', price: 400 }] },
  { name: 'Daal Mash', category: 'Mains', description: "The kitchen's daal, with rice or roti.", price: 1100, image: '/photos/menu/daal.jpg', variations: [], addOns: [{ name: 'Tandoori Roti (2 pcs)', price: 120 }] },
  { name: 'Grilled Trout', category: 'Mains', description: 'River fish from the valley, grilled, with lemon and salad.', price: 3200, image: '/photos/menu/grilled-fish.jpg', variations: [], addOns: [{ name: 'Garlic Butter Herb Sauce', price: 250 }] },
  { name: 'Cheese Omelette', category: 'Breakfast', description: 'Included with breakfast. Charged as a room-service order after eleven.', price: 650, image: '/photos/menu/omelette.jpg', variations: [], addOns: [{ name: 'Toasted Sourdough', price: 180 }] },
  { name: 'Sweet Lassi', category: 'Drinks', description: 'Yoghurt, sugar, and ice.', price: 450, image: '/photos/menu/lassi.jpg', variations: [{ name: 'Sweet', price: 450 }, { name: 'Salted', price: 450 }], addOns: [] },
  { name: 'Fresh Lime', category: 'Drinks', description: 'Sweet or salted, with soda.', price: 400, image: '/photos/menu/lime.jpg', variations: [{ name: 'Sweet Soda', price: 400 }, { name: 'Salted Soda', price: 400 }], addOns: [] },
  { name: 'Coffee', category: 'Drinks', description: 'Brewed, with milk on the side.', price: 500, image: '/photos/menu/coffee.jpg', variations: [{ name: 'Black', price: 450 }, { name: 'With Warm Milk', price: 500 }], addOns: [] },
];

const activitiesSeed = [
  ['/photos/evening-jeep.jpg', 'Jeep safari', 'A loop through the dunes. The jeep waits by the hut. The desk books it for the afternoon you name, and the charge posts to the room bill.'],
  ['/photos/cottages-cloud.jpg', 'Sandboarding', 'Boards are at reception. Go out while the sand is still cool. In winter this is a snow walk on the same ground, not a board.'],
  ['/photos/night-grounds.jpg', 'Open-air cinema', 'A film after dark when the wind allows. Ask at breakfast. There is no ticket. If the weather turns, the evening moves inside.'],
  ['/photos/bonfire-fire.jpg', 'Bonfire', 'Laid on the dune side. Tell the desk by six if you want one that night, and say how many chairs.'],
  ['/photos/deluxe-nook.jpg', 'A quiet hour', 'The window seat is the lounge. Board games are at the desk. No booking, and no separate bill.'],
  ['/photos/shangrila-lake.jpg', 'Shangrila day', 'Lower Kachura, not the resort. The desk arranges the jeep and a return time so you are back before dark.'],
];

export async function bootstrapBackend() {
  await connectDb();
  await createSchema();
  await migrateRoles();

  const existingRooms = await RoomType.count();
  if (existingRooms === 0) {
    for (const { rooms, ...type } of roomTypesSeed) {
      const saved = RoomType.make({ slug: type.slug });
      Object.assign(saved, type);
      await saved.save();
      for (const roomNo of rooms) {
        await Room.create({
          roomNo,
          roomType: saved.id,
          status: 'active',
          notes: roomNo === '101' ? 'Step-free access' : '',
        });
      }
    }
  }

  if ((await MenuItem.count()) === 0) {
    for (const [index, itemData] of menuSeed.entries()) {
      const item = MenuItem.make({ name: itemData.name });
      Object.assign(item, {
        ...itemData,
        sortOrder: index,
        available: true,
        station: itemData.category === 'Drinks' ? 'Bar' : 'Kitchen',
      });
      await item.save();
    }
  }

  await ensureCategories();

  const hotel = (await Settings.findOne({ where: { key: 'hotel' } })) || Settings.make({ key: 'hotel' });
  if (!hotel.heroTitle) {
    Object.assign(hotel, {
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
      activities: activitiesSeed.map(([image, title, body]) => ({ image, title, body })),
      taxRate: 5,
      restaurantTaxRate: 5,
      restaurantServiceRate: 5,
    });
    await hotel.save();
  }
  await Settings.current();

  if (!(await User.count({ where: { email: env.adminEmail.toLowerCase() } }))) {
    await User.create({ name: 'Kashif Hassan (Admin)', email: env.adminEmail, password: env.adminPassword, role: 'super_admin' });
  }
  if (!(await User.count({ where: { email: 'desk@oasisresort.pk' } }))) {
    await User.create({ name: 'Amina Balti (Front Desk)', email: 'desk@oasisresort.pk', password: 'DeskPassword123!', role: 'frontdesk' });
  }
  if (!(await User.count({ where: { email: 'chef@oasisresort.pk' } }))) {
    await User.create({ name: 'Ustad Tariq (Head Chef)', email: 'chef@oasisresort.pk', password: 'ChefPassword123!', role: 'chef' });
  }

  // Seed realistic initial reservations, published reviews, and blog post if empty
  if ((await Reservation.count()) === 0) {
    const today = todayIn(env.timezone);
    const deluxe = await RoomType.findOne({ where: { slug: 'deluxe-hut' } });
    const exec = await RoomType.findOne({ where: { slug: 'executive-room' } });
    if (deluxe && exec) {
      const activeGuest = await createReservation({
        stay: { checkIn: today, checkOut: addDays(today, 3), nights: 3, adults: 2, children: 0, rooms: 1 },
        roomTypeId: exec.id,
        guest: {
          firstName: 'Zainab',
          lastName: 'Mansoor',
          phone: '0300-5551234',
          phoneKey: '3005551234',
          email: 'zainab.mansoor@example.com',
        },
        specialRequests: 'Airport car requested for afternoon flight',
        source: 'website',
      });
      activeGuest.status = 'checked_in';
      await activeGuest.save();

      await createReservation({
        stay: { checkIn: addDays(today, 1), checkOut: addDays(today, 4), nights: 3, adults: 2, children: 1, rooms: 1 },
        roomTypeId: deluxe.id,
        guest: {
          firstName: 'Hamza',
          lastName: 'Qureshi',
          phone: '0321-8884321',
          phoneKey: '3218884321',
          email: 'hamza.q@example.com',
        },
        specialRequests: 'Bonfire on second evening if calm',
        source: 'website',
      });

      // One past checked-out stay for feedback & blog context
      const past = await Reservation.create({
        bookingNumber: 'OAS-PAST01',
        status: 'checked_out',
        source: 'website',
        guest_firstName: 'Tariq',
        guest_lastName: 'Mehmood',
        guest_phone: '0333-4449876',
        guest_phoneKey: '3334449876',
        guest_email: 'tariq.m@example.com',
        checkIn: addDays(today, -5),
        checkOut: addDays(today, -2),
        nights: 3,
        adults: 2,
        children: 0,
        roomType: deluxe.id,
        totalAmount: 54000,
        paymentChoice: 'hotel',
        rooms: [{ room: null, roomNo: '102', type: 'Deluxe Hut' }],
        breakdown: [],
        payments: [{ amount: 54000, method: 'bank_transfer', reference: 'HBL-981234', note: 'Settled at desk' }],
      });

      await Feedback.create({
        reservation: past.id,
        bookingNumber: past.bookingNumber,
        guestName: 'Tariq Mehmood',
        rating: 5,
        comment: 'Waking up to snow on the Katpana dune right outside the glass doors was unforgettable. Room 102 was warm before we even landed, and the grilled trout at dinner was exceptional.',
        published: true,
      });

      await BlogPost.create({
        title: 'Winter mornings on the Katpana cold desert',
        slug: 'winter-mornings-katpana-cold-desert',
        excerpt: 'Fifteen minutes from Skardu airport, the dunes catch the first amber light while the Karakoram peaks hold snow well into spring.',
        body: 'Stepping out from the red-roofed huts at 7 AM in Skardu, the sand carries a crisp layer of frost. Breakfast arrives warm at the hut — fresh omelette, toasted bread, and hot tea looking straight across the valley.\n\nGuests who stay three nights often spend their first afternoon walking the ridge behind the resort before lighting a quiet bonfire at six.',
        image: '/photos/cottages-snow.jpg',
        status: 'published',
        source: 'staff',
        authorName: 'Oasis Resort Team',
        publishedAt: new Date(),
      });
    }
  }

  // Sweep old insights daily
  const sweep = () => purgeInsights().catch(() => {});
  sweep();
  setInterval(sweep, 24 * 60 * 60 * 1000).unref();
}
