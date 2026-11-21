export const API = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export function media(src?: string | null): string {
  if (!src) return '';
  if (/^https?:\/\//.test(src) || src.startsWith('/photos') || src.startsWith('data:')) return src;
  if (src.startsWith('/uploads') || src.startsWith('/api/public/media')) {
    return `${API.replace(/\/api$/, '')}${src}`;
  }
  return src;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshAdminSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${API}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      method: options.method || 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.headers || {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error('The hotel system cannot be reached. Check your connection, or WhatsApp the desk.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Something went wrong');
  return data as T;
}

export async function adminApi<T = any>(
  path: string,
  options: { method?: string; body?: unknown; unlockToken?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (options.unlockToken) headers['X-Settings-Token'] = options.unlockToken;

  const exec = () =>
    fetch(`${API}${path}`, {
      method: options.method || 'GET',
      credentials: 'include',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let response: Response;
  try {
    response = await exec();
  } catch {
    throw new Error('The hotel system cannot be reached. Check your connection, or WhatsApp the desk.');
  }

  const canAutoRefresh = !['/auth/login', '/auth/refresh', '/auth/logout', '/auth/setup-admin'].includes(path);
  if (response.status === 401 && canAutoRefresh) {
    const refreshed = await tryRefreshAdminSession();
    if (refreshed) {
      response = await exec();
    }
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Something went wrong');
  return data as T;
}

export async function adminUploadImage(file: File): Promise<{ url: string; provider?: string }> {
  const form = new FormData();
  form.append('image', file);

  const exec = () =>
    fetch(`${API}/admin/uploads`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: form,
    });

  let res = await exec();
  if (res.status === 401) {
    const refreshed = await tryRefreshAdminSession();
    if (refreshed) res = await exec();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Upload failed');
  return data;
}

export async function guestUploadPaymentProof(file: File): Promise<{ url: string; provider?: string }> {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`${API}/public/payments/proof-upload`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Could not upload receipt screenshot');
  return data;
}

export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function clamp(value: string | number, min: number, max: number): number {
  const num = Number.parseInt(String(value), 10);
  if (!Number.isFinite(num)) return min;
  return Math.min(Math.max(num, min), max);
}

export function pkr(value: number | string | null | undefined): string {
  return `PKR ${Math.round(Number(value) || 0).toLocaleString('en-PK')}`;
}

export function pretty(iso?: string): string {
  if (!iso) return '';
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  const [year, month, day] = parts;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function nights(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// Analytics tracker
const VISIT_KEY = 'oasis_visit';
let fallbackSession = '';

function newVisitId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function visitSessionId(): string {
  try {
    let id = sessionStorage.getItem(VISIT_KEY);
    if (!id) {
      id = newVisitId();
      sessionStorage.setItem(VISIT_KEY, id);
    }
    return id;
  } catch {
    fallbackSession ||= newVisitId();
    return fallbackSession;
  }
}

export function track(event: Record<string, unknown>) {
  try {
    fetch(`${API}/public/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: visitSessionId(), ...event }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

// Saved bookings on browser
export interface SavedBooking {
  bookingNumber: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  phone: string;
  savedAt: string;
}

const SAVED_KEY = 'oasis_saved_bookings';

export function getSavedBookings(): SavedBooking[] {
  try {
    const list = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function isBookingSaved(bookingNumber: string): boolean {
  return getSavedBookings().some((item) => item.bookingNumber === bookingNumber);
}

export function saveBookingLocal(booking: any, phone?: string): boolean {
  const entry: SavedBooking = {
    bookingNumber: booking.bookingNumber,
    guestName: booking.guestName,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    phone: phone || '',
    savedAt: new Date().toISOString(),
  };
  try {
    const next = [entry, ...getSavedBookings().filter((item) => item.bookingNumber !== entry.bookingNumber)];
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function removeSavedBooking(bookingNumber: string) {
  try {
    localStorage.setItem(
      SAVED_KEY,
      JSON.stringify(getSavedBookings().filter((item) => item.bookingNumber !== bookingNumber)),
    );
  } catch {
    /* ignore */
  }
}
