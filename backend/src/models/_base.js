// Shared model plumbing on top of Sequelize.
//
// Every table has an integer `id` primary key. The API still speaks the shape the
// website and the admin portal were built on: `_id` as a string, nested objects
// such as `guest.firstName`, and embedded lists such as `reservation.folio`.
// Those are kept in this file so no route or screen has to change:
//
//   * nested objects live in flat columns (guest_firstName) and are read and
//     written as `reservation.guest.firstName`;
//   * lists live in their own child tables with a real foreign key to the parent.
//     An aggregate model (Reservation, RestaurantOrder, Kot, MenuItem, RoomType,
//     Settings) loads its lists after every find and writes them back in save().
import { DataTypes as D, Model, Op } from 'sequelize';
import { sequelize, tx } from '../config/db.js';

export { D, Op, sequelize };

// Column helpers

export const dt = (extra = {}) => ({ type: D.DATE(3), allowNull: true, ...extra });
export const money = (defaultValue = 0, extra = {}) => ({ type: D.DOUBLE, allowNull: false, defaultValue, ...extra });
export const int = (defaultValue = 0, extra = {}) => ({ type: D.INTEGER, allowNull: false, defaultValue, ...extra });
export const bool = (defaultValue = false) => ({ type: D.BOOLEAN, allowNull: false, defaultValue });

// A foreign key to `table`.id. Optional references use SET NULL so removing a
// staff member or a dish never destroys the records that mention them.
export const fk = (table, { required = false, onDelete, extra = {} } = {}) => ({
  type: D.INTEGER,
  allowNull: !required,
  references: { model: table, key: 'id' },
  onDelete: onDelete || (required ? 'RESTRICT' : 'SET NULL'),
  onUpdate: 'CASCADE',
  _idColumn: true,
  ...extra,
});

export const enumCol = (list, defaultValue, extra = {}) => ({
  type: D.ENUM(...list),
  allowNull: false,
  ...(defaultValue === undefined ? {} : { defaultValue }),
  validate: { isIn: [list] },
  ...extra,
});

// Text. `required` means non-empty; `trim` and `lower` clean the value on the way in.
export function text({ len = 255, def = '', required = false, trim = true, lower = false, allowNull = false, big = false } = {}) {
  const column = {
    type: big ? D.TEXT : D.STRING(len),
    allowNull: required ? false : allowNull,
    _clean: { trim, lower, nullable: allowNull },
  };
  if (!required && !allowNull) column.defaultValue = def;
  if (required) column.validate = { notEmpty: { msg: 'is required' } };
  if (!big) column.validate = { ...(column.validate || {}), len: { args: [0, len], msg: `must be at most ${len} characters` } };
  return column;
}

const idOf = (value) => {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
};
export const toId = (value) => idOf(value);

// Row objects (the items of a child list) are plain objects with a `_id` accessor.
function decorate(row) {
  if (row && typeof row === 'object') {
    Object.defineProperty(row, '_id', { get: () => (row.id == null ? undefined : String(row.id)), enumerable: false, configurable: true });
  }
  return row;
}
const rowKey = (row) => {
  const id = row.id ?? (row._id != null ? Number(row._id) : undefined);
  return Number.isInteger(id) && id > 0 ? id : undefined;
};
const hidden = (target, name, value) => Object.defineProperty(target, name, { value, writable: true, enumerable: false, configurable: true });

// Output shape

