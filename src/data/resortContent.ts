import { media } from '@/src/lib/api';

export const WHATSAPP_URL = 'https://wa.me/923445537788';

export const photos = {
  wide: '/photos/cottages-wide.jpg',
  row: '/photos/cottages-row.jpg',
  cloud: '/photos/cottages-cloud.jpg',
  snow: '/photos/cottages-snow.jpg',
  panorama: '/photos/cottages-panorama.jpg',
  jeep: '/photos/evening-jeep.jpg',
  bonfire: '/photos/bonfire.jpg',
  night: '/photos/night-grounds.jpg',
  breakfast: '/photos/breakfast.jpg',
  executive: '/photos/executive-room.jpg',
  deluxeDay: '/photos/deluxe-day.jpg',
  deluxeNight: '/photos/deluxe-night.jpg',
  nook: '/photos/deluxe-nook.jpg',
  shangrila: '/photos/shangrila-lake.jpg',
  viewFromBed: '/photos/view-from-bed.jpg',
  roomChair: '/photos/room-chair.jpg',
  fire: '/photos/bonfire-fire.jpg',
  carved: '/photos/carved-bed.jpg',
  cafe: '/photos/cafe.jpg',
  roomNight: '/photos/room-night.jpg',
  windowChairs: '/photos/room-window-chairs.jpg',
  winter: '/photos/winter-huts.jpg',
  tv: '/photos/room-tv.jpg',
  redTv: '/photos/room-red-tv.jpg',
  lounge: '/photos/room-lounge.jpg',
  redRoom: '/photos/room-red.jpg',
  stars: '/photos/stargazing.jpg',
};

export const official = {
  desertK2: '/photos/official/desert-k2.jpg',
  landscape: '/photos/official/resort-landscape.jpg',
  view: '/photos/official/view-from-resort.jpg',
  aerial: '/photos/official/aerial.jpg',
  rooms: '/photos/official/rooms-row.jpg',
  balcony: '/photos/official/stargazer-balcony.jpg',
  executive: '/photos/official/executive.jpg',
  window: '/photos/official/room-window.jpg',
  interior: '/photos/official/room-interior.jpg',
  cottage: '/photos/official/cottage.jpg',
  cottageNight: '/photos/official/cottage-night.jpg',
  jeep: '/photos/official/jeep-safari.jpg',
  stars: '/photos/official/stars-desert.jpg',
  camel: '/photos/official/camel-sunset.jpg',
  stargazing: '/photos/official/stargazing.jpg',
};

export const gallery: Array<[string, string]> = [
  [official.desertK2, 'Sunset on the Katpana dunes, with the peaks behind the resort'],
  [official.landscape, 'The resort and the cold desert'],
  [official.aerial, 'The grounds from above'],
  [official.view, 'The view from the resort'],
  [official.balcony, 'A balcony over the desert'],
  [official.rooms, 'The room row'],
  [official.executive, 'An executive room'],
  [official.cottage, 'A cottage at the resort'],
  [official.jeep, 'A jeep for the dune safari'],
  [official.stars, 'The desert after dark'],
  [official.camel, 'A sunset walk on the sand'],
  [photos.winter, 'Six huts under the snow ridge'],
  [photos.wide, 'Glass-fronted huts on the snow, with the Karakoram behind Katpana'],
  [photos.panorama, 'The full row of huts in winter'],
  [photos.row, 'The hut row facing the dune'],
  [photos.snow, 'Winter light along the red roofs'],
  [photos.cloud, 'The same huts when the desert is bare'],
  [photos.deluxeDay, 'Deluxe room in the morning'],
  [photos.viewFromBed, 'The dune from the bed'],
  [photos.executive, 'Executive room, with the valley through the glass'],
  [photos.windowChairs, 'Armchairs at the valley window'],
  [photos.lounge, 'The sitting corner and the kilim'],
  [photos.nook, 'The window seat'],
  [photos.roomChair, 'Carved bed, chair, and the television'],
  [photos.deluxeNight, 'The room after dark'],
  [photos.roomNight, 'Terrace doors after dark'],
  [photos.redRoom, 'The red-wall room'],
  [photos.redTv, 'Television beside the red wall'],
  [photos.carved, 'Detail of the carved bed'],
  [photos.tv, 'The in-room television'],
  [photos.breakfast, 'Breakfast sent to the room'],
  [photos.cafe, 'Picnic tables at the outdoor cafe'],
  [photos.fire, 'The bonfire on the sand'],
  [photos.bonfire, 'Lights between the huts'],
  [photos.night, 'The huts lit after dark'],
  [photos.stars, 'The sky above the desert'],
  [photos.jeep, 'The jeep at the door after dark'],
  [photos.shangrila, 'Shangrila Lake at Lower Kachura, a day out from the resort'],
];

