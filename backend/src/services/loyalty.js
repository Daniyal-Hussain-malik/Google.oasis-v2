import crypto from 'node:crypto';
import { Op } from 'sequelize';
import { tx } from '../config/db.js';
import LoyaltyTransaction from '../models/Loyalty.js';
import Reservation, { ReservationFolio, ReservationHistory } from '../models/Reservation.js';
import RoomType from '../models/RoomType.js';
import { badRequest, conflict, text } from '../utils/http.js';
import { availability } from './booking.js';

export const WELCOME_BONUS_POINTS = 250;
export const PKR_PER_POINT = 100;

export const LOYALTY_REWARDS = [
  {
    key: 'dining_1000',
    title: 'PKR 1,000 Dining Discount',
    category: 'dining',
    pointsCost: 300,
    pkrValue: 1000,
    description: 'Credits PKR 1,000 directly onto your room folio toward any kitchen meals, trout, or kahwa.',
  },
  {
    key: 'dining_2500',
    title: 'PKR 2,500 Karakoram Feast Credit',
    category: 'dining',
    pointsCost: 650,
    pkrValue: 2500,
    description: 'Applies a PKR 2,500 dining discount directly onto your current reservation folio balance.',
  },
  {
    key: 'room_upgrade_next',
    title: 'Next-Tier Room Upgrade Pass',
    category: 'upgrade',
    pointsCost: 500,
    pkrValue: 4000,
    description: 'Complimentary one-category upgrade (e.g. Deluxe Hut to Premium Hut or Executive Room), prioritized at reception.',
  },
  {
    key: 'room_upgrade_executive',
    title: 'Executive / Family Hut Priority Upgrade',
    category: 'upgrade',
    pointsCost: 950,
    pkrValue: 8000,
    description: 'Top-tier Oasis Circle upgrade voucher for our Executive Room or Family Hut when available on your dates.',
  },
];

const REWARDS_BY_KEY = new Map(LOYALTY_REWARDS.map((r) => [r.key, r]));

function computeTier(lifetimePoints) {
  if (lifetimePoints >= 1500) {
    return {
      name: 'Katpana Gold',
      level: 3,
      perk: 'Priority hut upgrades & complimentary Kashmiri chai welcome platter',
      nextTierName: null,
      pointsToNext: 0,
      progressPct: 100,
    };
  }
  if (lifetimePoints >= 500) {
    const intoTier = lifetimePoints - 500;
    return {
      name: 'Karakoram Silver',
      level: 2,
      perk: 'Priority late check-out until 2 PM (subject to occupancy)',
      nextTierName: 'Katpana Gold',
      pointsToNext: 1500 - lifetimePoints,
      progressPct: Math.min(100, Math.round((intoTier / 1000) * 100)),
    };
  }
  return {
    name: 'Sandstone Member',
    level: 1,
    perk: 'Earn 1 Oasis point per PKR 100 spent on rooms & dining',
    nextTierName: 'Karakoram Silver',
    pointsToNext: 500 - lifetimePoints,
    progressPct: Math.min(100, Math.round((lifetimePoints / 500) * 100)),
  };
}

