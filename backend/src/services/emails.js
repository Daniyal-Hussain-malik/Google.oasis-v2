import { env } from '../config/env.js';
import { ROLE_LABELS } from '../config/roles.js';

// Every email the system sends. Each function returns { subject, html, text }
// and takes plain data, so the templates can be checked without a database.

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pkr = (value) => `Rs ${Math.round(Number(value) || 0).toLocaleString('en-PK')}`;
const nl2br = (value) => esc(value).replace(/\n/g, '<br>');

function pretty(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const NAVY = '#1a2744';
const ACCENT = '#e8943a';

// The common frame: brand bar, heading, content, optional button, footer.
function frame({ hotel, preheader = '', title, intro = '', rows = [], body = '', button, note = '' }) {
  const table = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid #e3e6ec;border-radius:10px;border-collapse:separate;overflow:hidden">${rows
      .map(([k, v], i) => `<tr><td style="padding:10px 14px;background:${i % 2 ? '#ffffff' : '#f7f8fa'};color:#6b7280;font-size:13px;width:38%">${esc(k)}</td><td style="padding:10px 14px;background:${i % 2 ? '#ffffff' : '#f7f8fa'};color:#1f2937;font-size:14px;font-weight:600">${v}</td></tr>`)
      .join('')}</table>`
    : '';
  const cta = button
    ? `<p style="margin:24px 0"><a href="${esc(button.url)}" style="background:${ACCENT};color:#3d2812;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:999px;display:inline-block">${esc(button.label)}</a></p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Segoe UI,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:${NAVY};padding:22px 28px"><div style="color:#ffffff;font-size:20px;font-weight:700">${esc(hotel.name)}</div><div style="color:#aab4c8;font-size:12px;margin-top:2px">Katpana Cold Desert, Skardu</div></td></tr>
<tr><td style="padding:28px;color:#1f2937;font-size:15px;line-height:1.6">
<h1 style="margin:0 0 10px;font-size:22px;color:${NAVY}">${esc(title)}</h1>
${intro ? `<p style="margin:0 0 6px">${intro}</p>` : ''}${table}${body}${cta}
${note ? `<p style="margin:18px 0 0;color:#6b7280;font-size:13px">${note}</p>` : ''}
</td></tr>
<tr><td style="background:#f7f8fa;padding:18px 28px;color:#6b7280;font-size:12px;line-height:1.6">${esc(hotel.name)} · ${esc(hotel.address)}<br>${esc(hotel.phone)} · ${esc(hotel.email)}</td></tr>
</table></td></tr></table></body></html>`;

  const plain = [title, '', intro.replace(/<[^>]+>/g, ''), ...rows.map(([k, v]) => `${k}: ${String(v).replace(/<[^>]+>/g, '')}`), '', body.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, ''), button ? `${button.label}: ${button.url}` : '', note.replace(/<[^>]+>/g, ''), '', `${hotel.name} · ${hotel.phone}`]
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n');
  return { html, text: plain };
}

const stayRows = (r) => [
  ['Booking number', esc(r.bookingNumber)],
  ['Check-in', `${pretty(r.checkIn)} from ${esc(r.checkInTime || '2:00 PM')}`],
  ['Check-out', `${pretty(r.checkOut)} by ${esc(r.checkOutTime || '12:00 PM')}`],
  ['Nights', String(r.nights)],
  ['Rooms', esc(r.rooms.map((room) => `${room.type}${room.roomNo ? ` (room ${room.roomNo})` : ''}`).join(', ') || 'To be assigned')],
  ['Guests', `${r.adults} adult${r.adults === 1 ? '' : 's'}${r.children ? `, ${r.children} child${r.children === 1 ? '' : 'ren'}` : ''}`],
];

const first = (name) => String(name || '').split(' ')[0] || 'guest';

// Guests

export function bookingConfirmation(r, hotel) {
  const content = frame({
    hotel,
    preheader: `Booking ${r.bookingNumber}: ${pretty(r.checkIn)} to ${pretty(r.checkOut)}`,
    title: `Your stay is booked, ${first(r.guestName)}`,
    intro: 'Thank you for choosing Oasis Resort. Your booking is confirmed and the room is held for you.',
    rows: [
      ...stayRows(r),
      ['Total for the stay', esc(pkr(r.totalAmount))],
      ['Paid so far', esc(pkr(r.paid))],
      ['Balance at the desk', esc(pkr(r.balance))],
    ],
    body: `${r.specialRequests ? `<p><b>Your requests:</b><br>${nl2br(r.specialRequests)}</p>` : ''}<p style="margin-bottom:0">Keep the booking number and the phone number you booked with. Together they open your booking on our website.</p>`,
    button: { label: 'View your booking', url: `${env.siteUrl}/booking` },
    note: `Cancellation is free until 48 hours before arrival. Questions? Call ${esc(hotel.phone)} or reply to this email.`,
  });
  return { subject: `Booking confirmed: ${r.bookingNumber}`, ...content };
}

export function bookingCancelled(r, hotel) {
  const content = frame({
    hotel,
    preheader: `Booking ${r.bookingNumber} has been cancelled`,
    title: 'Your booking has been cancelled',
    intro: `Hello ${esc(first(r.guestName))}, booking ${esc(r.bookingNumber)} for ${pretty(r.checkIn)} to ${pretty(r.checkOut)} has been cancelled.`,
    rows: [['Booking number', esc(r.bookingNumber)], ['Paid', esc(pkr(r.paid))]],
    body: r.paid > 0 ? '<p>If you paid anything towards this stay, the desk will contact you about the refund under our refund policy.</p>' : '',
    button: { label: 'Book again', url: `${env.siteUrl}/book` },
    note: `If this was a mistake, call ${esc(hotel.phone)} and we will help.`,
  });
  return { subject: `Booking cancelled: ${r.bookingNumber}`, ...content };
}

// Sent at check-in.
export function guestWelcome(r, hotel) {
  const content = frame({
    hotel,
    preheader: 'Welcome to Oasis Resort',
    title: `Welcome to Oasis, ${first(r.guestName)}`,
    intro: `You are checked in to ${esc(r.rooms.map((x) => x.roomNo).join(', ') || 'your room')}. We hope the cold desert treats you well.`,
    rows: [
      ['Booking number', esc(r.bookingNumber)],
      ['Check-out', `${pretty(r.checkOut)} by ${esc(r.checkOutTime || '12:00 PM')}`],
      ['Desk', esc(hotel.phone)],
    ],
    body: '<p>Breakfast is included with your stay. From your phone you can order food to your room and follow it in the kitchen, and charge it to your room bill.</p>',
    button: { label: 'Order food', url: `${env.siteUrl}/order` },
    note: 'Use your booking number and the phone on your booking to sign in.',
  });
  return { subject: `Welcome to ${hotel.name}`, ...content };
}

// Sent at check-out, with the final invoice attached.
export function thankYou(r, hotel, invoiceNumber) {
  const content = frame({
    hotel,
    preheader: 'Thank you for staying with us',
    title: `Thank you, ${first(r.guestName)}`,
    intro: 'It was a pleasure having you at Oasis Resort. Your final invoice is attached to this email as a PDF.',
    rows: [['Invoice', esc(invoiceNumber)], ['Booking number', esc(r.bookingNumber)], ['Balance', esc(pkr(r.balance))]],
    body: '<p>If you have a minute, tell us how the stay went. It goes straight to the desk and helps us look after the next guests.</p>',
    button: { label: 'Rate your stay', url: `${env.siteUrl}/booking` },
    note: 'We hope to see you again.',
  });
  return { subject: `Your invoice and thank you: ${r.bookingNumber}`, ...content };
}

export function enquiryReceived(e, hotel) {
  const content = frame({
    hotel,
    preheader: 'We received your message',
    title: `Thank you for writing, ${first(e.name)}`,
    intro: `We have your ${esc(String(e.topic).toLowerCase())} enquiry and the desk will reply by email.`,
    body: `<p style="color:#6b7280"><b>You wrote:</b><br>${nl2br(e.message)}</p>`,
    note: `Urgent? Call ${esc(hotel.phone)}.`,
  });
  return { subject: `We received your enquiry: ${e.topic}`, ...content };
}

export function enquiryReply(e, hotel) {
  const content = frame({
    hotel,
    preheader: 'A reply from Oasis Resort',
    title: `A reply to your ${String(e.topic).toLowerCase()} enquiry`,
    intro: `Hello ${esc(first(e.name))}, thank you for contacting Oasis Resort. Here is our answer.`,
    rows: [['Regarding', esc(e.topic)]],
    body: `<div style="border-left:3px solid ${ACCENT};padding:4px 14px;margin:12px 0">${nl2br(e.reply)}</div><p style="color:#6b7280;font-size:13px"><b>Your message:</b><br>${nl2br(e.message)}</p>`,
    note: `Reply to this email to continue the conversation, or call ${esc(hotel.phone)}.`,
  });
  return { subject: `Re: ${e.topic}`, ...content };
}

export function blogReceived(post, guest, hotel) {
  const content = frame({
    hotel,
    preheader: 'We received your story',
    title: `Thank you for sharing, ${first(guest.name)}`,
    intro: `We received your post, "${esc(post.title)}". Our team reads every story before it goes on the blog, and we will email you when it is live.`,
    note: `Questions? Call ${esc(hotel.phone)}.`,
  });
  return { subject: 'We received your story', ...content };
}

export function blogPublished(post, guest, hotel) {
  const content = frame({
    hotel,
    preheader: 'Your story is on the blog',
    title: 'Your story is live',
    intro: `Hello ${esc(first(guest.name))}, your post "${esc(post.title)}" is now on the Oasis Resort blog.`,
    button: { label: 'Read it on the blog', url: `${env.siteUrl}/blog/${post.slug}` },
    note: 'Thank you for staying with us and for telling others about it.',
  });
  return { subject: `Your story is live: ${post.title}`, ...content };
}

export function blogDeclined(post, guest, hotel) {
  const content = frame({
    hotel,
    preheader: 'About your blog post',
    title: 'About your blog post',
    intro: `Hello ${esc(first(guest.name))}, thank you for writing "${esc(post.title)}". We are not able to publish it this time.`,
    body: post.rejectReason ? `<div style="border-left:3px solid ${ACCENT};padding:4px 14px;margin:12px 0">${nl2br(post.rejectReason)}</div>` : '',
    button: { label: 'Write another', url: `${env.siteUrl}/blog` },
    note: `You are welcome to send a new version. Questions? Call ${esc(hotel.phone)}.`,
  });
  return { subject: 'About your blog post', ...content };
}

export function paymentConfirmed(claim, guest, hotel) {
  const content = frame({
    hotel,
    preheader: `We received ${pkr(claim.amount)}`,
    title: 'Payment received',
    intro: `Hello ${esc(first(guest.name))}, we checked your payment and it is now on your ${claim.target === 'order' ? 'food order' : 'booking'}.`,
    rows: [[claim.target === 'order' ? 'Order' : 'Booking number', esc(claim.orderNumber || claim.bookingNumber)], ['Amount', esc(pkr(claim.amount))], ['Method', esc(String(claim.method).replace(/_/g, ' '))], ['Transaction ID', esc(claim.reference)]],
    note: 'Thank you. Keep this email as your receipt.',
  });
  return { subject: `Payment received: ${pkr(claim.amount)}`, ...content };
}

export function paymentDeclined(claim, guest, hotel) {
  const content = frame({
    hotel,
    preheader: 'Your payment was not received',
    title: 'Your payment was not received',
    intro: `Hello ${esc(first(guest.name))}, we have not received your payment for transaction ${esc(claim.reference)} (${esc(pkr(claim.amount))}). Nothing has been added to your bill.`,
    body: claim.rejectReason ? `<div style="border-left:3px solid ${ACCENT};padding:4px 14px;margin:12px 0">${nl2br(claim.rejectReason)}</div>` : '',
    note: `Please contact the front desk or admin: call ${esc(hotel.phone)} or reply to this email with a screenshot of the receipt, and we will sort it out.`,
  });
  return { subject: 'Your payment was not received', ...content };
}

// Staff

const staffLink = (path) => `${env.adminUrl}${path}`;

export function adminNewBooking(r, hotel) {
  const content = frame({
    hotel,
    preheader: `${r.guestName}, ${pretty(r.checkIn)}`,
    title: 'New booking',
    intro: `${esc(r.guestName)} booked through the ${esc(r.source)}.`,
    rows: [...stayRows(r), ['Guest', esc(r.guestName)], ['Phone', esc(r.guest.phone)], ['Email', esc(r.guest.email)], ['Total', esc(pkr(r.totalAmount))]],
    body: r.specialRequests ? `<p><b>Requests:</b><br>${nl2br(r.specialRequests)}</p>` : '',
    button: { label: 'Open reservations', url: staffLink('/reservations') },
  });
  return { subject: `New booking ${r.bookingNumber}: ${r.guestName}, ${pretty(r.checkIn)}`, ...content };
}

export function adminNewEnquiry(e, hotel) {
  const content = frame({
    hotel,
    preheader: `${e.topic} from ${e.name}`,
    title: `New ${String(e.topic).toLowerCase()} enquiry`,
    rows: [['Name', esc(e.name)], ['Email', esc(e.email)], ['Phone', esc(e.phone || 'not given')], ['Topic', esc(e.topic)]],
    body: `<p>${nl2br(e.message)}</p>`,
    button: { label: 'Reply in the portal', url: staffLink('/enquiries') },
  });
  return { subject: `New enquiry: ${e.topic} from ${e.name}`, replyTo: e.email, ...content };
}

export function adminNewBlog(post, hotel) {
  const content = frame({
    hotel,
    preheader: `${post.authorName}: ${post.title}`,
    title: 'A guest story is waiting for review',
    rows: [['Title', esc(post.title)], ['By', esc(post.authorName)], ['Booking', esc(post.bookingNumber)]],
    body: `<p>${nl2br(post.excerpt)}</p>`,
    button: { label: 'Review it', url: staffLink('/blog') },
  });
  return { subject: `Blog post to review: ${post.title}`, ...content };
}

export function adminPaymentProof(claim, hotel) {
  const content = frame({
    hotel,
    preheader: `${pkr(claim.amount)} by ${claim.method}`,
    title: 'A guest says they have paid',
    rows: [
      [claim.target === 'order' ? 'Food order' : 'Booking', esc(claim.orderNumber || claim.bookingNumber)],
      ['Guest', esc(claim.guestName)],
      ['Amount', esc(pkr(claim.amount))],
      ['Method', esc(String(claim.method).replace(/_/g, ' '))],
      ['Transaction ID', esc(claim.reference)],
      ['Sender', esc(claim.senderName || 'not given')],
    ],
    body: '<p>Check the transaction in the Easypaisa or bank account, then confirm it in the portal. It only counts on the bill once you confirm.</p>',
    button: { label: 'Review payment proofs', url: staffLink('/payment-proofs') },
  });
  return { subject: `Payment proof: ${pkr(claim.amount)} from ${claim.guestName}`, ...content };
}

export function adminNewFeedback(f, hotel) {
  const content = frame({
    hotel,
    preheader: `${f.rating} out of 5 from ${f.guestName}`,
    title: `New feedback: ${f.rating} out of 5`,
    rows: [['Guest', esc(f.guestName)], ['Booking', esc(f.bookingNumber)], ['Rating', `${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}`]],
    body: f.comment ? `<p>${nl2br(f.comment)}</p>` : '<p style="color:#6b7280">No comment left.</p>',
    button: { label: 'Open guest feedback', url: staffLink('/feedback') },
  });
  return { subject: `New ${f.rating}-star feedback from ${f.guestName}`, ...content };
}

export function passwordReset(user, link, minutes, hotel) {
  const content = frame({
    hotel,
    preheader: 'Reset your staff password',
    title: 'Reset your password',
    intro: `Hello ${esc(first(user.name))}, we got a request to reset the password for your staff account.`,
    button: { label: 'Choose a new password', url: link },
    body: `<p style="margin:0 0 6px;color:#6b7280;font-size:13px">If the button does not work, copy this link into your browser:</p><p style="word-break:break-all;font-size:13px"><a href="${esc(link)}" style="color:${NAVY}">${esc(link)}</a></p><p style="margin:16px 0 0;padding:12px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-size:13px;color:#7c2d12"><b>Security:</b> this link expires in ${minutes} minutes and works once. Nobody from Oasis Resort will ever ask you for your password. If you did not request this, ignore this email and your password stays as it is.</p>`,
  });
  return { subject: 'Reset your Oasis admin password', ...content };
}

export function passwordChanged(user, hotel) {
  const content = frame({
    hotel,
    preheader: 'Your password was changed',
    title: 'Your password was changed',
    intro: `Hello ${esc(first(user.name))}, the password for ${esc(user.email)} was just changed and every other sign-in was ended.`,
    note: `If this was not you, reset your password now and tell the manager. ${esc(env.adminUrl)}`,
  });
  return { subject: 'Your Oasis admin password was changed', ...content };
}

export function staffWelcome(user, hotel) {
  const content = frame({
    hotel,
    preheader: 'Your staff account is ready',
    title: `Welcome to the team, ${first(user.name)}`,
    intro: 'An account has been created for you on the Oasis Resort admin portal.',
    rows: [['Sign-in email', esc(user.email)], ['Role', esc(ROLE_LABELS[user.role] || user.role)]],
    body: '<p>Your manager will give you your first password. Please change it after you sign in, or use "Forgot password" on the sign-in page to choose your own.</p>',
    button: { label: 'Open the admin portal', url: env.adminUrl },
  });
  return { subject: `Your ${hotel.name} staff account`, ...content };
}