const stayOverrides = [
  {
    match: /executive/i,
    image: '/photos/official/executive.jpg',
    description: 'Two armchairs at the valley window, a kilim, and the television on the side wall. Breakfast is included.',
    amenities: ['Valley view', 'King bed', 'Carved wood', 'Heater', 'Breakfast included'],
  },
  {
    match: /premium/i,
    image: '/photos/official/cottage.jpg',
    description: 'The red-wall room: a carved bed, a kilim, and air conditioning. An extra mattress is PKR 2,500 if you ask the desk ahead.',
    amenities: ['Terrace doors', 'King bed', 'Oasis linen', 'Heater', 'Extra mattress on request'],
  },
  {
    match: /family/i,
    image: photos.redRoom,
    description: 'The red-wall room: a carved bed, a kilim, and air conditioning. An extra mattress is PKR 2,500 if you ask the desk ahead.',
    amenities: ['Terrace doors', 'King bed', 'Oasis linen', 'Heater', 'Extra mattress on request'],
  },
  {
    match: /twin|superior/i,
    image: photos.roomChair,
    description: 'A carved bed, a chair, and a television. The quieter hut on the row, with the same breakfast as the rest of the house.',
    amenities: ['Valley window', 'Twin beds', 'Heater', 'Tea tray', 'Breakfast included'],
  },
  {
    match: /deluxe/i,
    image: '/photos/official/room-window.jpg',
    description: 'The dune and the ridge are the view from the bed. Yellow curtains, two chairs, and breakfast included.',
    amenities: ['Valley view', 'King bed', 'Carved wood', 'Heater', 'Breakfast included'],
  },
];

export function presentStay(room: any) {
  if (!room) return room;
  const hit = stayOverrides.find((item) => item.match.test(room.name || ''));
  const next = { ...room };
  const isStock = !room.image || room.image.includes('unsplash.com');
  const isSeededCopy = /courtyard|mall|empress|civil lines/i.test(room.description || '');
  if (isStock && hit) next.image = hit.image;
  if ((!room.description || isSeededCopy) && hit) next.description = hit.description;
  if ((!room.amenities || !room.amenities.length || isSeededCopy) && hit) next.amenities = hit.amenities;
  next.image = media(next.image);
  return next;
}

export interface EditorialItem {
  slug: string;
  title: string;
  kicker: string;
  image: string;
  summary: string;
  body: string;
  book?: boolean;
  authorName?: string;
  publishedAt?: string;
}

export const places: EditorialItem[] = [
  {
    slug: 'katpana',
    title: 'Katpana, at the door',
    kicker: 'The desert',
    image: photos.wide,
    summary: 'The dune starts where the hut path ends. In winter it is snow. Later in the year it is sand.',
    body: 'Oasis sits on the edge of the Katpana cold desert, about fifteen minutes from Skardu airport. The huts face the dune, and the Karakoram sits behind them. You do not need a car to be in the landscape. Walk out from the terrace. If the wind is up, the desk will say so at breakfast and point you to the sheltered side.',
  },
  {
    slug: 'shangrila',
    title: 'Shangrila Lake',
    kicker: 'A day out',
    image: photos.shangrila,
    summary: 'Lower Kachura. Red roofs on the water, pine behind them, and a boat if the lake is calm.',
    body: 'This is not the resort. Shangrila is a drive from Katpana, and it is the outing guests ask for most. The desk books the jeep in the morning and tells you how long to keep for the lake and the road back. Lunch there is on you. You are home before the bonfire is laid.',
  },
  {
    slug: 'airport-road',
    title: 'The airport road',
    kicker: 'Arriving',
    image: photos.row,
    summary: 'Fifteen minutes from Skardu International Airport, on the road toward the desert.',
    body: 'On a stay of three nights or more the desk sends a car to the airport. Shorter stays can still request one, and that car is charged. The road is straightforward in daylight. In winter, tell us your flight number so the driver waits if you are late. The huts are the ones with the red roofs on the desert edge.',
  },
  {
    slug: 'after-dark',
    title: 'The desert after dark',
    kicker: 'If you stay in',
    image: photos.night,
    summary: 'Lights between the huts, and a sky that does not need a drive.',
    body: 'Most evenings the best place is the sand in front of the row. The desk sets chairs and a low table. A fire is laid if you asked by six. There is no second venue and no ticket. If the wind is too strong, the evening moves inside and the kitchen still sends dinner to the room.',
  },
];

