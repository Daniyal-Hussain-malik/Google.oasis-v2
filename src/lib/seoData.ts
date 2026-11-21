export interface RouteSeoMeta {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  type?: 'website' | 'article';
}

export const SITE_NAME = 'Oasis Resort Skardu';

export const DEFAULT_SEO: RouteSeoMeta = {
  title: 'Oasis Resort Skardu — Katpana Cold Desert',
  description:
    'Luxury glass-fronted timber huts on the Katpana Cold Desert in Skardu, Gilgit-Baltistan. Book rooms directly, order dining to your hut, and explore the Karakoram.',
  image: '/photos/cottages-wide.jpg',
  imageAlt: 'Glass-fronted timber huts at Oasis Resort Skardu facing the Katpana Cold Desert and Karakoram peaks',
  type: 'website',
};

const EXACT_ROUTE_SEO: Record<string, RouteSeoMeta> = {
  '/': DEFAULT_SEO,
  '/rooms': {
    title: 'Rooms & Glass Desert Huts — Oasis Resort Skardu',
    description:
      'Explore nineteen heated timber huts and suites facing the Katpana dunes and Karakoram ridge. View live nightly rates with complimentary breakfast.',
    image: '/photos/official/cottage.jpg',
    imageAlt: 'Timber desert hut interior and terrace doors at Oasis Resort Skardu',
  },
  '/stay': {
    title: 'Stay at Oasis Resort — Heated Huts in Katpana, Skardu',
    description:
      'Compare Superior Twin, Deluxe Hut, Premium Hut, Executive Room, and Family Hut accommodations on the Katpana Cold Desert.',
    image: '/photos/official/executive.jpg',
    imageAlt: 'Executive suite overlooking the Skardu desert valley at Oasis Resort',
  },
  '/book': {
    title: 'Book Your Stay Directly — Oasis Resort Skardu',
    description:
      'Check live room availability and reserve your heated hut directly at Oasis Resort Skardu with complimentary breakfast and best-rate guarantee.',
    image: '/photos/official/desert-k2.jpg',
    imageAlt: 'Sunset over the Katpana desert dunes behind Oasis Resort Skardu',
  },
  '/confirmed': {
    title: 'Booking Confirmation — Oasis Resort Skardu',
    description:
      'View your confirmed Oasis Resort Skardu reservation details, nightly breakdown, and direct bank or Easypaisa settlement instructions.',
    image: '/photos/cottages-row.jpg',
    imageAlt: 'Row of desert huts at Oasis Resort Skardu',
  },
  '/booking': {
    title: 'Find & Manage Your Booking — Oasis Resort Skardu',
    description:
      'Look up your Oasis Resort Skardu reservation folio, upload payment confirmation, or review your completed stay.',
    image: '/photos/official/rooms-row.jpg',
    imageAlt: 'Walkway along the heated desert huts at Oasis Resort Skardu',
  },
  '/login': {
    title: 'Guest Stay Portal — Oasis Resort Skardu',
    description:
      'Sign in with your booking number and phone to manage your in-house stay, dining charges, and resort requests.',
    image: '/photos/deluxe-day.jpg',
    imageAlt: 'Morning light inside a Deluxe Hut at Oasis Resort Skardu',
  },
  '/order': {
    title: 'In-Room Dining & Kitchen Menu — Oasis Resort Skardu',
    description:
      'Order fresh Pakistani mains, river trout, breakfast trays, and warm beverages straight from the Oasis kitchen to your desert hut.',
    image: '/photos/breakfast.jpg',
    imageAlt: 'Warm breakfast tray served at Oasis Resort Skardu',
  },
  '/dining': {
    title: 'Kitchen & Dining — Oasis Resort Skardu',
    description:
      'Complimentary morning breakfast, open-air cafe dining, grilled Skardu trout, and dinner by the Katpana bonfire.',
    image: '/photos/cafe.jpg',
    imageAlt: 'Outdoor cafe and dining seating at Oasis Resort Skardu',
  },
  '/facilities': {
    title: 'Resort Facilities & Comforts — Oasis Resort Skardu',
    description:
      'Heated rooms and washrooms, running hot water, private balconies, Wi-Fi, restaurant, open-sky jacuzzi, and airport transfers.',
    image: '/photos/official/resort-landscape.jpg',
    imageAlt: 'Full Oasis Resort grounds across the Katpana Cold Desert valley',
  },
  '/activities': {
    title: 'Desert Activities & Safaris — Oasis Resort Skardu',
    description:
      'Katpana dune jeep safaris, morning sandboarding, open-air desert cinema, evening bonfires, and Shangrila day trips.',
    image: '/photos/official/jeep-safari.jpg',
    imageAlt: 'Desert jeep safari departing from Oasis Resort Skardu',
  },
  '/experiences': {
    title: 'Katpana Desert Experiences — Oasis Resort Skardu',
    description:
      'Curated Skardu afternoons and starlit evenings: dune bonfires, breakfast at the hut, jeep trails, and Lower Kachura excursions.',
    image: '/photos/bonfire-fire.jpg',
    imageAlt: 'Evening bonfire glowing on the Katpana sand at Oasis Resort Skardu',
  },
  '/offers': {
    title: 'Seasonal & Direct Stay Offers — Oasis Resort Skardu',
    description:
      'Direct booking privileges including winter dune rates, complimentary Skardu airport car transfers on three-night stays, and long-weekend packages.',
    image: '/photos/winter-huts.jpg',
    imageAlt: 'Winter snow ridge behind the heated red-roofed huts at Oasis Resort Skardu',
  },
  '/around': {
    title: 'Around Skardu & Katpana Guide — Oasis Resort Skardu',
    description:
      'Explore Katpana Cold Desert right at your doorstep, Shangrila Lake, and scenic drives fifteen minutes from Skardu Airport.',
    image: '/photos/shangrila-lake.jpg',
    imageAlt: 'Shangrila Lake in Lower Kachura Valley near Skardu',
  },
  '/blog': {
    title: 'Katpana Journal & Stories — Oasis Resort Skardu',
    description:
      'Stories from the desert huts, kitchen notes, winter travel guides, and guest reflections from Katpana, Skardu.',
    image: '/photos/cottages-snow.jpg',
    imageAlt: 'Snow-dusted red roofs along the Katpana dune at Oasis Resort Skardu',
    type: 'article',
  },
  '/journal': {
    title: 'Katpana Journal & Stories — Oasis Resort Skardu',
    description:
      'Notes from Oasis Resort Skardu on winter mornings, desert architecture, and life along the Karakoram dunes.',
    image: '/photos/cottages-snow.jpg',
    imageAlt: 'Snow-dusted red roofs along the Katpana dune at Oasis Resort Skardu',
    type: 'article',
  },
  '/gallery': {
    title: 'Photo Gallery — Oasis Resort Skardu',
    description:
      'Browse views of our glass-fronted desert huts, Karakoram snow ridges, cozy interiors, bonfires, and starlit Katpana skies.',
    image: '/photos/official/aerial.jpg',
    imageAlt: 'Aerial view of Oasis Resort Skardu on the Katpana Cold Desert',
  },
  '/about': {
    title: 'About Oasis Resort — 165 Kanals on Katpana Cold Desert',
    description:
      'Nineteen heated desert huts built with glass fronts and carved woodwork on 165 kanals at the edge of Katpana, Skardu.',
    image: '/photos/official/view-from-resort.jpg',
    imageAlt: 'Karakoram mountain ridge view from Oasis Resort Skardu',
  },
  '/reviews': {
    title: 'Verified Guest Reviews — Oasis Resort Skardu',
    description:
      'Read direct experiences from travelers who stayed in our Katpana desert huts, dined at our kitchen, and explored Skardu.',
    image: '/photos/executive-room.jpg',
    imageAlt: 'Executive hut interior overlooking Skardu valley at Oasis Resort',
  },
  '/events': {
    title: 'Evenings & Resort Gatherings — Oasis Resort Skardu',
    description:
      'Bonfire evenings on the sand, winter dune stays, and open-air desert cinema under the Karakoram sky.',
    image: '/photos/night-grounds.jpg',
    imageAlt: 'Oasis Resort Skardu lit softly at night on the Katpana desert',
  },
  '/virtual-tour': {
    title: 'Virtual Tour — Walk the Grounds of Oasis Resort Skardu',
    description:
      'Preview your arrival, heated hut interiors, morning breakfast trays, and bonfire evenings across the Katpana sand.',
    image: '/photos/official/stargazer-balcony.jpg',
    imageAlt: 'Private balcony overlooking the desert dunes at Oasis Resort Skardu',
  },
  '/directions': {
    title: 'Directions & Airport Pickup — Oasis Resort Skardu',
    description:
      'Located 15 minutes from Skardu Airport at Cold Desert Katpana. Complimentary airport pickup on stays of three nights or more.',
    image: '/photos/cottages-cloud.jpg',
    imageAlt: 'Oasis Resort huts along the Katpana desert road beneath clouds',
  },
  '/visit': {
    title: 'Plan Your Visit — Oasis Resort Skardu',
    description:
      'Check-in times, contact numbers, location map, and arrival policies for Oasis Resort at Katpana Cold Desert, Skardu.',
    image: '/photos/cottages-panorama.jpg',
    imageAlt: 'Panoramic row of heated huts at Oasis Resort Skardu',
  },
  '/faq': {
    title: 'Skardu Travel FAQ — Oasis Resort Skardu',
    description:
      'Answers on heating in winter, airport transfers, payments, dining charges, and family stays at Oasis Resort Skardu.',
    image: '/photos/deluxe-nook.jpg',
    imageAlt: 'Quiet valley-view window lounge inside Oasis Resort Skardu',
  },
  '/contact': {
    title: 'Contact Front Desk — Oasis Resort Skardu',
    description:
      'Reach the Oasis Resort Skardu desk directly by phone, WhatsApp, or email for reservations, airport transfers, and group stays.',
    image: '/photos/cottages-wide.jpg',
    imageAlt: 'Oasis Resort Skardu facing the Katpana Cold Desert',
  },
  '/wellness': {
    title: 'Warmth & High-Altitude Rest — Oasis Resort Skardu',
    description:
      'Heated desert huts, deep wool comfort, hot water, and quiet dune views built for restful sleep in Skardu.',
    image: '/photos/room-window-chairs.jpg',
    imageAlt: 'Armchairs beside a sunlit valley window at Oasis Resort Skardu',
  },
  '/weddings': {
    title: 'Intimate Gatherings & Weddings — Oasis Resort Skardu',
    description:
      'Reserve private desert huts together with curated kitchen dining and dune bonfires for family celebrations in Skardu.',
    image: '/photos/bonfire.jpg',
    imageAlt: 'Evening lights between the huts for intimate gatherings at Oasis Resort Skardu',
  },
  '/meetings': {
    title: 'Quiet Team Retreats — Oasis Resort Skardu',
    description:
      'Host a small executive offsite on the Katpana desert with reliable Wi-Fi, peaceful lounges, and included meals.',
    image: '/photos/room-lounge.jpg',
    imageAlt: 'Warm wooden lounge and kilim seating inside Oasis Resort Skardu',
  },
  '/gifts': {
    title: 'Gift a Desert Stay — Oasis Resort Skardu',
    description:
      'Arrange a custom stay voucher for friends or family at Oasis Resort Skardu, prepared directly by our front desk.',
    image: '/photos/view-from-bed.jpg',
    imageAlt: 'View of the Katpana snow dunes from bed at Oasis Resort Skardu',
  },
  '/circle': {
    title: 'Courtyard Circle — Oasis Resort Skardu',
    description:
      'Keep your name with the house for seasonal Skardu winter opening notes and direct stay updates.',
    image: '/photos/stargazing.jpg',
    imageAlt: 'Night sky and stars above Oasis Resort Skardu',
  },
  '/careers': {
    title: 'Careers at Oasis Resort Skardu',
    description:
      'Join the hospitality, front desk, housekeeping, and kitchen team at Oasis Resort Skardu.',
    image: '/photos/cottages-row.jpg',
    imageAlt: 'Timber huts and grounds at Oasis Resort Skardu',
  },
  '/press': {
    title: 'Press & Media Facts — Oasis Resort Skardu',
    description:
      'Fact sheet, photography requests, and media enquiries for Oasis Resort on the Katpana Cold Desert, Skardu.',
    image: '/photos/official/aerial.jpg',
    imageAlt: 'Aerial view of Oasis Resort Skardu',
  },
  '/partners': {
    title: 'Local Transport & Partnerships — Oasis Resort Skardu',
    description:
      'Connect with Oasis Resort Skardu for airport transfers and Upper/Lower Kachura desert excursions.',
    image: '/photos/evening-jeep.jpg',
    imageAlt: 'Evening safari jeep parked beside huts at Oasis Resort Skardu',
  },
  '/sitemap': {
    title: 'Site Directory — Oasis Resort Skardu',
    description:
      'Complete directory of rooms, direct booking, dining, experiences, travel guides, and policies at Oasis Resort Skardu.',
    image: '/photos/cottages-wide.jpg',
    imageAlt: 'Oasis Resort Skardu grounds overview',
  },
};

