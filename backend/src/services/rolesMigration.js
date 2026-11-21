import { LEGACY_ROLES } from '../config/roles.js';
import User from '../models/User.js';

// Turns accounts that still carry an old role (admin, manager, desk, kitchen)
// into the three current roles. It runs at start-up and does nothing once every
// account is converted. The role column is plain text so old values can exist.
export async function migrateRoles() {
  let changed = 0;
  for (const [legacy, current] of Object.entries(LEGACY_ROLES)) {
    const [count] = await User.update({ role: current }, { where: { role: legacy }, validate: false });
    changed += count;
  }
  return changed;
}
