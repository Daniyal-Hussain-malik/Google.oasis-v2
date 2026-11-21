import { Base, D, dt, fk, text } from './_base.js';

// Rotating DB-backed refresh tokens with token-family tracking for reuse detection.
export class RefreshToken extends Base {}
RefreshToken.setup(
  {
    userId: fk('users', { required: true, onDelete: 'CASCADE' }),
    tokenHash: { type: D.STRING(128), allowNull: false, unique: true },
    familyId: text({ len: 64, required: true }),
    expiresAt: dt({ required: true }),
    revokedAt: dt(),
    replacedByHash: text({ len: 128 }),
    userAgent: text({ len: 255 }),
    ipAddress: text({ len: 64 }),
  },
  {
    table: 'refresh_tokens',
    indexes: [
      { fields: ['userId'] },
      { fields: ['familyId'] },
      { fields: ['expiresAt'] },
    ],
  },
);

export default RefreshToken;
