// The facilities the website starts with. They are copied into the hotel
// settings the first time settings are read; after that the admin portal owns
// them (Content & settings -> Facilities) and this list is never applied again.
export const FACILITY_TAGS = ['Included', 'Charged to room', 'Chargeable', 'On request', 'Ask the desk', 'On the grounds'];

export const FACILITY_ICONS = [
  'water', 'heat', 'balcony', 'safe', 'phone', 'wifi', 'breakfast', 'restaurant', 'service', 'minibar',
  'pool', 'jacuzzi', 'games', 'kids', 'court', 'parking', 'star',
];

const room = 'In your room';
const food = 'Eating and drinking';
const grounds = 'On the grounds';

export const defaultFacilities = [
  { icon: 'water', name: 'Running Hot Water', group: room, tag: 'Included', detail: 'Hot water in every room and washroom, ready when you arrive.' },
  { icon: 'heat', name: 'Heating System in Rooms & Washrooms', group: room, tag: 'Included', detail: 'Heating in the rooms and the washrooms, switched on before you arrive in winter.' },
  { icon: 'balcony', name: 'Private Balconies', group: room, tag: 'Included', detail: 'Step out to the dune and the Karakoram, with a chair waiting.' },
  { icon: 'safe', name: 'In-Room Safe Locker', group: room, tag: 'Included', detail: 'A locker in the room for passports, cash and valuables.' },
  { icon: 'phone', name: 'In-Room Telephone', group: room, tag: 'Included', detail: 'Call the desk, the kitchen or housekeeping without leaving the hut.' },
  { icon: 'wifi', name: 'Complimentary Wi-Fi', group: room, tag: 'Included', detail: 'Wi-Fi for guests at no charge. Ask the desk for the password.' },
  { icon: 'breakfast', name: 'Complimentary Breakfast', group: food, tag: 'Included', detail: 'Eggs, toast, tea and jam are in every room rate. A tray to the hut if you ask the night before.' },
  { icon: 'restaurant', name: 'Restaurant', group: food, tag: 'Charged to room', detail: 'One kitchen for karahi, biryani, grilled trout and more. Lunch and dinner post to the room bill.' },
  { icon: 'service', name: 'Room Service', group: food, tag: 'Charged to room', detail: 'Meals and tea brought to your hut. Order from your phone or call the desk.' },
  { icon: 'minibar', name: 'Minibar Available (Chargeable)', group: food, tag: 'Chargeable', detail: 'Stocked on request. Whatever you take is added to the room bill.' },
  { icon: 'pool', name: 'Swimming Pool', group: grounds, tag: 'Ask the desk', detail: 'A swimming pool on the grounds. Ask the desk about opening times in your season.' },
  { icon: 'jacuzzi', name: 'Open To Sky Jacuzzi', group: grounds, tag: 'On request', detail: 'An open-to-sky jacuzzi for cold desert evenings. The desk arranges it for you.' },
  { icon: 'games', name: 'Game Room', group: grounds, tag: 'Included', detail: 'A game room, and board games from the desk. No booking and no separate bill.' },
  { icon: 'kids', name: 'Kids Play Area', group: grounds, tag: 'On the grounds', detail: 'A play area on the grounds, so children have room to run while you sit.' },
  { icon: 'court', name: 'Pickleball Court', group: grounds, tag: 'On request', detail: 'A pickleball court on the grounds. Ask the desk for rackets and a time.' },
  { icon: 'parking', name: 'Private Parking', group: grounds, tag: 'Included', detail: 'Private parking on the grounds for your vehicle.' },
];