const DETAIL_SEO: Record<string, RouteSeoMeta> = {
  '/around/katpana': {
    title: 'Katpana Cold Desert — Around Oasis Resort Skardu',
    description: 'Walk straight onto the world’s highest cold desert dunes right outside your hut door.',
    image: '/photos/cottages-wide.jpg',
    imageAlt: 'Glass huts right beside the Katpana dunes at Oasis Resort Skardu',
    type: 'article',
  },
  '/around/shangrila': {
    title: 'Shangrila Lake Day Trip — Oasis Resort Skardu',
    description: 'Arrange a scenic Lower Kachura excursion through our resort desk with a planned evening return.',
    image: '/photos/shangrila-lake.jpg',
    imageAlt: 'Lower Kachura Shangrila Lake near Skardu',
    type: 'article',
  },
  '/around/airport-road': {
    title: '15 Minutes from Skardu Airport — Oasis Resort Skardu',
    description: 'Smooth arrival transfer straight from Skardu Airport to the Katpana desert edge.',
    image: '/photos/cottages-row.jpg',
    imageAlt: 'Row of huts near Katpana road at Oasis Resort Skardu',
    type: 'article',
  },
  '/around/after-dark': {
    title: 'Katpana Desert After Dark — Oasis Resort Skardu',
    description: 'Clear Karakoram night skies, lantern-lit pathways, and fireside evenings on the sand.',
    image: '/photos/night-grounds.jpg',
    imageAlt: 'Illuminated desert huts at night at Oasis Resort Skardu',
    type: 'article',
  },
  '/experiences/breakfast': {
    title: 'Breakfast at the Hut — Oasis Resort Skardu',
    description: 'Hot eggs, toast, tea, and jam delivered to your hut or served in the kitchen dining room.',
    image: '/photos/breakfast.jpg',
    imageAlt: 'Warm breakfast tray served at Oasis Resort Skardu',
    type: 'article',
  },
  '/experiences/jeep-safari': {
    title: 'Katpana Jeep Safari — Oasis Resort Skardu',
    description: 'Desert dune loops departing straight from your chalet door, posted neatly to your folio.',
    image: '/photos/evening-jeep.jpg',
    imageAlt: '4x4 safari jeep at Oasis Resort Skardu',
    type: 'article',
  },
  '/experiences/bonfire': {
    title: 'Bonfire on the Sand — Oasis Resort Skardu',
    description: 'Evening fire and seating prepared on the Katpana dune side for guests who notify the desk by 6 PM.',
    image: '/photos/bonfire.jpg',
    imageAlt: 'Warm evening bonfire at Oasis Resort Skardu',
    type: 'article',
  },
  '/experiences/shangrila-day': {
    title: 'A Day at Shangrila — Oasis Resort Skardu',
    description: 'Dedicated car and driver from the resort desk for a relaxed day at Lower Kachura.',
    image: '/photos/shangrila-lake.jpg',
    imageAlt: 'Shangrila Lake excursion from Oasis Resort Skardu',
    type: 'article',
  },
  '/offers/winter-stay': {
    title: 'Winter on the Dune Offer — Oasis Resort Skardu',
    description: 'Direct winter rates for heated glass-fronted huts surrounded by snow-covered Katpana sand.',
    image: '/photos/cottages-panorama.jpg',
    imageAlt: 'Winter huts in snow at Oasis Resort Skardu',
    type: 'article',
  },
  '/offers/three-nights': {
    title: 'Three Nights & Complimentary Airport Car — Oasis Resort Skardu',
    description: 'Stay three nights or longer and enjoy complimentary Skardu Airport pickup arranged by the desk.',
    image: '/photos/cottages-row.jpg',
    imageAlt: 'Row of heated huts at Oasis Resort Skardu',
    type: 'article',
  },
  '/offers/executive-hut': {
    title: 'Executive Suite Offer — Oasis Resort Skardu',
    description: 'Spacious valley-window executive suite with carved woodwork and complimentary breakfast.',
    image: '/photos/executive-room.jpg',
    imageAlt: 'Executive suite at Oasis Resort Skardu',
    type: 'article',
  },
  '/offers/long-weekend': {
    title: 'Friday to Monday Desert Escape — Oasis Resort Skardu',
    description: 'Extend your Skardu weekend across the Katpana dunes with flexible check-in coordination.',
    image: '/photos/deluxe-night.jpg',
    imageAlt: 'Warm Deluxe Hut after dusk at Oasis Resort Skardu',
    type: 'article',
  },
  '/dining/breakfast': {
    title: 'Morning Breakfast — Kitchen & Dining at Oasis Resort',
    description: 'Included in every direct room stay: freshly cooked eggs, toast, preserves, and hot tea.',
    image: '/photos/breakfast.jpg',
    imageAlt: 'Oasis Resort Skardu breakfast service',
    type: 'article',
  },
  '/dining/evening-table': {
    title: 'Dinner on the Sand — Oasis Resort Skardu',
    description: 'Freshly cooked karahi, grilled river trout, and warm drinks served by the bonfire.',
    image: '/photos/bonfire.jpg',
    imageAlt: 'Evening dining beside the desert bonfire at Oasis Resort Skardu',
    type: 'article',
  },
  '/dining/room-service': {
    title: 'In-Room Dining Tray — Oasis Resort Skardu',
    description: 'Order hot dishes straight from the Oasis kitchen to your hut via the digital menu.',
    image: '/photos/deluxe-nook.jpg',
    imageAlt: 'Cozy window lounge for in-room dining at Oasis Resort Skardu',
    type: 'article',
  },
};