export const experiences: EditorialItem[] = [
  {
    slug: 'breakfast',
    title: 'Breakfast at the hut',
    kicker: 'Every morning',
    image: photos.breakfast,
    summary: 'Eggs, toast, tea, and jam. Included with the stay, brought to the room if you ask.',
    body: 'Breakfast is in the rate. The tray is the one the kitchen actually sends: fried eggs, an omelette if you prefer, toast, tea, and jam. Say the night before if you want it at a time, or if someone in the room does not eat eggs. Lunch and dinner are charged and can post to the room bill.',
  },
  {
    slug: 'jeep-safari',
    title: 'Jeep at the door',
    kicker: 'Afternoons',
    image: photos.jeep,
    summary: 'A loop through the dunes. The desk books the jeep for the hour you name.',
    body: 'The jeep waits by the hut, not in a car park in town. Tell reception which afternoon, and how many of you are going. The charge posts to the folio the way room service does. In snow the route is shorter and the driver decides what is safe. Sandboarding boards are at the desk if you would rather walk the dune than ride.',
  },
  {
    slug: 'bonfire',
    title: 'Fire on the sand',
    kicker: 'After six',
    image: photos.bonfire,
    summary: 'Chairs, a low table, and a fire if the wind allows. Ask by six.',
    body: 'The bonfire is laid on the dune side of the huts. It is not every night and it is not a ticket. Tell the desk by six so there is wood and enough chairs. Dinner can be served out there, or in the room if the weather turns. Children stay with the people named on the booking.',
  },
  {
    slug: 'shangrila-day',
    title: 'A day at Shangrila',
    kicker: 'Lower Kachura',
    image: photos.shangrila,
    summary: 'The lake with the red roofs. The house arranges the jeep. Lunch is yours.',
    body: 'Leave after breakfast. The drive is the point as much as the lake. The desk writes the return time on your note so the evening fire is still an option. This outing is charged. It does not include a boat or a meal at the lake.',
  },
];

export const offers: EditorialItem[] = [
  {
    slug: 'winter-stay',
    title: 'Winter on the dune',
    kicker: 'Cold months',
    image: photos.panorama,
    summary: 'The direct winter rate, breakfast included, on the huts that face the snow.',
    body: 'Book on this site and mention the winter offer in the notes. The desk applies the public winter rate before you arrive. It does not combine with a corporate code. Heating is already in the room. The road from the airport is fine in daylight. Send the flight number if you want the car to wait.',
    book: true,
  },
  {
    slug: 'three-nights',
    title: 'Three nights, airport car included',
    kicker: 'Stay longer',
    image: photos.row,
    summary: 'From the third night, pick-up from Skardu airport is included.',
    body: 'The car is for the people named on the booking, from the airport to the resort and back on the day you leave. A stay of one or two nights can still request a car, and that ride is charged. Mention this offer when you book so the desk holds the driver.',
    book: true,
  },
  {
    slug: 'executive-hut',
    title: 'The executive room',
    kicker: 'The valley window',
    image: photos.executive,
    summary: 'The carved room, breakfast, and a late checkout until two if the hut is free the next day.',
    body: 'Late checkout is a request, not a promise. The desk confirms it the evening before you leave. The rate on the booking page is the public rate. Mention this offer in the notes and choose the executive room.',
    book: true,
  },
  {
    slug: 'long-weekend',
    title: 'Friday to Monday',
    kicker: 'Weekend',
    image: photos.deluxeNight,
    summary: 'A long weekend in the hut, with dinner on Sunday posted to the room bill.',
    body: 'Weekend rates already price Saturday and Sunday. This offer adds Sunday dinner for the people on the booking. It is the kitchen’s menu, not a banquet. Mention it in the notes so the cook knows the headcount.',
    book: true,
  },
];