export function shape(Class, values, holder, { omit = [] } = {}) {
  const meta = Class.meta || {};
  const attrs = Class.rawAttributes;
  const out = {};
  for (const [key, raw] of Object.entries(values)) {
    if (key === 'id' || key === 'position' || omit.includes(key) || meta.hide?.includes(key)) continue;
    // An empty column is left out of the JSON, the way an unset field always was.
    if (raw == null) continue;
    let value = raw;
    if (attrs[key]?._idColumn) value = String(value);
    out[key] = value;
  }
  // flat columns -> nested objects
  for (const group of Object.keys(meta.nested || {})) {
    const nested = {};
    for (const leaf of meta.nested[group]) {
      const column = `${group}_${leaf.replaceAll('.', '_')}`;
      const path = leaf.split('.');
      let target = nested;
      path.slice(0, -1).forEach((part) => { target = target[part] ||= {}; });
      if (out[column] !== undefined) target[path.at(-1)] = out[column];
      delete out[column];
    }
    out[group] = nested;
  }
  out._id = values.id == null ? undefined : String(values.id);
  if (meta.exposeId && out._id) out.id = out._id;
  for (const [name, spec] of Object.entries({ ...(meta.children || {}), ...(meta.rowChildren || {}) })) {
    const list = holder?.[name] || [];
    const Child = spec.model();
    out[name] = spec.scalar ? [...list] : list.map((row) => shape(Child, row, row, { omit: [spec.fk] }));
  }
  for (const name of meta.virtuals || []) out[name] = holder?.[name];
  return out;
}

// Splits what a caller passes to create() into columns and child lists.
function split(Class, data) {
  const meta = Class.meta || {};
  const flat = {};
  const kids = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (meta.children?.[key]) kids[key] = value;
    else if (meta.nested?.[key] && value && typeof value === 'object') {
      for (const leaf of meta.nested[key]) {
        const [first, ...rest] = leaf.split('.');
        let found = value[first];
        for (const part of rest) found = found?.[part];
        if (found !== undefined) flat[`${key}_${leaf.replaceAll('.', '_')}`] = found;
      }
    } else flat[key] = value;
  }
  return { flat, kids };
}

function treeOf(leaves) {
  const tree = {};
  for (const leaf of leaves) {
    let node = tree;
    const parts = leaf.split('.');
    parts.slice(0, -1).forEach((part) => { node = node[part] ||= {}; });
    node[parts.at(-1)] = null;
  }
  return tree;
}

function bind(instance, prefix, tree) {
  const object = {};
  for (const [key, sub] of Object.entries(tree)) {
    const column = `${prefix}_${key}`;
    Object.defineProperty(object, key, {
      enumerable: true,
      get: () => (sub === null ? instance.getDataValue(column) ?? undefined : bind(instance, column, sub)),
      set: (value) => assign(instance, column, sub, value),
    });
  }
  return object;
}

function assign(instance, column, sub, value) {
  if (sub === null) { instance.set(column, value); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, deeper] of Object.entries(sub)) if (key in value) assign(instance, `${column}_${key}`, deeper, value[key]);
}

// Child lists

async function loadInto(Class, holders, transaction) {
  const specs = Class.meta?.children;
  if (!specs || !holders.length) return;
  const ids = holders.map((holder) => holder.id);
  for (const [name, spec] of Object.entries(specs)) {
    const Child = spec.model();
    const found = await Child.findAll({ where: { [spec.fk]: ids }, order: [['position', 'ASC'], ['id', 'ASC']], transaction });
    const rows = found.map((row) => decorate(row.get({ plain: true })));
    if (Child.meta?.rowChildren && !spec.scalar) await loadRows(Child, rows, transaction);
    const byParent = new Map(ids.map((id) => [id, []]));
    for (const row of rows) byParent.get(row[spec.fk])?.push(row);
    for (const holder of holders) {
      const mine = byParent.get(holder.id) || [];
      holder[name] = spec.scalar ? mine.map((row) => row.value) : mine;
    }
  }
  for (const holder of holders) if (holder instanceof Model) hidden(holder, '_snap', snapshot(Class, holder));
}

// Lists inside a row of a list (the add-ons of an order line).
async function loadRows(Class, rows, transaction) {
  const ids = rows.map((row) => row.id);
  for (const [name, spec] of Object.entries(Class.meta.rowChildren)) {
    const Child = spec.model();
    const found = await Child.findAll({ where: { [spec.fk]: ids }, order: [['position', 'ASC'], ['id', 'ASC']], transaction });
    const byParent = new Map(ids.map((id) => [id, []]));
    for (const item of found) byParent.get(item[spec.fk])?.push(item.get({ plain: true }));
    for (const row of rows) {
      const mine = byParent.get(row.id) || [];
      row[name] = spec.scalar ? mine.map((item) => item.value) : mine;
    }
  }
}

