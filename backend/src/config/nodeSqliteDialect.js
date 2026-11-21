import { DatabaseSync } from 'node:sqlite';

export const OPEN_READONLY = 1;
export const OPEN_READWRITE = 2;
export const OPEN_CREATE = 4;
export const OPEN_FULLMUTEX = 65536;
export const OPEN_URI = 64;

function Statement(lastID = 0, changes = 0) {
  this.lastID = Number(lastID || 0);
  this.changes = Number(changes || 0);
}

function normalizeVal(v) {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'bigint') return v.toString();
  return v;
}

function normalizeParams(params) {
  if (Array.isArray(params)) return params.map(normalizeVal);
  if (params && typeof params === 'object') {
    const out = Object.create(null);
    for (const [k, v] of Object.entries(params)) {
      out[k] = normalizeVal(v);
    }
    return out;
  }
  return [];
}

export class Database {
  constructor(filename, mode, callback) {
    if (typeof mode === 'function') {
      callback = mode;
      mode = OPEN_READWRITE | OPEN_CREATE;
    }
    this.filename = filename || ':memory:';
    this._queue = Promise.resolve();
    try {
      const readOnly = (mode & OPEN_READONLY) !== 0 && (mode & OPEN_READWRITE) === 0;
      this._db = new DatabaseSync(this.filename, { readOnly });
      try {
        this._db.exec('PRAGMA busy_timeout = 5000');
      } catch {
        /* ignore on memory/readonly */
      }
      if (callback) queueMicrotask(() => callback(null));
    } catch (err) {
      if (callback) queueMicrotask(() => callback(err));
      else throw err;
    }
  }

  serialize(fn) {
    if (typeof fn === 'function') fn();
    return this;
  }

  _enqueue(task) {
    const next = this._queue.then(task, task);
    this._queue = next.catch(() => {});
    return next;
  }

  run(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    this._enqueue(() => {
      try {
        const clean = normalizeParams(params);
        const hasNamed = !Array.isArray(clean) && Object.keys(clean).length > 0;
        const hasPositional = Array.isArray(clean) && clean.length > 0;
        if (!hasNamed && !hasPositional && (sql.includes(';') || /^(PRAGMA|BEGIN|COMMIT|ROLLBACK)/i.test(sql.trim()))) {
          this._db.exec(sql);
          const meta = new Statement(0, 0);
          if (callback) callback.call(meta, null);
          return;
        }
        const stmt = this._db.prepare(sql);
        const info = hasNamed ? stmt.run(clean) : stmt.run(...(Array.isArray(clean) ? clean : []));
        const meta = new Statement(info?.lastInsertRowid, info?.changes);
        if (callback) callback.call(meta, null);
      } catch (err) {
        if (callback) callback.call(new Statement(), err);
      }
    });
    return this;
  }

  all(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    this._enqueue(() => {
      try {
        const clean = normalizeParams(params);
        const stmt = this._db.prepare(sql);
        const hasNamed = !Array.isArray(clean) && Object.keys(clean).length > 0;
        const rows = hasNamed ? stmt.all(clean) : stmt.all(...(Array.isArray(clean) ? clean : []));
        if (callback) callback.call(new Statement(), null, rows || []);
      } catch (err) {
        if (callback) callback.call(new Statement(), err, []);
      }
    });
    return this;
  }

  get(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    this.all(sql, params, (err, rows) => {
      if (callback) callback(err, err ? undefined : rows?.[0]);
    });
    return this;
  }

  close(callback) {
    this._enqueue(() => {
      try {
        if (this._db?.isOpen) this._db.close();
        if (callback) callback(null);
      } catch (err) {
        if (callback) callback(err);
      }
    });
    return this;
  }
}

export function verbose() {
  return { Database, OPEN_READONLY, OPEN_READWRITE, OPEN_CREATE, OPEN_FULLMUTEX, OPEN_URI, verbose };
}

export default { Database, OPEN_READONLY, OPEN_READWRITE, OPEN_CREATE, OPEN_FULLMUTEX, OPEN_URI, verbose };