export const restaurants: EditorialItem[] = [
  {
    slug: 'breakfast',
    title: 'Breakfast',
    kicker: 'Included',
    image: photos.breakfast,
    summary: 'Eggs, toast, tea, and jam. In the restaurant, or on a tray at the hut.',
    body: 'Breakfast is included. Tell the desk the night before if you want it at a fixed time, or if you need it brought to the room. The plate is simple on purpose: eggs, toast, tea, jam, and fruit when the market has it. Children eat from the same kitchen.',
  },
  {
    slug: 'evening-table',
    title: 'Dinner on the sand',
    kicker: 'When the wind allows',
    image: photos.bonfire,
    summary: 'The outdoor table between the huts. The same kitchen, under the lights.',
    body: 'On a calm evening the table is set outside. Karahi, daal, and whatever the cook has that day. Tell us about allergies at breakfast, not at the table. The bill posts to the room. If the wind is up, dinner is served indoors and the desk will say so.',
  },
  {
    slug: 'room-service',
    title: 'A tray to the hut',
    kicker: 'Until eleven',
    image: photos.nook,
    summary: 'The same kitchen, brought to the room. It posts to the folio before you sleep.',
    body: 'Call the desk. There is no separate app and no separate bill. Breakfast can come this way at no extra charge. Lunch and dinner are charged. If you are not in house, the tray is not available.',
  },
];

export const collections = [
  {
    slug: 'the-huts',
    title: 'The huts',
    kicker: 'On the dune',
    image: photos.wide,
    summary: 'Red roofs, glass fronts, and the Karakoram behind the desert.',
    to: '/gallery',
  },
  {
    slug: 'the-rooms',
    title: 'The rooms',
    kicker: 'Carved wood',
    image: photos.deluxeDay,
    summary: 'King beds, valley windows, and heaters that are already on when you arrive in winter.',
    to: '/stay',
  },
  {
    slug: 'the-table',
    title: 'Breakfast and dinner',
    kicker: 'One kitchen',
    image: photos.breakfast,
    summary: 'Breakfast is included. Dinner can be on the sand or brought to the hut.',
    to: '/dining',
  },
  {
    slug: 'after-dark',
    title: 'After dark',
    kicker: 'On the sand',
    image: photos.bonfire,
    summary: 'A fire, a jeep if you asked, and lights between the huts.',
    to: '/experiences',
  },
];

export const wellness = [
  {
    title: 'Heat, then quiet',
    body: 'In winter the heater is on before you arrive. The curtains on the valley window are heavy enough to sleep through a bright snow morning. If you want the hut at the end of the row, say so in the booking notes.',
  },
  {
    title: 'Morning on the dune',
    body: 'The path in front of the huts is the walk. Nobody instructs you. In snow, boots matter more than a yoga mat. The desk will say if the wind makes the open side unpleasant.',
  },
  {
    title: 'Sleep',
    body: 'The rooms face the desert, not a road. A request for a quieter hut is a note on the booking, honoured when that hut is free. Check-in is from 2:00 PM, so the room is made before you land.',
  },
];

export const journals: EditorialItem[] = [
  {
    slug: 'the-huts',
    title: 'Red roofs on the snow',
    kicker: 'The grounds',
    image: photos.wide,
    summary: 'Nineteen rooms on about 165 kanals, fifteen minutes from the airport, facing the dune.',
    body: 'The huts are glass at the front and stone at the base. In winter the desert is white and the ridge behind it is the first thing you see from the bed. Later in the year the same ground is sand. The resort does not pretend to be a city hotel. There is one kitchen, one desk, and a book that holds the room you chose on this site.',
  },
  {
    slug: 'what-we-cook',
    title: 'What arrives on the tray',
    kicker: 'Kitchen',
    image: photos.breakfast,
    summary: 'Breakfast is eggs, toast, tea, and jam. Dinner is whatever the cook can stand behind that night.',
    body: 'We do not print a long menu the kitchen cannot keep at this distance from town. Breakfast is included and it is the plate in the photograph. Dinner is karahi, daal, and rice, inside or on the sand. If you need something plain for a child, say so at breakfast. That is easier than a second menu. Lunch and dinner post to the room bill.',
  },
  {
    slug: 'booking-direct',
    title: 'Why the rate on this site is the rate',
    kicker: 'The desk',
    image: photos.cloud,
    summary: 'The public price is the best price we publish. A member does not see a secret lower one.',
    body: 'Agencies sell the same huts and keep a commission. If you find a lower public rate for the same room and the same dates, tell the desk before you arrive and we will match it. That is the whole of the guarantee. It does not cover member clubs we do not belong to, or rates that need a coupon we cannot see. The room is held in our own book the moment the booking is confirmed.',
  },
];