function snapshot(Class, holder) {
  const snap = {};
  for (const [name, spec] of Object.entries(Class.meta.children)) {
    const list = holder[name] || [];
    snap[name] = spec.scalar ? JSON.stringify(list) : new Map(list.map((row) => [row.id, JSON.stringify(row)]));
  }
  return snap;
}

const columnsOf = (Child) => Object.keys(Child.rawAttributes).filter((key) => key !== 'id');

function valuesFor(Child, spec, parentId, row, position) {
  const values = { [spec.fk]: parentId, position };
  for (const key of columnsOf(Child)) if (key !== spec.fk && key !== 'position' && row[key] !== undefined) values[key] = row[key];
  return values;
}

// Checks every list item before anything is written.
async function validateChildren(instance) {
  const { children = {} } = instance.constructor.meta;
  for (const [name, spec] of Object.entries(children)) {
    const Child = spec.model();
    const list = instance[name] || [];
    for (const [index, row] of list.entries()) {
      if (spec.scalar) continue;
      await Child.build(valuesFor(Child, spec, instance.id ?? 1, row, index)).validate();
      if (Child.meta?.rowChildren) {
        for (const [inner, innerSpec] of Object.entries(Child.meta.rowChildren)) {
          const InnerChild = innerSpec.model();
          for (const [at, item] of (row[inner] || []).entries()) {
            if (!innerSpec.scalar) await InnerChild.build({ ...item, [innerSpec.fk]: row.id ?? 1, position: at }).validate();
          }
        }
      }
    }
  }
}

async function replaceNested(Child, row, transaction) {
  for (const [inner, spec] of Object.entries(Child.meta?.rowChildren || {})) {
    const InnerChild = spec.model();
    await InnerChild.destroy({ where: { [spec.fk]: row.id }, transaction });
    const list = row[inner] || [];
    if (!list.length) continue;
    await InnerChild.bulkCreate(
      list.map((item, position) => (spec.scalar ? { [spec.fk]: row.id, value: item, position } : { ...item, [spec.fk]: row.id, position })),
      { transaction },
    );
  }
}

async function syncChildren(instance, transaction) {
  const Class = instance.constructor;
  const snap = instance._snap || {};
  for (const [name, spec] of Object.entries(Class.meta.children || {})) {
    const Child = spec.model();
    const list = instance[name] || [];

    if (spec.scalar) {
      const json = JSON.stringify(list);
      if (snap[name] === json) continue;
      await Child.destroy({ where: { [spec.fk]: instance.id }, transaction });
      if (list.length) await Child.bulkCreate(list.map((value, position) => ({ [spec.fk]: instance.id, value, position })), { transaction });
      continue;
    }

    const before = snap[name] instanceof Map ? snap[name] : new Map();
    const keep = new Set();
    for (const [position, row] of list.entries()) {
      row.position = position;
      const key = rowKey(row);
      if (key && before.has(key)) {
        keep.add(key);
        if (before.get(key) === JSON.stringify(row)) continue;
        const values = valuesFor(Child, spec, instance.id, row, position);
        delete values[spec.fk];
        await Child.update(values, { where: { id: key }, transaction });
        row.id = key;
        decorate(row);
        await replaceNested(Child, row, transaction);
      } else {
        const created = await Child.create(valuesFor(Child, spec, instance.id, row, position), { transaction });
        Object.assign(row, created.get({ plain: true }));
        decorate(row);
        keep.add(row.id);
        await replaceNested(Child, row, transaction);
      }
    }
    const gone = [...before.keys()].filter((key) => !keep.has(key));
    if (gone.length) await Child.destroy({ where: { id: gone }, transaction });
  }
  hidden(instance, '_snap', snapshot(Class, instance));
}

