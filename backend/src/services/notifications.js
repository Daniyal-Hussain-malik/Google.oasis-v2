import { env } from '../config/env.js';
import Reservation from '../models/Reservation.js';
import RestaurantOrder from '../models/RestaurantOrder.js';
import Settings from '../models/Settings.js';
import * as emails from './emails.js';
import { buildInvoice, invoicePdf } from './invoice.js';
import { deliver, notify } from './mail.js';

// The one place that decides who gets which email, and when. Every function
// swallows its own errors: a mail problem must never fail a booking, a check-in
// or a form submission. Callers do not need to await them.

async function hotelInfo() {
  const s = await Settings.current();
  return { name: s.name, address: s.address, phone: s.phone, email: s.email, checkInTime: s.checkInTime, checkOutTime: s.checkOutTime };
}

// A plain object the templates can read, whether it came from a document or not.
function view(reservation, hotel) {
  return {
    bookingNumber: reservation.bookingNumber,
    source: reservation.source,
    guestName: reservation.guestName,
    guest: { phone: reservation.guest.phone, email: reservation.guest.email },
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    nights: reservation.nights,
    adults: reservation.adults,
    children: reservation.children,
    rooms: reservation.rooms.map((room) => ({ type: room.type, roomNo: room.roomNo })),
    specialRequests: reservation.specialRequests,
    totalAmount: reservation.totalAmount,
    paid: reservation.paid,
    balance: reservation.balance,
  };
}

async function safely(label, job) {
  try {
    return await job();
  } catch (error) {
    console.error(`[mail ${label} failed] ${error.message}`);
    return null;
  }
}

const adminTo = () => env.mail.adminTo;

// New booking: the guest gets a confirmation; the team hears about website bookings.
export function bookingCreated(reservation) {
  return safely('booking', async () => {
    const hotel = await hotelInfo();
    const r = view(reservation, hotel);
    const jobs = [notify({ to: r.guest.email, ...emails.bookingConfirmation(r, hotel) })];
    if (r.source === 'website') jobs.push(notify({ to: adminTo(), ...emails.adminNewBooking(r, hotel) }));
    return Promise.all(jobs);
  });
}

export function bookingCancelled(reservation) {
  return safely('cancellation', async () => {
    const hotel = await hotelInfo();
    return notify({ to: reservation.guest.email, ...emails.bookingCancelled(view(reservation, hotel), hotel) });
  });
}

export function guestCheckedIn(reservation) {
  return safely('welcome', async () => {
    const hotel = await hotelInfo();
    return notify({ to: reservation.guest.email, ...emails.guestWelcome(view(reservation, hotel), hotel) });
  });
}

// Check-out: a thank-you with the final invoice as a PDF.
export function guestCheckedOut(reservation) {
  return safely('checkout', async () => {
    const hotel = await hotelInfo();
    const invoice = await buildInvoice(reservation.id);
    return notify({
      to: reservation.guest.email,
      ...emails.thankYou(view(reservation, hotel), hotel, invoice.invoiceNumber),
      attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: invoicePdf(invoice), contentType: 'application/pdf' }],
    });
  });
}

export function enquiryCreated(enquiry) {
  return safely('enquiry', async () => {
    const hotel = await hotelInfo();
    return Promise.all([
      notify({ to: enquiry.email, ...emails.enquiryReceived(enquiry, hotel) }),
      notify({ to: adminTo(), ...emails.adminNewEnquiry(enquiry, hotel) }),
    ]);
  });
}

// Emails the admin's reply to the guest and reports exactly what the mail
// server said. The recipient comes from the saved enquiry, never from the request.
export async function sendEnquiryReply(enquiry, message) {
  const hotel = await hotelInfo();
  return deliver({ to: enquiry.email, replyTo: hotel.email, ...emails.enquiryReply({ ...enquiry.toObject(), reply: message }, hotel) });
}

export function feedbackReceived(feedback) {
  return safely('feedback', async () => {
    const hotel = await hotelInfo();
    return notify({ to: adminTo(), ...emails.adminNewFeedback(feedback, hotel) });
  });
}

// A guest has sent a blog post: thank them, and tell the team it needs review.
export function blogSubmitted(post, reservation) {
  return safely('blog', async () => {
    const hotel = await hotelInfo();
    const guest = { name: reservation.guestName };
    return Promise.all([
      notify({ to: reservation.guest.email, ...emails.blogReceived(post, guest, hotel) }),
      notify({ to: adminTo(), ...emails.adminNewBlog(post, hotel) }),
    ]);
  });
}

// A manager published or declined a guest's post.
export function blogDecided(post) {
  return safely('blog decision', async () => {
    const reservation = await Reservation.findByPk(post.reservation);
    if (!reservation) return null;
    const hotel = await hotelInfo();
    const guest = { name: reservation.guestName };
    const mail = post.status === 'published' ? emails.blogPublished(post, guest, hotel) : emails.blogDeclined(post, guest, hotel);
    return notify({ to: reservation.guest.email, ...mail });
  });
}

// A guest says they sent money: the team must check it. Reservation claims know the guest's email.
export function paymentProofSubmitted(claim, reservation) {
  return safely('payment proof', async () => {
    const hotel = await hotelInfo();
    return notify({ to: adminTo(), replyTo: reservation?.guest?.email, ...emails.adminPaymentProof(claim, hotel) });
  });
}

// Staff confirmed or declined a payment proof: tell the guest.
export function paymentProofDecided(claim) {
  return safely('payment decision', async () => {
    let guest;
    if (claim.target === 'reservation') {
      const reservation = await Reservation.findByPk(claim.reservation);
      if (reservation) guest = { name: reservation.guestName, email: reservation.guest.email };
    } else {
      const order = await RestaurantOrder.findByPk(claim.order);
      const reservation = order?.reservation ? await Reservation.findByPk(order.reservation) : null;
      if (reservation) guest = { name: reservation.guestName, email: reservation.guest.email };
    }
    if (!guest?.email) return null;
    const hotel = await hotelInfo();
    const mail = claim.status === 'confirmed' ? emails.paymentConfirmed(claim, guest, hotel) : emails.paymentDeclined(claim, guest, hotel);
    return notify({ to: guest.email, ...mail });
  });
}

export function passwordResetRequested(user, link, minutes) {
  return safely('password reset', async () => {
    const hotel = await hotelInfo();
    return notify({ to: user.email, ...emails.passwordReset(user, link, minutes, hotel) });
  });
}

export function passwordWasChanged(user) {
  return safely('password changed', async () => {
    const hotel = await hotelInfo();
    return notify({ to: user.email, ...emails.passwordChanged(user, hotel) });
  });
}

export function staffAccountCreated(user) {
  return safely('staff welcome', async () => {
    const hotel = await hotelInfo();
    return notify({ to: user.email, ...emails.staffWelcome(user, hotel) });
  });
}
