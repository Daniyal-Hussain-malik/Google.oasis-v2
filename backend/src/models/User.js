import bcrypt from 'bcryptjs';
import { FRONTDESK, ROLES } from '../config/roles.js';
import { Base, D, dt, bool } from './_base.js';

export { ROLES };

// Password and reset fields are left out of every query unless the code asks for
// User.unscoped(), the same way the old schema hid them.
export class User extends Base {
  checkPassword(candidate) {
    return bcrypt.compare(candidate, this.password);
  }
}

const secret = ['password', 'resetTokenHash', 'resetExpires', 'resetRequestedAt'];

User.setup(
  {
    name: { type: D.STRING(120), allowNull: false, validate: { notEmpty: true } },
    email: {
      type: D.STRING(190),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
      set(value) { this.setDataValue('email', String(value ?? '').trim().toLowerCase()); },
    },
    password: { type: D.STRING(100), allowNull: false, validate: { len: { args: [8, 100], msg: 'must be at least 8 characters' } } },
    // A plain string, not an ENUM: accounts from before the role change may still hold an old value until migrateRoles runs.
    role: { type: D.STRING(30), allowNull: false, defaultValue: FRONTDESK, validate: { isIn: [ROLES] } },
    active: bool(true),
    lastLoginAt: dt(),
    resetTokenHash: { type: D.STRING(100), allowNull: true },
    resetExpires: dt(),
    resetRequestedAt: dt(),
    passwordChangedAt: dt(),
  },
  {
    table: 'users',
    hide: secret,
    defaultScope: { attributes: { exclude: secret } },
    hooks: {
      async beforeSave(user) {
        if (user.changed('password')) user.setDataValue('password', await bcrypt.hash(user.getDataValue('password'), 12));
      },
    },
  },
);

export default User;
