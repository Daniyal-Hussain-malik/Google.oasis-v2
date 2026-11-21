import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, LinearProgress, Skeleton } from '@mui/material';
import { MoonStar, RefreshCw, TrendingUp } from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { AdminLayout } from '@/src/pages/admin/AdminLayout';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { SUPER, useAdminAuth } from '@/src/context/AdminAuthContext';
import { addDays, adminApi, pkr, pretty, todayISO } from '@/src/lib/api';

type TrendRange = '7d' | '14d' | '30d';

interface TrendPoint {
  date: string;
  label: string;
  bookedRooms: number;
  checkIns: number;
  occupancy: number;
  revenue: number;
}

function shortDayLabel(iso: string): string {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function BookingTrendsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TrendPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card/95 p-3 text-xs shadow-lg backdrop-blur-sm">
      <p className="font-semibold text-foreground">{pretty(pt.date)}</p>
      <div className="mt-1.5 space-y-1 tabular-nums">
        <p className="flex items-center justify-between gap-4 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#d97724]" />
            Booked Rooms
          </span>
          <span className="font-mono font-semibold text-foreground">
            {pt.bookedRooms} ({pt.occupancy}%)
          </span>
        </p>
        <p className="flex items-center justify-between gap-4 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#0ea5e9]" />
            New Check-ins
          </span>
          <span className="font-mono font-semibold text-foreground">{pt.checkIns}</span>
        </p>
        <p className="flex items-center justify-between gap-4 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#10b981]" />
            Room Revenue
          </span>
          <span className="font-mono font-semibold text-foreground">{pkr(pt.revenue)}</span>
        </p>
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const { can } = useAdminAuth();
  const [data, setData] = useState<any>(null);
  const [occ, setOcc] = useState<any>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [trendRange, setTrendRange] = useState<TrendRange>('14d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [auditing, setAuditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [d, o, resList] = await Promise.all([
        adminApi('/admin/dashboard'),
        adminApi('/admin/occupancy?days=30'),
        adminApi<{ items?: any[] }>('/admin/reservations?limit=200').catch(() => ({ items: [] })),
      ]);
      setData(d);
      setOcc(o);
      setReservations(Array.isArray(resList?.items) ? resList.items : []);
    } catch (err: any) {
      setError(err.message || 'Could not load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bookingTrends = useMemo<TrendPoint[]>(() => {
    const baseDate = data?.businessDate || occ?.from || todayISO();
    const totalRooms = Number(data?.rooms) || 19;
    const occMap = new Map<string, any>((occ?.series || []).map((row: any) => [row.date, row]));
    const activeReservations = reservations.filter((r) => r.status !== 'cancelled');

    const [startOffset, totalDays] =
      trendRange === '7d' ? [-3, 7] : trendRange === '14d' ? [-6, 14] : [-6, 30];

    return Array.from({ length: totalDays }, (_, idx) => {
      const date = addDays(baseDate, startOffset + idx);
      const occDay = occMap.get(date);

      let resRooms = 0;
      let checkIns = 0;
      let resRevenue = 0;

      for (const r of activeReservations) {
        if (r.checkIn === date) checkIns += 1;
        if (r.checkIn && r.checkOut && r.checkIn <= date && date < r.checkOut) {
          const roomCount = Math.max(Array.isArray(r.rooms) ? r.rooms.length : 1, 1);
          resRooms += roomCount;
          const stayNights = Math.max(Number(r.nights) || 1, 1);
          resRevenue += (Number(r.totalAmount) || 0) / stayNights;
        }
      }

      const bookedRooms = Math.max(resRooms, Number(occDay?.sold) || 0);
      const revenue = Math.round(Math.max(resRevenue, Number(occDay?.revenue) || 0));
      const occupancy = totalRooms > 0 ? Math.min(100, Math.round((bookedRooms / totalRooms) * 100)) : 0;

      return {
        date,
        label: shortDayLabel(date),
        bookedRooms,
        checkIns,
        occupancy,
        revenue,
      };
    });
  }, [data?.businessDate, data?.rooms, occ?.from, occ?.series, reservations, trendRange]);

  const trendSummary = useMemo(() => {
    const totalCheckIns = bookingTrends.reduce((sum, pt) => sum + pt.checkIns, 0);
    const totalRevenue = bookingTrends.reduce((sum, pt) => sum + pt.revenue, 0);
    const peakBooked = bookingTrends.reduce((max, pt) => Math.max(max, pt.bookedRooms), 0);
    return { totalCheckIns, totalRevenue, peakBooked };
  }, [bookingTrends]);

  async function quickStatus(id: string | number, status: 'checked_in' | 'checked_out') {
    try {
      await adminApi(`/admin/reservations/${id}/status`, { method: 'POST', body: { status } });
      toast.success(status === 'checked_in' ? 'Guest checked in' : 'Guest checked out');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Action blocked');
    }
  }

  async function runNightAudit() {
    setAuditing(true);
    try {
      const res = await adminApi<{ count?: number }>('/admin/reservations/night-audit', { method: 'POST' });
      toast.success(`Night audit complete (${res.count ?? 0} processed)`);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Night audit failed');
    } finally {
      setAuditing(false);
    }
  }

  return (
    <AdminLayout title="Front Desk Dashboard">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">Morning Desk</h1>
            <p className="text-sm text-muted-foreground">
              Business Date: <span className="font-mono font-medium text-foreground">{data?.businessDate || '—'}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            {can(...SUPER) && (
              <Button variant="outline" size="sm" disabled={auditing} onClick={runNightAudit}>
                <MoonStar className="h-4 w-4" />
                {auditing ? 'Running Audit…' : 'Night Audit'}
              </Button>
            )}
            <Button asChild variant="accent" size="sm">
              <Link to="/admin/reservations">Manage Reservations</Link>
            </Button>
          </div>
        </div>

        {error && <Alert severity="error">{error}</Alert>}

        {loading && !data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Skeleton key={n} variant="rounded" height={110} />
            ))}
          </div>
        ) : data ? (
          <>
            {/* KPI Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Occupancy Tonight</CardDescription>
                  <CardTitle className="font-mono text-3xl tabular-nums">{data.occupancy}%</CardTitle>
                </CardHeader>
                <CardContent>
                  <LinearProgress variant="determinate" value={data.occupancy} color="secondary" className="rounded-full" />
                  <p className="mt-2 font-mono text-xs text-muted-foreground tabular-nums">
                    {data.soldTonight} / {data.rooms} rooms sold
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>In-House Stays</CardDescription>
                  <CardTitle className="font-mono text-3xl tabular-nums">{data.inHouse}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Currently checked in</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Expected Arrivals</CardDescription>
                  <CardTitle className="font-mono text-3xl tabular-nums">{data.arrivals?.length || 0}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Arriving today</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Departures Due</CardDescription>
                  <CardTitle className="font-mono text-3xl tabular-nums">{data.departures?.length || 0}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Checking out today</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Open Enquiries</CardDescription>
                  <CardTitle className="font-mono text-3xl tabular-nums text-accent">{data.newEnquiries}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Link to="/admin/enquiries" className="text-xs font-medium text-accent hover:underline">
                    {data.arrivalsNext7Days} arrivals next 7d →
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* Booking Trends (Recharts) */}
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-accent" />
                    Booking Trends
                  </CardTitle>
                  <CardDescription>
                    Booked rooms, daily check-ins, and projected room revenue across active reservations
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="hidden items-center gap-4 text-xs text-muted-foreground xl:flex">
                    <span>
                      Check-ins: <strong className="font-mono text-foreground">{trendSummary.totalCheckIns}</strong>
                    </span>
                    <span>
                      Peak Rooms: <strong className="font-mono text-foreground">{trendSummary.peakBooked}</strong>
                    </span>
                    <span>
                      Window Revenue: <strong className="font-mono text-foreground">{pkr(trendSummary.totalRevenue)}</strong>
                    </span>
                  </div>
                  <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-0.5 text-xs">
                    {(['7d', '14d', '30d'] as TrendRange[]).map((range) => (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setTrendRange(range)}
                        className={`rounded-md px-2.5 py-1 font-mono uppercase transition-colors cursor-pointer ${
                          trendRange === range
                            ? 'bg-card font-semibold text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={bookingTrends} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="oasisBookingAmber" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d97724" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#d97724" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={16}
                      />
                      <YAxis
                        yAxisId="left"
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        tickLine={false}
                        axisLine={false}
                        width={32}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                        width={44}
                      />
                      <Tooltip content={<BookingTrendsTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="bookedRooms"
                        name="Booked Rooms"
                        stroke="#d97724"
                        strokeWidth={2.5}
                        fill="url(#oasisBookingAmber)"
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="checkIns"
                        name="Check-ins"
                        fill="#0ea5e9"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={20}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue (PKR)"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Today's Arrivals & Departures */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Today’s Arrivals</CardTitle>
                  <CardDescription>Confirmed reservations checking in on {pretty(data.businessDate)}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {data.arrivals?.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Booking</TableHead>
                          <TableHead>Guest</TableHead>
                          <TableHead>Room</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.arrivals.map((r: any) => (
                          <TableRow key={r._id}>
                            <TableCell className="font-mono text-xs">{r.bookingNumber}</TableCell>
                            <TableCell className="font-medium">{r.guestName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {(r.rooms || []).map((rm: any) => rm.roomNo).join(', ')}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="accent" onClick={() => quickStatus(r._id, 'checked_in')}>
                                Check In
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="p-6 text-sm text-muted-foreground">No pending arrivals remaining today.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Today’s Departures</CardTitle>
                  <CardDescription>In-house guests scheduled to check out today</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {data.departures?.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Booking</TableHead>
                          <TableHead>Guest</TableHead>
                          <TableHead>Balance</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.departures.map((r: any) => (
                          <TableRow key={r._id}>
                            <TableCell className="font-mono text-xs">{r.bookingNumber}</TableCell>
                            <TableCell className="font-medium">{r.guestName}</TableCell>
                            <TableCell className="font-mono text-xs tabular-nums">{pkr(r.balance)}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline" onClick={() => quickStatus(r._id, 'checked_out')}>
                                Check Out
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="p-6 text-sm text-muted-foreground">No scheduled departures today.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 30-Day Occupancy & Revenue Chart */}
            {occ?.series?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">30-Day Occupancy & Room Revenue Forecast</CardTitle>
                  <CardDescription>Bar height represents occupancy percentage; hover any bar for nightly revenue.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex h-40 items-end gap-1 pt-4">
                    {occ.series.map((day: any) => (
                      <div
                        key={day.date}
                        title={`${pretty(day.date)} · ${day.sold}/${day.rooms} rooms (${day.occupancy}%) · ${pkr(day.revenue)}`}
                        className="group relative flex-1 flex flex-col justify-end h-full"
                      >
                        <div
                          className="w-full rounded-t bg-accent/80 transition-colors group-hover:bg-accent"
                          style={{ height: `${Math.max(day.occupancy, 4)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between font-mono text-xs text-muted-foreground">
                    <span>{pretty(occ.series[0]?.date)}</span>
                    <span>Total 30d Revenue: {pkr(occ.series.reduce((s: number, d: any) => s + d.revenue, 0))}</span>
                    <span>{pretty(occ.series.at(-1)?.date)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
