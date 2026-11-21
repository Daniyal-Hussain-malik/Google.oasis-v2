// The experiences the website starts with. Copied into the hotel settings the
// first time settings are read; after that the admin portal owns them.
export const defaultExperiences = [
  {
    slug: 'breakfast',
    title: 'Breakfast at the hut',
    kicker: 'Every morning',
    image: '/photos/breakfast.jpg',
    summary: 'Eggs, toast, tea, and jam. Included with the stay, brought to the room if you ask.',
    body: 'Breakfast is in the rate. The tray is the one the kitchen actually sends: fried eggs, an omelette if you prefer, toast, tea, and jam. Say the night before if you want it at a time, or if someone in the room does not eat eggs. Lunch and dinner are charged and can post to the room bill.',
  },
  {
    slug: 'jeep-safari',
    title: 'Jeep at the door',
    kicker: 'Afternoons',
    image: '/photos/evening-jeep.jpg',
    summary: 'A loop through the dunes. The desk books the jeep for the hour you name.',
    body: 'The jeep waits by the hut, not in a car park in town. Tell reception which afternoon, and how many of you are going. The charge posts to the folio the way room service does. In snow the route is shorter and the driver decides what is safe. Sandboarding boards are at the desk if you would rather walk the dune than ride.',
  },
  {
    slug: 'bonfire',
    title: 'Fire on the sand',
    kicker: 'After six',
    image: '/photos/bonfire.jpg',
    summary: 'Chairs, a low table, and a fire if the wind allows. Ask by six.',
    body: 'The bonfire is laid on the dune side of the huts. It is not every night and it is not a ticket. Tell the desk by six so there is wood and enough chairs. Dinner can be served out there, or in the room if the weather turns. Children stay with the people named on the booking.',
  },
  {
    slug: 'shangrila-day',
    title: 'A day at Shangrila',
    kicker: 'Lower Kachura',
    image: '/photos/shangrila-lake.jpg',
    summary: 'The lake with the red roofs. The house arranges the jeep. Lunch is yours.',
    body: 'Leave after breakfast. The drive is the point as much as the lake. The desk writes the return time on your note so the evening fire is still an option. This outing is charged. It does not include a boat or a meal at the lake.',
  },
];
