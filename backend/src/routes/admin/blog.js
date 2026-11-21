import { Router } from 'express';
import { col, fn, Op } from 'sequelize';
import { ACCESS } from '../../config/roles.js';
import { requireRole } from '../../middleware/auth.js';
import { toId } from '../../models/_base.js';
import BlogPost, { BLOG_STATUSES } from '../../models/BlogPost.js';
import User from '../../models/User.js';
import { blogDecided } from '../../services/notifications.js';
import { badRequest, int, notFound, text } from '../../utils/http.js';
import { contains, populate } from '../../utils/sql.js';
import { excerptOf, newSlug } from '../blog.js';

// Mounted behind the front-office roles. Reviewing is for managers.
const router = Router();
const managers = requireRole(...ACCESS.superAdmin);

router.get('/', async (req, res) => {
  const where = {};
  if (BLOG_STATUSES.includes(req.query.status)) where.status = req.query.status;
  if (req.query.q) {
    const pattern = contains(text(req.query.q, 60));
    where[Op.or] = [{ title: pattern }, { authorName: pattern }, { bookingNumber: pattern }];
  }
  const limit = Math.min(Math.max(int(req.query.limit, 50), 1), 200);
  const [rows, counts] = await Promise.all([
    BlogPost.findAll({ where, order: [['createdAt', 'DESC']], limit }),
    BlogPost.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
  ]);
  const items = await populate(rows.map((row) => row.toJSON()), 'reviewedBy', User);
  res.json({ items, counts: Object.fromEntries(counts.map((row) => [row.status, Number(row.count)])) });
});

// A post written by the team goes live straight away.
router.post('/', managers, async (req, res) => {
  const title = text(req.body?.title, 120);
  const body = text(req.body?.body, 6000);
  if (title.length < 3) throw badRequest('Give the post a title.');
  if (body.length < 20) throw badRequest('Write the post.');
  const post = await BlogPost.create({
    title,
    slug: newSlug(title),
    excerpt: text(req.body?.excerpt, 300) || excerptOf(body),
    body,
    image: text(req.body?.image, 300),
    status: 'published',
    source: 'staff',
    authorName: text(req.body?.authorName, 80) || 'Oasis team',
    publishedAt: new Date(),
    createdBy: req.user._id,
    reviewedBy: req.user._id,
  });
  res.status(201).json(post);
});

// Edit the text or image, and approve, reject or hide. A guest is emailed when
// their post goes live or is declined.
router.patch('/:id', managers, async (req, res) => {
  const post = await BlogPost.findByPk(toId(req.params.id));
  if (!post) throw notFound('Post not found.');
  const body = req.body || {};

  if (body.title !== undefined) {
    const title = text(body.title, 120);
    if (title.length < 3) throw badRequest('Give the post a title.');
    post.title = title;
  }
  if (body.body !== undefined) {
    const story = text(body.body, 6000);
    if (story.length < 20) throw badRequest('The post cannot be empty.');
    post.body = story;
  }
  if (body.excerpt !== undefined) post.excerpt = text(body.excerpt, 300) || excerptOf(post.body);
  if (body.image !== undefined) post.image = text(body.image, 300);
  if (body.authorName !== undefined) post.authorName = text(body.authorName, 80) || post.authorName;

  const before = post.status;
  if (body.status !== undefined) {
    if (!BLOG_STATUSES.includes(body.status)) throw badRequest('Unknown status.');
    if (body.status === 'rejected' && text(body.rejectReason, 300).length < 3) throw badRequest('Give the writer a short reason.');
    post.status = body.status;
    post.reviewedBy = req.user._id;
    if (body.status === 'published' && !post.publishedAt) post.publishedAt = new Date();
    if (body.status === 'rejected') post.rejectReason = text(body.rejectReason, 300);
  }
  await post.save();
  if (post.status !== before && post.source === 'guest' && ['published', 'rejected'].includes(post.status)) blogDecided(post);
  res.json(post);
});

router.delete('/:id', managers, async (req, res) => {
  if (!(await BlogPost.destroy({ where: { id: toId(req.params.id) } }))) throw notFound('Post not found.');
  res.status(204).end();
});

export default router;
