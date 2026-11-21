import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { GuestLayout } from '@/src/components/guest/GuestLayout';
import { ShowcaseHoverCard } from '@/src/components/guest/InteractiveHoverCard';
import { ResilientImage } from '@/src/components/guest/ResilientImage';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent } from '@/src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Label } from '@/src/components/ui/label';
import { Skeleton } from '@mui/material';
import { api, pkr, track } from '@/src/lib/api';
import { presentStay } from '@/src/data/resortContent';

export function RoomsPage() {
  const [types, setTypes] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [maxPrice, setMaxPrice] = useState('all');
  const [guests, setGuests] = useState('all');
  const [bed, setBed] = useState('all');
  const [previewRoom, setPreviewRoom] = useState<any | null>(null);

  useEffect(() => {
    api<any[]>('/public/room-types')
      .then((res) => setTypes(res))
      .catch((err) => setError(err.message || 'Could not load rooms'))
      .finally(() => setLoaded(true));
  }, []);

  const beds = useMemo(
    () => Array.from(new Set(types.map((r) => r.bed).filter(Boolean))),
    [types],
  );

  const filtered = useMemo(() => {
    return types.filter((r) => {
      if (maxPrice !== 'all' && r.baseRate > Number(maxPrice)) return false;
      if (guests !== 'all' && r.maxAdults < Number(guests)) return false;
      if (bed !== 'all' && r.bed !== bed) return false;
      return true;
    });
  }, [types, maxPrice, guests, bed]);

  return (
    <GuestLayout>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-accent">Accommodation</p>
          <h1 className="font-display mt-2 text-4xl font-semibold sm:text-5xl">Huts & suites in Katpana</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Nineteen heated rooms facing the Katpana cold desert and Karakoram ridge. Rates come live from our reservation desk.
          </p>
        </div>

        {/* Filter Toolbar */}
        <Card className="mt-8">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 md:grid-cols-4 md:items-end">
            <div className="space-y-1.5">
              <Label>Maximum Nightly Rate</Label>
              <Select value={maxPrice} onValueChange={setMaxPrice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any rate</SelectItem>
                  {[16000, 20000, 25000, 30000, 40000].map((val) => (
                    <SelectItem key={val} value={String(val)}>
                      Up to {pkr(val)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Adult Capacity</Label>
              <Select value={guests} onValueChange={setGuests}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any capacity</SelectItem>
                  {[1, 2, 3, 4].map((count) => (
                    <SelectItem key={count} value={String(count)}>
                      {count}+ adults
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Bed Configuration</Label>
              <Select value={bed} onValueChange={setBed}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any bed</SelectItem>
                  {beds.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMaxPrice('all');
                setGuests('all');
                setBed('all');
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>

        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

        {!loaded && (
          <div className="mt-8 space-y-6">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} variant="rounded" height={220} />
            ))}
          </div>
        )}

        {loaded && filtered.length === 0 && (
          <Card className="mt-8">
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No room categories match your active filters.</p>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {filtered.map((raw) => {
            const room = presentStay(raw);
            return (
              <ShowcaseHoverCard
                key={room._id}
                image={room.image}
                alt={room.name}
                fallbackTitle={room.name}
                kicker={[room.bed, room.size, `${room.maxAdults} adults${room.maxChildren ? `, ${room.maxChildren} children` : ''}`].filter(Boolean).join(' · ')}
                price={`${pkr(room.baseRate)} / night`}
                title={room.name}
                description={room.description}
                meta={
                  room.amenities?.length
                    ? `Included: ${room.amenities.join(' · ')} · Weekend ${pkr(room.weekendRate || room.baseRate)}`
                    : `Weekend ${pkr(room.weekendRate || room.baseRate)}`
                }
                heightClass="h-80 sm:h-96"
                actions={
                  <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                      onClick={() => {
                        track({ type: 'room_view', path: '/rooms', roomName: room.name });
                        setPreviewRoom(room);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      Details
                    </Button>
                    <Button asChild variant="accent" size="sm">
                      <Link to={`/book?type=${room._id}`}>Check Dates</Link>
                    </Button>
                  </div>
                }
              />
            );
          })}
        </div>
      </div>

      {/* Room Detail Modal */}
      <Dialog open={Boolean(previewRoom)} onOpenChange={(open) => !open && setPreviewRoom(null)}>
        <DialogContent className="max-w-xl">
          {previewRoom && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-3xl">{previewRoom.name}</DialogTitle>
                <DialogDescription>
                  {[previewRoom.bed, previewRoom.size, `Max ${previewRoom.maxAdults} adults`].filter(Boolean).join(' · ')}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-hidden rounded-lg border border-border">
                <ResilientImage src={previewRoom.image} alt={previewRoom.name} className="h-56 w-full object-cover" />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{previewRoom.description}</p>
              <div className="rounded-lg bg-secondary/50 p-4 text-xs space-y-1">
                <p className="font-semibold text-foreground">Room Features</p>
                <p className="text-muted-foreground">{(previewRoom.amenities || []).join(' · ')}</p>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="font-mono text-xl font-semibold tabular-nums">{pkr(previewRoom.baseRate)}</span>
                  <span className="text-xs text-muted-foreground"> / night</span>
                </div>
                <Button asChild variant="accent">
                  <Link to={`/book?type=${previewRoom._id}`}>Select & Book</Link>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </GuestLayout>
  );
}