export const faqs: Array<[string, string]> = [
  ['Where is the resort?', 'Cold desert, Katpana, Skardu 16100, Gilgit-Baltistan. About fifteen minutes from Skardu airport, the row of red roofs on the desert edge.'],
  ['Is there airport pick-up?', 'On stays of three nights or more, pick-up is included, both ways, for the people named on the booking. Shorter stays can request a car, and that ride is charged. Send the flight number if you want the driver to wait.'],
  ['Can we drive ourselves?', 'Yes. Private parking is on the grounds. In winter, daylight is the sensible time. The directions page has the map.'],
  ['What time is check-in and checkout?', 'Check-in is from 2:00 PM. Checkout is by 12:00 PM. A later checkout is a request, confirmed the evening before if the hut is free.'],
  ['Is breakfast included?', 'Yes. Eggs, toast, tea, and jam, in the restaurant or on a tray if you ask the night before. Lunch and dinner are charged.'],
  ['Is there an extra bed?', 'A mattress is PKR 2,500. Ask before you arrive so the hut is set up. Children stay with the adults named on the booking.'],
  ['How do I pay?', 'Cash, card, bank transfer, JazzCash, and Easypaisa at the desk. You can also pay a deposit via bank transfer or Easypaisa and upload your transaction ID from your confirmation or lookup page.'],
  ['How do I cancel?', 'Free until 48 hours before arrival. After that the first night is kept. A no-show is charged the same way when the night audit runs.'],
  ['Can dinner be outside?', 'On a calm night, yes. Tell the desk by six if you also want a fire. If the wind is up, dinner is indoors and they will say so.'],
  ['Is there room service?', 'Until eleven, from the same kitchen. Breakfast on a tray is included. Lunch and dinner on a tray are charged to the folio or orderable online once checked in.'],
  ['Which room has no step?', 'Room 101. Say so when you book and the desk will hold it if it is free.'],
  ['Is there Wi-Fi and hot water?', 'Yes. Wi-Fi is complimentary. Hot and cold water runs in the guest accommodation, and the heating covers the room and the washroom.'],
];

export const faqGroups = [
  {
    title: 'Getting here',
    lede: 'The road is short. The car depends on the length of the stay.',
    items: faqs.slice(0, 3),
  },
  {
    title: 'The room',
    lede: 'What is in the rate, and what you should ask for before you land.',
    items: faqs.slice(3, 6),
  },
  {
    title: 'Money',
    lede: 'One bill at the end. Transparent direct rates.',
    items: faqs.slice(6, 8),
  },
  {
    title: 'Food and the evening',
    lede: 'One kitchen. The sand, if the weather agrees.',
    items: faqs.slice(8, 10),
  },
  {
    title: 'Families and access',
    lede: 'The grounds are simple. One room is step-free.',
    items: faqs.slice(10, 12),
  },
];

export const defaultReviews: Array<[string, string]> = [
  ['Sana, from Lahore · Two nights', 'We asked for the quiet end and got it. The executive window faced the valley, not the path. Checkout was noon and the car was already there.'],
  ['The Qureshis · A family', 'The extra mattress was in the room when we arrived. The children used the play area in the afternoon. Dinner was plain enough for them and still a proper karahi for us.'],
  ['Bilal · Winter', 'Snow on the dune, heater already on, and the driver waited because the flight was late. We had sent the number the day before.'],
  ['The Martins · A day out', 'Airport pick-up on a three-night stay was waiting. Sandboarding the same afternoon. Shangrila the next day, home before the fire.'],
];

