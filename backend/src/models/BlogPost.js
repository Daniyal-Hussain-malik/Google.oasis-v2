import { Base, dt, enumCol, fk, text } from './_base.js';

export const BLOG_STATUSES = ['pending', 'published', 'rejected', 'hidden'];

// A blog post is either written by the team (published straight away) or
// submitted by a guest who has checked out, and then reviewed before it shows.
export class BlogPost extends Base {}
BlogPost.setup(
  {
    title: text({ len: 120, required: true }),
    slug: { ...text({ len: 140, required: true, lower: true }), unique: true },
    excerpt: text({ len: 300 }),
    body: text({ big: true, required: true }),
    image: text({ big: true }),
    status: enumCol(BLOG_STATUSES, 'pending'),
    source: enumCol(['guest', 'staff'], 'guest'),
    // Shown on the site, e.g. "Ayesha K." Never the full name, phone or email.
    authorName: text({ len: 80, def: 'Oasis team' }),
    // Private: which stay a guest post came from.
    reservation: fk('reservations'),
    bookingNumber: text({ len: 20 }),
    rejectReason: text({ len: 300 }),
    publishedAt: dt(),
    reviewedBy: fk('users'),
    createdBy: fk('users'),
  },
  { table: 'blog_posts', indexes: [{ fields: ['status'] }, { fields: ['reservation'] }] },
);

export default BlogPost;
