// Three staff roles. Every permission check in the API reads from here.
//
//   super_admin  Everything: staff accounts, website content, payment accounts,
//                reports, menu and prices, refunds, reversals, blog review.
//   frontdesk    The front office: reservations, check-in/out, payments and
//                proofs, enquiries, the restaurant till and orders, and the
//                kitchen screens. No settings, reports, staff, or money reversals.
//   chef         The kitchen display and tickets only, plus marking a dish sold out.
export const SUPER_ADMIN = 'super_admin';
export const FRONTDESK = 'frontdesk';
export const CHEF = 'chef';

export const ROLES = [SUPER_ADMIN, FRONTDESK, CHEF];

export const ROLE_LABELS = { [SUPER_ADMIN]: 'Super admin', [FRONTDESK]: 'Front desk', [CHEF]: 'Kitchen chef' };

// Accounts made before roles were simplified. They are converted at start-up.
export const LEGACY_ROLES = { admin: SUPER_ADMIN, manager: SUPER_ADMIN, desk: FRONTDESK, kitchen: CHEF };
export const normalizeRole = (role) => LEGACY_ROLES[role] || role;

// Groups used with requireRole().
export const ACCESS = {
  superAdmin: [SUPER_ADMIN],
  frontOffice: [SUPER_ADMIN, FRONTDESK],
  kitchen: [SUPER_ADMIN, FRONTDESK, CHEF],
};

export const isSuperAdmin = (role) => role === SUPER_ADMIN;