export const policies: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: 'Terms of stay',
    body: [
      'A booking on this site holds a specific room in our own book. Check-in is from 2:00 PM. Check-out is by 12:00 PM unless the desk has agreed a later time.',
      'Cancellation is free until 48 hours before arrival. After that, the first night is charged. A reservation that is not checked in by the night audit is a no-show and the same charge applies.',
      'The name on the booking should be a guest who will stay. Every adult shows an identity document at the desk. Guests who are not Pakistani also show a visa.',
      'Charges from the dining room, laundry, and the minibar post to the room bill. You settle once, at checkout.',
    ],
  },
  privacy: {
    title: 'Privacy',
    body: [
      'We keep the name, phone, email, and identity details you give us so we can hold the room and meet the guest-registration rules.',
      'Card numbers typed into the website stay in your browser. The hotel stores a payment reference, not the card.',
      'Identity scans are stored encrypted. Staff open them only for check-in, and that opening is logged.',
      'You can ask the desk for a copy of what we hold, or for deletion where the tax rules allow it. Financial records are kept for the period the tax office requires.',
    ],
  },
  cookies: {
    title: 'Cookies',
    body: [
      'The site stores your language choice and, if you join, your Circle name on this browser. That is local storage, not a tracking network.',
      'We do not run advertising cookies and we do not sell a guest list.',
    ],
  },
  access: {
    title: 'Accessibility',
    body: [
      'Room 101 is the step-free room. Say so when you book and the desk will hold it if it is free.',
      'The site can be read with a keyboard. Contrast is set for the sand and palm colours used throughout. If a page fails you, write to oasisresortskardu@gmail.com and name the page.',
    ],
  },
  cancellation: {
    title: 'Cancellation policy',
    body: [
      'You can cancel free of charge until 48 hours before the day of arrival.',
      'Inside 48 hours, the first night is charged. A booking that is still unarrived when the night audit runs is a no-show and takes the same charge.',
      'Write to oasisresortskardu@gmail.com or WhatsApp the desk with your booking number.',
    ],
  },
  refund: {
    title: 'Refund policy',
    body: [
      'A deposit paid on the website is held against the stay. If you cancel inside the free window, the desk refunds it to the same method.',
      'Refunds are approved by a manager and written into the audit log. Card data is never stored here, so a card refund goes back through the payment gateway.',
      'Allow a few working days for a bank or wallet refund to show.',
    ],
  },
  'best-rate': {
    title: 'Best rate guarantee',
    body: [
      'The rate on this website for a room type and a set of dates is the lowest public rate we offer for that stay.',
      'If you find a lower rate for the same room type and the same dates, available to book without a private membership, email oasisresortskardu@gmail.com before you arrive. We will match it or explain why it does not qualify.',
      'Agency rates that hide the hotel name, package rates that include flights, and rates that have already expired do not qualify.',
    ],
  },
};

export interface GuideFact {
  label: string;
  value: string;
  note?: string;
}

export interface GuideCard {
  title: string;
  body: string;
}

