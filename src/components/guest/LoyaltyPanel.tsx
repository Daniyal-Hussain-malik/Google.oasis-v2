import React, { useMemo, useState } from 'react';
import { Alert } from '@mui/material';
import { ArrowUpRight, Award, BedDouble, CheckCircle2, Gift, History, Sparkles, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { api, pkr, pretty } from '@/src/lib/api';

export interface LoyaltyReward {
  key: string;
  title: string;
  category: 'dining' | 'upgrade';
  pointsCost: number;
  pkrValue: number;
  description: string;
}

export interface LoyaltyLedgerItem {
  id: string;
  type: 'earn' | 'bonus' | 'redeem';
  rewardKey: string;
  rewardTitle: string;
  category: 'stay' | 'dining' | 'upgrade';
  points: number;
  pkrValue: number;
  voucherCode?: string;
  bookingNumber?: string;
  status: string;
  note?: string;
  createdAt?: string;
}

export interface LoyaltySummary {
  availablePoints: number;
  lifetimePoints: number;
  redeemedPoints: number;
  tier: {
    name: string;
    level: number;
    perk: string;
    nextTierName: string | null;
    pointsToNext: number;
    progressPct: number;
  };
  canRedeemOnBooking: boolean;
  upgradeHint?: {
    eligible: boolean;
    nextTierName: string | null;
  };
  rewards: LoyaltyReward[];
  transactions: LoyaltyLedgerItem[];
}

interface LoyaltyPanelProps {
  loyalty: LoyaltySummary;
  bookingNumber: string;
  phone?: string;
  onRedeemed: (payload: { booking: any; loyalty: LoyaltySummary }) => void;
}

const STATUS_LABEL: Record<string, string> = {
  applied: 'Credited to Folio',
  issued: 'Noted at Desk',
  posted: 'Posted',
};

export function LoyaltyPanel({ loyalty, bookingNumber, phone, onRedeemed }: LoyaltyPanelProps) {
  const [filter, setFilter] = useState<'all' | 'dining' | 'upgrade'>('all');
  const [redeemingKey, setRedeemingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ title: string; voucherCode: string; detail: string } | null>(null);

  const visibleRewards = useMemo(() => {
    if (filter === 'all') return loyalty.rewards;
    return loyalty.rewards.filter((r) => r.category === filter);
  }, [filter, loyalty.rewards]);

  async function redeem(reward: LoyaltyReward) {
    setError('');
    setNotice(null);
    setRedeemingKey(reward.key);

    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const res = await api<{
        ok: boolean;
        booking: any;
        loyalty: LoyaltySummary;
        redemption: {
          rewardTitle: string;
          category: 'dining' | 'upgrade';
          pkrValue: number;
          voucherCode: string;
        };
      }>('/public/loyalty/redeem', {
        method: 'POST',
        body: {
          bookingNumber,
          ...(phone ? { phone } : {}),
          rewardKey: reward.key,
          clientRequestId: requestId,
        },
      });

      onRedeemed({ booking: res.booking, loyalty: res.loyalty });
      setNotice({
        title: `${res.redemption.rewardTitle} redeemed`,
        voucherCode: res.redemption.voucherCode,
        detail:
          res.redemption.category === 'dining'
            ? `${pkr(res.redemption.pkrValue)} has been credited directly to your room folio.`
            : 'Our Katpana reception desk has prioritized your hut upgrade request.',
      });
    } catch (err: any) {
      setError(err?.message || 'Could not complete point redemption.');
    } finally {
      setRedeemingKey(null);
    }
  }

  return (
    <section aria-labelledby="oasis-loyalty-heading" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Oasis Circle Loyalty</p>
          <h2 id="oasis-loyalty-heading" className="font-display mt-1 text-3xl font-semibold">
            Your Points & Rewards
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Earn 1 point per PKR 100 on stays and dining charges. Redeem points below for instant dining credits or room upgrades.
          </p>
        </div>
      </div>

      {/* Points Summary & Tier Progress */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-accent/35 bg-gradient-to-br from-card via-card to-accent/10">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
              <Award className="h-3.5 w-3.5 text-accent" />
              Available Balance
            </CardDescription>
            <CardTitle className="font-display text-4xl font-semibold tabular-nums text-foreground">
              {loyalty.availablePoints.toLocaleString()} <span className="text-lg font-normal text-muted-foreground">pts</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Lifetime Earned</span>
              <span className="font-mono font-medium tabular-nums text-foreground">{loyalty.lifetimePoints.toLocaleString()} pts</span>
            </div>
            <div className="flex justify-between">
              <span>Points Redeemed</span>
              <span className="font-mono font-medium tabular-nums text-foreground">{loyalty.redeemedPoints.toLocaleString()} pts</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardDescription>Membership Tier</CardDescription>
                <CardTitle className="font-display text-2xl font-semibold">{loyalty.tier.name}</CardTitle>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                Tier {loyalty.tier.level} of 3
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{loyalty.tier.perk}</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {loyalty.tier.nextTierName
                    ? `${loyalty.tier.pointsToNext.toLocaleString()} lifetime pts to ${loyalty.tier.nextTierName}`
                    : 'Highest Oasis Circle tier unlocked'}
                </span>
                <span className="font-mono font-medium tabular-nums text-foreground">{loyalty.tier.progressPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${Math.max(4, loyalty.tier.progressPct)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {notice && (
        <Alert
          severity="success"
          icon={<CheckCircle2 className="h-5 w-5" />}
          onClose={() => setNotice(null)}
        >
          <p className="font-medium">
            {notice.title} — Voucher <span className="font-mono">{notice.voucherCode}</span>
          </p>
          <p className="text-xs opacity-90 mt-0.5">{notice.detail}</p>
        </Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Reward Catalog */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-accent" />
            <h3 className="font-display text-xl font-semibold">Redeem Your Points</h3>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-1 text-xs">
            {(
              [
                ['all', 'All Rewards'],
                ['dining', 'Dining Discounts'],
                ['upgrade', 'Room Upgrades'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors cursor-pointer ${
                  filter === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {visibleRewards.map((reward) => {
            const enough = loyalty.availablePoints >= reward.pointsCost;
            const disabled = !loyalty.canRedeemOnBooking || !enough || redeemingKey !== null;
            const deficit = Math.max(0, reward.pointsCost - loyalty.availablePoints);
            const isUpgrade = reward.category === 'upgrade';

            return (
              <Card key={reward.key} className="flex flex-col justify-between transition-colors hover:border-accent/40">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/60 text-accent">
                        {isUpgrade ? <BedDouble className="h-4 w-4" /> : <UtensilsCrossed className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {isUpgrade ? 'Room Upgrade' : 'Dining Discount'}
                        </p>
                        <CardTitle className="font-display text-lg leading-snug">{reward.title}</CardTitle>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-accent">
                      {reward.pointsCost} pts
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col justify-between gap-4 pt-0">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground leading-relaxed">{reward.description}</p>
                    {isUpgrade && loyalty.upgradeHint?.nextTierName && (
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {loyalty.upgradeHint.eligible
                          ? `Eligible upgrade available on your dates: ${loyalty.upgradeHint.nextTierName}`
                          : `Request goes directly to front desk for ${loyalty.upgradeHint.nextTierName}`}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      Value ~ {pkr(reward.pkrValue)}
                    </span>
                    <Button
                      type="button"
                      variant={enough && loyalty.canRedeemOnBooking ? 'accent' : 'outline'}
                      size="sm"
                      disabled={disabled}
                      onClick={() => redeem(reward)}
                    >
                      {redeemingKey === reward.key ? (
                        'Redeeming…'
                      ) : !loyalty.canRedeemOnBooking ? (
                        'Active stay required'
                      ) : !enough ? (
                        `Need ${deficit} more pts`
                      ) : (
                        <>
                          Redeem {reward.pointsCost} pts
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Points Ledger & Redeemed Vouchers */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="font-display text-xl">Points Activity & Vouchers</CardTitle>
          </div>
          <CardDescription>Accruals from your stays and all dining or upgrade redemptions.</CardDescription>
        </CardHeader>
        <CardContent>
          {loyalty.transactions.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No loyalty activity recorded yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {loyalty.transactions.map((entry) => {
                const positive = entry.points >= 0;
                return (
                  <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{entry.rewardTitle}</p>
                        {entry.voucherCode && (
                          <span className="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-accent">
                            {entry.voucherCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {entry.note || (positive ? 'Stay accrual' : 'Loyalty redemption')}
                        {entry.createdAt ? ` · ${pretty(entry.createdAt)}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`font-mono text-sm font-semibold tabular-nums ${
                          positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {positive ? `+${entry.points}` : entry.points} pts
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {STATUS_LABEL[entry.status] || entry.status}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
