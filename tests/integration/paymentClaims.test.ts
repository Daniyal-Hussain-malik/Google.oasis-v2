import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../backend/src/app.js';
import { bootstrapBackend } from '../../backend/src/bootstrap.js';
import { disconnectDb } from '../../backend/src/config/db.js';
import Reservation from '../../backend/src/models/Reservation.js';
import Settings from '../../backend/src/models/Settings.js';
import { guestOtpOutbox } from '../../backend/src/services/guestAuth.js';

describe('paymentClaims routes & workflow integration', () => {
  let app: any;
  let guestAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;
  let reservation: any;

  beforeAll(async () => {
    await bootstrapBackend();

    const settings = await Settings.current();
    settings.payments = {
      ...settings.payments,
      easypaisa: {
        enabled: true,
        accountTitle: 'Oasis Resort Skardu',
        accountNumber: '03445537788',
        iban: '',
        instructions: 'Send receipt screenshot or TID',
      },
      bank: {
        enabled: true,
        bankName: 'HBL',
        accountTitle: 'Oasis Resort',
        accountNumber: '1234567890',
        iban: 'PK00HABB00001234567890',
        instructions: '',
      },
    };
    await settings.save();

    app = createApp();
    guestAgent = request.agent(app);
    adminAgent = request.agent(app);

    reservation = await Reservation.findOne({ where: { status: 'checked_in' } });
    expect(reservation).toBeTruthy();

    // Authenticate guest via real OTP request + verify flow to populate httpOnly cookie
    guestOtpOutbox.length = 0;
    const otpReq = await guestAgent
      .post('/api/public/guest/otp/request')
      .send({
        bookingNumber: reservation.bookingNumber,
        phone: reservation.guest_phone,
        channel: 'whatsapp',
      });
    expect(otpReq.status).toBe(200);
    const code = guestOtpOutbox[0]?.code;
    expect(code).toMatch(/^\d{6}$/);

    const otpVerify = await guestAgent
      .post('/api/public/guest/otp/verify')
      .send({
        bookingNumber: reservation.bookingNumber,
        phone: reservation.guest_phone,
        code,
      });
    expect(otpVerify.status).toBe(200);
    expect(otpVerify.body.ok).toBe(true);

    // Bootstrap first-run Super Admin and hold httpOnly session cookies
    const setupRes = await adminAgent
      .post('/api/auth/setup-admin')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        name: 'Test Manager',
        email: 'manager@oasisresort.pk',
        password: 'SuperSecureTestPassword!2026',
      });
    expect(setupRes.status).toBe(201);
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('rejects unauthenticated payment claims with 401 and blocks CSRF requests without origin/header', async () => {
    const anon = await request(app)
      .post('/api/public/payments/claim')
      .send({ bookingNumber: reservation.bookingNumber, method: 'easypaisa', amount: 5000, reference: 'TID-100001' });
    expect(anon.status).toBe(401);

    const noCsrf = await guestAgent
      .post('/api/public/payments/claim')
      .send({ bookingNumber: reservation.bookingNumber, method: 'easypaisa', amount: 5000, reference: 'TID-100001' });
    expect(noCsrf.status).toBe(403);
  });

  it('creates a claim, rejects duplicate TIDs with 409, and credits the booking upon admin confirmation', async () => {
    const initialPaid = reservation.paid;

    const createRes = await guestAgent
      .post('/api/public/payments/claim')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        bookingNumber: reservation.bookingNumber,
        method: 'easypaisa',
        amount: 12500,
        reference: 'EP-99887766',
        senderName: 'Zainab Mansoor',
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({ ok: true, status: 'pending' });

    // Duplicate reference must be blocked with 409
    const dupRes = await guestAgent
      .post('/api/public/payments/claim')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        bookingNumber: reservation.bookingNumber,
        method: 'easypaisa',
        amount: 12500,
        reference: 'ep-99887766',
      });
    expect(dupRes.status).toBe(409);

    const listRes = await adminAgent.get('/api/admin/payment-claims?status=pending');
    expect(listRes.status).toBe(200);
    const claim = listRes.body.items.find((c: any) => c.reference === 'EP-99887766');
    expect(claim).toBeTruthy();

    const confirmRes = await adminAgent
      .post(`/api/admin/payment-claims/${claim.id}/confirm`)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.status).toBe('confirmed');

    // Second confirmation attempt cannot double-credit
    const doubleConfirm = await adminAgent
      .post(`/api/admin/payment-claims/${claim.id}/confirm`)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(doubleConfirm.status).toBe(400);

    const refreshed = await Reservation.findByPk(reservation.id);
    expect(refreshed?.paid).toBe(initialPaid + 12500);
  });

  it('frees the duplicate lock when an admin rejects a claim so the guest can resubmit', async () => {
    const submit1 = await guestAgent
      .post('/api/public/payments/claim')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        bookingNumber: reservation.bookingNumber,
        method: 'bank',
        amount: 8000,
        reference: 'HBL-445566',
      });
    expect(submit1.status).toBe(201);

    const pending = await adminAgent.get('/api/admin/payment-claims?status=pending');
    const claim = pending.body.items.find((c: any) => c.reference === 'HBL-445566');
    expect(claim).toBeTruthy();

    const rejectRes = await adminAgent
      .post(`/api/admin/payment-claims/${claim.id}/reject`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ reason: 'Screenshot unclear' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe('rejected');

    // Guest can resubmit the same reference after rejection
    const resubmit = await guestAgent
      .post('/api/public/payments/claim')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        bookingNumber: reservation.bookingNumber,
        method: 'bank',
        amount: 8000,
        reference: 'HBL-445566',
      });
    expect(resubmit.status).toBe(201);
  });
});