export const sectionGuides: Record<string, { facts?: GuideFact[]; stepsTitle?: string; steps?: GuideCard[]; cardsTitle?: string; cards?: GuideCard[] }> = {
  places: {
    facts: [
      { label: 'Desert', value: 'At door', note: 'Katpana dune' },
      { label: 'Airport', value: '15 min', note: 'Skardu International' },
      { label: 'Lake', value: 'A day', note: 'Shangrila (Lower Kachura)' },
      { label: 'Evening', value: 'By six', note: 'Ask for the bonfire' },
    ],
    cardsTitle: 'Out from the huts',
    cards: [
      { title: 'Walks without a car', body: 'The dune path starts right beyond the red roofs. In winter wear warm waterproof boots.' },
      { title: 'Shangrila day run', body: 'Reception books the jeep in the morning and notes your return time for the evening fire.' },
      { title: 'Three-night pickup', body: 'Airport car both ways is included from the third night; shorter stays can request it charged to folio.' },
    ],
  },
  experiences: {
    facts: [
      { label: 'Breakfast', value: 'Included', note: 'Ask for a time' },
      { label: 'Jeep', value: 'By request', note: 'Charged to the room' },
      { label: 'Fire', value: 'By six', note: 'If the wind allows' },
      { label: 'Lake', value: 'A day', note: 'Shangrila, not the resort' },
    ],
    stepsTitle: 'Tell reception. There is no second app.',
    steps: [
      { title: 'Name the afternoon', body: 'Jeep, sandboard, or the lake. Say how many of you are going.' },
      { title: 'The desk writes it down', body: 'The charge, if there is one, posts to the folio the way room service does.' },
      { title: 'Weather decides the rest', body: 'In snow the route is shorter. If the wind is up, the evening moves inside.' },
    ],
  },
  offers: {
    stepsTitle: 'How to use an offer',
    steps: [
      { title: 'Book on this site', body: 'Choose the room the offer names, if it names one. The executive offer is the executive room.' },
      { title: 'Write it in the notes', body: 'The title of the offer is enough. The desk applies the public rate before you arrive.' },
      { title: 'It does not stack', body: 'Offers do not combine with a corporate code. If two could apply, the desk will say which one stands.' },
    ],
    cardsTitle: 'The fine print in plain language',
    cards: [
      { title: 'Winter', body: 'The direct winter rate, breakfast included. Heating is already in the hut.' },
      { title: 'Three nights', body: 'From the third night, the airport car is included both ways for guests on the booking.' },
      { title: 'Late checkout', body: 'Until two, only if the hut is free the next day. Confirmed the evening before departure.' },
      { title: 'Sunday dinner', body: 'The long-weekend offer adds the kitchen’s Sunday menu for the guests on the booking.' },
    ],
  },
  restaurants: {
    facts: [
      { label: 'Breakfast', value: 'Included', note: 'Restaurant or tray' },
      { label: 'Tray service', value: 'Until 11', note: 'PM · Order online or desk' },
      { label: 'Dinner', value: 'Karahi & Daal', note: 'Cooked fresh daily' },
      { label: 'Billing', value: 'One folio', note: 'Or Pay Now online' },
    ],
    cardsTitle: 'How the kitchen works',
    cards: [
      { title: 'Simple on purpose', body: 'Fresh breakfast trays and evening karahi, daal, rice, and trout rather than an overstretched city menu.' },
      { title: 'Allergies & children', body: 'Tell reception at breakfast so the cook prepares plain portions alongside dinner.' },
      { title: 'Outdoor table', body: 'Set between the huts when the wind stays calm; moves indoors automatically if weather shifts.' },
    ],
  },
  journals: {
    facts: [
      { label: 'Grounds', value: '165 Kanals', note: 'Edge of Katpana dune' },
      { label: 'Rooms', value: '19 Huts', note: 'Glass-fronted & heated' },
      { label: 'Desk', value: 'Direct', note: 'Same book as the front desk' },
      { label: 'Stories', value: 'Verified', note: 'Reviewed by team before posting' },
    ],
  },
};

export const tourStops = [
  {
    image: photos.row,
    kicker: 'Arrival',
    title: 'The row',
    body: 'You arrive at the huts, not at a lobby in town. Check-in is from 2:00 PM. On a three-night stay the car stops here.',
    points: ['Red roofs on the desert edge', 'The desk is the first door', 'Bags can wait while the room is opened'],
  },
  {
    image: photos.deluxeDay,
    kicker: 'The room',
    title: 'Carved wood, and the valley',
    body: 'The deluxe room faces the dune and the ridge. Breakfast is already in the rate. The heater is on in winter before you land.',
    points: ['King bed, valley window', 'Wi-Fi and hot water', 'Ask if you want the quiet end'],
  },
  {
    image: photos.nook,
    kicker: 'Afternoon',
    title: 'The window seat',
    body: 'Tea, the desert, and nowhere you are required to be. Board games are at the desk if the weather turns.',
    points: ['No schedule', 'The path is the walk', 'The court and the game room are on the grounds'],
  },
  {
    image: photos.breakfast,
    kicker: 'Morning',
    title: 'The tray',
    body: 'Eggs, toast, tea, and jam. Say the night before if you want it at a fixed time, or at the hut, or without eggs.',
    points: ['Included', 'Restaurant or room', 'Lunch and dinner are separate'],
  },
  {
    image: photos.bonfire,
    kicker: 'Evening',
    title: 'After six',
    body: 'If you asked, the fire is on the sand and dinner can come out with it. If the wind is up, both move inside.',
    points: ['Tell the desk by six', 'Chairs for the number you gave', 'No ticket'],
  },
  {
    image: photos.wide,
    kicker: 'Winter',
    title: 'Snow on the same dune',
    body: 'The ridge fills the window. Heating covers the room and the washroom. The airport road is a daylight drive.',
    points: ['Direct winter rate on the offers page', 'Send the flight number', 'Boots, not a board'],
  },
];