// Base classes

export class Base extends Model {
  get _id() {
    return this.id == null ? undefined : String(this.id);
  }

  toJSON() {
    return shape(this.constructor, this.get({ plain: true }), this);
  }

  toObject() {
    return this.toJSON();
  }

  // attributes: Sequelize attributes. meta:
  //   table       table name
  //   nested      { group: ['leaf', 'sub.leaf'] } columns named group_leaf, group_sub_leaf
  //   children    { list: { model: () => Child, fk: 'parentId', scalar?: true } }
  //   virtuals    getter names added to the JSON
  //   hide        columns never sent to the browser
  //   indexes     Sequelize indexes
  //   timestamps  default true
  //   hooks, defaultScope, scopes
  static setup(attributes, { table, nested, children, rowChildren, virtuals, hide, indexes, timestamps = true, hooks, defaultScope, scopes, exposeId } = {}) {
    const cleaned = {};
    for (const [key, definition] of Object.entries(attributes)) {
      const column = { ...definition };
      if (column._clean) {
        const { trim, lower, nullable } = column._clean;
        column.set = function setClean(value) {
          if (value == null) { this.setDataValue(key, nullable ? null : ''); return; }
          let next = String(value);
          if (trim) next = next.trim();
          if (lower) next = next.toLowerCase();
          this.setDataValue(key, next);
        };
        delete column._clean;
      }
      if (column._idColumn) {
        column.set = function setId(value) { this.setDataValue(key, idOf(value)); };
      }
      cleaned[key] = column;
    }
    for (const group of Object.keys(nested || {})) {
      for (const leaf of nested[group]) {
        const column = `${group}_${leaf.replaceAll('.', '_')}`;
        if (!cleaned[column]) throw new Error(`${this.name}: nested ${group} lists "${leaf}" but column ${column} is not defined`);
      }
    }
    // An _idColumn marker means the column is an id for output and input.
    const withAttrs = cleaned;
    this.meta = { nested, children, rowChildren, virtuals, hide, exposeId };
    this.init(withAttrs, {
      sequelize,
      modelName: this.name,
      tableName: table,
      timestamps,
      indexes,
      hooks,
      defaultScope,
      scopes,
    });
    for (const [group, leaves] of Object.entries(nested || {})) {
      const tree = treeOf(leaves);
      Object.defineProperty(this.prototype, group, {
        configurable: true,
        get() { return bind(this, group, tree); },
        set(value) { assign(this, group, tree, value); },
      });
    }
    if (children) {
      this.addHook('afterFind', async (result, options) => {
        if (!result || options?.raw || options?.light) return;
        const list = (Array.isArray(result) ? result : [result]).filter((item) => item instanceof Model);
        await loadInto(this, list, options?.transaction);
      });
    }
    return this;
  }

  // Builds an unsaved record from the same shape the API uses (nested objects and lists).
  static make(data = {}) {
    const { flat, kids } = split(this, data);
    const instance = this.build(flat);
    for (const name of Object.keys(this.meta.children || {})) {
      const given = kids[name] || [];
      instance[name] = given.map((row) => (row && typeof row === 'object' ? decorate({ ...row }) : row));
    }
    if (this.meta.children) hidden(instance, '_snap', {});
    return instance;
  }

  static async create(data = {}, options = {}) {
    const instance = this.make(data);
    await instance.save(options);
    return instance;
  }

  async save(options = {}) {
    if (!this.constructor.meta.children) return super.save(options);
    await validateChildren(this);
    const run = async (transaction) => {
      await super.save({ ...options, transaction });
      await syncChildren(this, transaction);
    };
    if (options.transaction) await run(options.transaction);
    else await tx(run);
    return this;
  }
}

// The row type for items of a child list: no timestamps, ordered by `position`.
export class Row extends Base {}
export const rowColumns = { position: int(0) };