export function resolveRouteSeo(pathname: string): RouteSeoMeta {
  const clean = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  if (EXACT_ROUTE_SEO[clean]) return EXACT_ROUTE_SEO[clean];
  if (DETAIL_SEO[clean]) return DETAIL_SEO[clean];

  const prefix = `/${clean.split('/').filter(Boolean)[0] || ''}`;
  if (prefix === '/legal' || prefix === '/privacy' || prefix === '/terms' || prefix === '/refund-policy') {
    return {
      title: 'Guest Policies & Terms — Oasis Resort Skardu',
      description: 'Booking terms, privacy notice, cancellation window, and direct-rate policy for Oasis Resort Skardu.',
      image: '/photos/cottages-wide.jpg',
      imageAlt: 'Oasis Resort Skardu on the Katpana Cold Desert',
    };
  }
  if (EXACT_ROUTE_SEO[prefix]) return { ...EXACT_ROUTE_SEO[prefix], type: 'article' };
  return DEFAULT_SEO;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function injectSeoHtml(html: string, pathname: string, baseUrl: string): string {
  const seo = resolveRouteSeo(pathname);
  const cleanBase = baseUrl.replace(/\/$/, '');
  const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  const canonicalUrl = `${cleanBase}${cleanPath === '/' ? '/' : cleanPath}`;
  const imageUrl = seo.image.startsWith('http') ? seo.image : `${cleanBase}${seo.image}`;

  const metaBlock = [
    `<title>${escapeText(seo.title)}</title>`,
    `<meta name="description" content="${escapeAttr(seo.description)}" />`,
    `<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />`,
    `<meta property="og:site_name" content="${escapeAttr(SITE_NAME)}" />`,
    `<meta property="og:type" content="${escapeAttr(seo.type || 'website')}" />`,
    `<meta property="og:url" content="${escapeAttr(canonicalUrl)}" />`,
    `<meta property="og:title" content="${escapeAttr(seo.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(seo.description)}" />`,
    `<meta property="og:image" content="${escapeAttr(imageUrl)}" />`,
    `<meta property="og:image:alt" content="${escapeAttr(seo.imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(seo.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(seo.description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(imageUrl)}" />`,
    `<meta name="twitter:image:alt" content="${escapeAttr(seo.imageAlt)}" />`,
  ].join('\n    ');

  // Replace existing static SEO/social block markers cleanly
  if (html.includes('<!-- SEO_META_START -->') && html.includes('<!-- SEO_META_END -->')) {
    return html.replace(/<!-- SEO_META_START -->[\s\S]*?<!-- SEO_META_END -->/, `<!-- SEO_META_START -->\n    ${metaBlock}\n    <!-- SEO_META_END -->`);
  }
  return html.replace(/<title>[\s\S]*?<\/title>/, metaBlock);
}