function makeVoucherCode(prefix) {
  return `OAS-${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function syncLoyaltyForGuest(phoneKey, transaction) {
  if (!phoneKey) return;
  const reservations = await Reservation.findAll({
    where: {
      guest_phoneKey: phoneKey,
      status: { [Op.in]: ['confirmed', 'checked_in', 'checked_out'] },
    },
    order: [['createdAt', 'ASC']],
    transaction,
  });

  if (!reservations.length) return;

  const first = reservations[0];
  const welcomeRef = `welcome:${phoneKey}`;
  const existingWelcome = await LoyaltyTransaction.findOne({ where: { refKey: welcomeRef }, transaction });
  if (!existingWelcome) {
    await LoyaltyTransaction.create(
      {
        phoneKey,
        guestName: first.guestName,
        reservationId: first.id,
        bookingNumber: first.bookingNumber,
        type: 'bonus',
        rewardKey: 'welcome_bonus',
        rewardTitle: 'Oasis Circle Welcome Bonus',
        category: 'stay',
        points: WELCOME_BONUS_POINTS,
        pkrValue: 0,
        status: 'posted',
        refKey: welcomeRef,
        note: 'First reservation membership bonus',
      },
      { transaction },
    );
  }

  for (const resv of reservations) {
    const folioCharges = (resv.folio || [])
      .filter((entry) => entry.kind === 'charge')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const eligibleSpend = Math.max(0, Number(resv.totalAmount || 0) + folioCharges);
    const earnedPoints = Math.max(10, Math.floor(eligibleSpend / PKR_PER_POINT));
    const refKey = `stay-earn:${resv.id}`;

    const existing = await LoyaltyTransaction.findOne({ where: { refKey }, transaction });
    if (!existing) {
      await LoyaltyTransaction.create(
        {
          phoneKey,
          guestName: resv.guestName,
          reservationId: resv.id,
          bookingNumber: resv.bookingNumber,
          type: 'earn',
          rewardKey: 'stay_spend',
          rewardTitle: `Stay Accrual · ${resv.bookingNumber}`,
          category: 'stay',
          points: earnedPoints,
          pkrValue: eligibleSpend,
          status: 'posted',
          refKey,
          note: `${resv.nights} night${resv.nights === 1 ? '' : 's'} at ${PKR_PER_POINT} PKR per point`,
        },
        { transaction },
      );
    } else if (existing.points !== earnedPoints || existing.pkrValue !== eligibleSpend) {
      existing.points = earnedPoints;
      existing.pkrValue = eligibleSpend;
      await existing.save({ transaction });
    }
  }
}

async function checkUpgradeAvailability(reservation) {
  if (!reservation || !['confirmed', 'checked_in'].includes(reservation.status)) {
    return { eligible: false, nextTierName: null };
  }
  try {
    const types = await RoomType.findAll({ where: { active: true }, order: [['sortOrder', 'ASC'], ['baseRate', 'ASC']] });
    const currentIdx = types.findIndex((t) => String(t.id) === String(reservation.roomType));
    if (currentIdx === -1 || currentIdx >= types.length - 1) {
      return { eligible: false, nextTierName: null };
    }
    const stayAvailability = await availability({
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      adults: reservation.adults,
      children: reservation.children,
      rooms: Math.max(1, (reservation.rooms || []).length),
    });
    const higherOptions = stayAvailability
      .filter((item) => {
        const idx = types.findIndex((t) => String(t.id) === String(item.roomType.id));
        return idx > currentIdx && item.available >= Math.max(1, (reservation.rooms || []).length);
      })
      .map((item) => item.roomType.name);
    return {
      eligible: higherOptions.length > 0,
      nextTierName: higherOptions[0] || types[currentIdx + 1]?.name || null,
    };
  } catch {
    return { eligible: true, nextTierName: 'Higher-tier Hut' };
  }
}

export async function buildLoyaltySummary(reservation, transaction) {
  const phoneKey = reservation?.guest?.phoneKey;
  if (!phoneKey) {
    return {
      availablePoints: 0,
      lifetimePoints: 0,
      redeemedPoints: 0,
      tier: computeTier(0),
      canRedeemOnBooking: false,
      upgradeHint: { eligible: false, nextTierName: null },
      rewards: LOYALTY_REWARDS,
      transactions: [],
    };
  }

  await syncLoyaltyForGuest(phoneKey, transaction);

  const ledger = await LoyaltyTransaction.findAll({
    where: { phoneKey },
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: 50,
    transaction,
  });

  let availablePoints = 0;
  let lifetimePoints = 0;
  let redeemedPoints = 0;

  for (const row of ledger) {
    const pts = Number(row.points || 0);
    availablePoints += pts;
    if (pts > 0) lifetimePoints += pts;
    else redeemedPoints += Math.abs(pts);
  }

  const upgradeHint = await checkUpgradeAvailability(reservation);
  const canRedeemOnBooking = ['confirmed', 'checked_in'].includes(reservation.status);

  return {
    availablePoints: Math.max(0, availablePoints),
    lifetimePoints,
    redeemedPoints,
    tier: computeTier(lifetimePoints),
    canRedeemOnBooking,
    upgradeHint,
    rewards: LOYALTY_REWARDS,
    transactions: ledger.map((row) => ({
      id: row._id,
      type: row.type,
      rewardKey: row.rewardKey,
      rewardTitle: row.rewardTitle,
      category: row.category,
      points: row.points,
      pkrValue: row.pkrValue,
      voucherCode: row.voucherCode || undefined,
      bookingNumber: row.bookingNumber || undefined,
      status: row.status,
      note: row.note || undefined,
      createdAt: row.createdAt,
    })),
  };
}

export async function redeemLoyaltyReward(reservationId, { rewardKey, note = '', clientRequestId = '' }) {
  const key = text(rewardKey, 60);
  const reward = REWARDS_BY_KEY.get(key);
  if (!reward) throw badRequest('Choose a valid loyalty reward.');

  const cleanNote = text(note, 200);
  const reqId = text(clientRequestId, 60);

  return tx(async (transaction) => {
    const reservation = await Reservation.findByPk(reservationId, { transaction });
    if (!reservation) throw badRequest('Booking not found.');
    if (!['confirmed', 'checked_in'].includes(reservation.status)) {
      throw badRequest('Rewards can only be redeemed on an active confirmed or checked-in stay.');
    }

    const phoneKey = reservation.guest.phoneKey;
    await syncLoyaltyForGuest(phoneKey, transaction);

    if (reqId) {
      const duplicate = await LoyaltyTransaction.findOne({
        where: { refKey: `redeem:${reservation.id}:${reqId}` },
        transaction,
      });
      if (duplicate) {
        const freshResv = await Reservation.findByPk(reservation.id, { transaction });
        const summary = await buildLoyaltySummary(freshResv, transaction);
        return {
          booking: freshResv.toPublic(),
          loyalty: summary,
          redemption: {
            id: duplicate._id,
            rewardKey: duplicate.rewardKey,
            rewardTitle: duplicate.rewardTitle,
            category: duplicate.category,
            points: duplicate.points,
            pkrValue: duplicate.pkrValue,
            voucherCode: duplicate.voucherCode,
            status: duplicate.status,
          },
          duplicate: true,
        };
      }
    }

    const allRows = await LoyaltyTransaction.findAll({
      where: { phoneKey },
      attributes: ['points'],
      raw: true,
      transaction,
    });
    const balance = allRows.reduce((sum, row) => sum + Number(row.points || 0), 0);
    if (balance < reward.pointsCost) {
      throw badRequest(`You need ${reward.pointsCost - Math.max(0, balance)} more points to redeem ${reward.title}.`);
    }

    const voucherCode = makeVoucherCode(reward.category === 'dining' ? 'DIN' : 'UPG');
    const ledgerRefKey = reqId ? `redeem:${reservation.id}:${reqId}` : `redeem:${reservation.id}:${voucherCode}`;

    if (reward.category === 'dining') {
      const nextFolioPos = (reservation.folio || []).length;
      const nextHistPos = (reservation.history || []).length;
      await ReservationFolio.create(
        {
          reservationId: reservation.id,
          position: nextFolioPos,
          kind: 'credit',
          department: 'discount',
          description: `Oasis Loyalty: ${reward.title} (${voucherCode})`,
          amount: reward.pkrValue,
          refNumber: voucherCode,
          refKey: `loyalty:${voucherCode}`,
          reason: `Guest redeemed ${reward.pointsCost} Oasis Circle loyalty points via Guest Portal`,
        },
        { transaction },
      );

      await ReservationHistory.create(
        {
          reservationId: reservation.id,
          position: nextHistPos,
          status: reservation.status,
          note: `Redeemed ${reward.pointsCost} loyalty pts for ${reward.title} (${voucherCode}) — PKR ${reward.pkrValue} credited to folio.`,
        },
        { transaction },
      );
    } else {
      const nextHistPos = (reservation.history || []).length;
      const upgradeLine = `[Oasis Loyalty Upgrade · ${voucherCode}] ${reward.title}${cleanNote ? ` — ${cleanNote}` : ''}`;
      const existingReq = reservation.specialRequests ? `${reservation.specialRequests}\n` : '';
      await Reservation.update(
        { specialRequests: `${existingReq}${upgradeLine}`.slice(0, 2000) },
        { where: { id: reservation.id }, transaction },
      );

      await ReservationHistory.create(
        {
          reservationId: reservation.id,
          position: nextHistPos,
          status: reservation.status,
          note: `Guest redeemed ${reward.pointsCost} loyalty pts for ${reward.title} (${voucherCode}). Prioritize hut upgrade on arrival/stay.`,
        },
        { transaction },
      );
    }

    const entry = await LoyaltyTransaction.create(
      {
        phoneKey,
        guestName: reservation.guestName,
        reservationId: reservation.id,
        bookingNumber: reservation.bookingNumber,
        type: 'redeem',
        rewardKey: reward.key,
        rewardTitle: reward.title,
        category: reward.category,
        points: -reward.pointsCost,
        pkrValue: reward.pkrValue,
        voucherCode,
        status: reward.category === 'dining' ? 'applied' : 'issued',
        refKey: ledgerRefKey,
        note: cleanNote || (reward.category === 'dining' ? `PKR ${reward.pkrValue} credited to folio` : 'Upgrade request logged for front desk'),
      },
      { transaction },
    );

    const updatedReservation = await Reservation.findByPk(reservation.id, { transaction });
    if (!updatedReservation) throw conflict('Could not refresh reservation after redemption.');
    const summary = await buildLoyaltySummary(updatedReservation, transaction);

    return {
      booking: updatedReservation.toPublic(),
      loyalty: summary,
      redemption: {
        id: entry._id,
        rewardKey: entry.rewardKey,
        rewardTitle: entry.rewardTitle,
        category: entry.category,
        points: entry.points,
        pkrValue: entry.pkrValue,
        voucherCode: entry.voucherCode,
        status: entry.status,
      },
      duplicate: false,
    };
  });
}
