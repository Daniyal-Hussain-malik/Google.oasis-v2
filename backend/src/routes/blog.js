import crypto from 'node:crypto';
import { Router } from 'express';
import { Op } from 'sequelize';
import { formLimit } from '../middleware/limits.js';
import BlogPost from '../models/BlogPost.js';
import { requireGuestSession } from '../services/guestAuth.js';
import { blogSubmitted } from '../services/notifications.js';
import { badRequest, HttpError, notFound, text } from '../utils/http.js';

const router = Router();

export const MAX_POSTS_PER_STAY = 3;

export function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'post';
}

// A short random tail keeps addresses unique without ever asking the writer to rename.
export const newSlug = (title) => `${slugify(title)}-${crypto.randomBytes(2).toString('hex')}`;

export const excerptOf = (body) => {
  const flat = String(body).replace(/\s+/g, ' ').trim();
  return flat.length > 180 ? `${flat.slice(0, 177).trimEnd()}...` : flat;
};

// "Ayesha K." from a reservation: the guest's privacy comes first.
const displayName = (reservation) => `${reservation.guest.firstName} ${reservation.guest.lastName.charAt(0)}.`.trim();

const card = (post) => ({
  slug: post.slug,
  title: post.title,
  excerpt: post.excerpt,
  image: post.image,
  authorName: post.authorName,
  source: post.source,
  publishedAt: post.publishedAt,
});

router.get('/', async (req, res) => {
  const posts = await BlogPost.findAll({ where: { status: 'published' }, order: [['publishedAt', 'DESC']], limit: 100 });
  res.json(posts.map((post) => ({ ...card(post), body: post.body })));
});

router.get('/:slug', async (req, res) => {
  const post = await BlogPost.findOne({ where: { slug: String(req.params.slug).toLowerCase(), status: 'published' } });
  if (!post) throw notFound('That post is not on the blog.');
  res.json({ ...card(post), body: post.body });
});

// Only an OTP-verified guest whose stay is over can write.
router.post('/submit', formLimit, async (req, res) => {
  const body = req.body || {};
  const reservation = await requireGuestSession(req, { expectedBookingNumber: body.bookingNumber });
  if (reservation.status !== 'checked_out') {
    throw new HttpError(403, 'Posts can be shared after your stay, once you have checked out.');
  }

  const title = text(body.title, 120);
  const story = text(body.body, 6000);
  if (title.length < 5) throw badRequest('Give your story a title of at least 5 characters.');
  if (story.length < 100) throw badRequest('Write at least a few sentences (100 characters) about your stay.');
  if (/https?:\/\/|www\./i.test(`${title} ${story}`)) throw badRequest('Links are not allowed in posts.');

  const used = await BlogPost.count({ where: { reservation: reservation.id, status: { [Op.ne]: 'rejected' } } });
  if (used >= MAX_POSTS_PER_STAY) throw badRequest(`You have already shared ${MAX_POSTS_PER_STAY} posts for this stay.`);

  // Sending the same story twice (a double click) must not create two posts.
  const duplicate = await BlogPost.findOne({ where: { reservation: reservation.id, title, body: story } });
  if (duplicate) return res.status(200).json({ ok: true, status: duplicate.status, duplicate: true });

  const post = await BlogPost.create({
    title,
    slug: newSlug(title),
    excerpt: excerptOf(story),
    body: story,
    status: 'pending',
    source: 'guest',
    authorName: displayName(reservation),
    reservation: reservation.id,
    bookingNumber: reservation.bookingNumber,
  });
  blogSubmitted(post, reservation);
  res.status(201).json({ ok: true, status: post.status });
});

// The guest's own posts and where each one stands.
router.post('/mine', formLimit, async (req, res) => {
  const reservation = await requireGuestSession(req, { expectedBookingNumber: req.body?.bookingNumber });
  const posts = await BlogPost.findAll({ where: { reservation: reservation.id }, order: [['createdAt', 'DESC']] });
  res.json({
    canWrite: reservation.status === 'checked_out',
    posts: posts.map((post) => ({
      title: post.title,
      status: post.status,
      rejectReason: post.status === 'rejected' ? post.rejectReason : '',
      slug: post.status === 'published' ? post.slug : '',
    })),
  });
});

export default router;
