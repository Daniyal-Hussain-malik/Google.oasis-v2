import { defaultExperiences } from '../data/experiences.js';
import { defaultFacilities, FACILITY_ICONS, FACILITY_TAGS } from '../data/facilities.js';
import { defaultPayments } from '../data/payments.js';
import { Base, D, Row, bool, enumCol, int, rowColumns, text } from './_base.js';

const parent = () => ({ type: D.INTEGER, allowNull: false, references: { model: 'settings', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE', _idColumn: true });
const percent = (def = 0) => ({ type: D.DOUBLE, allowNull: false, defaultValue: def, validate: { min: 0, max: 100 } });

class SettingsPhone extends Row {}
SettingsPhone.setup({ settingsId: parent(), value: text({ len: 40 }), ...rowColumns }, { table: 'settings_phones', timestamps: false });

class SettingsActivity extends Row {}
SettingsActivity.setup(
  { settingsId: parent(), title: text({ len: 160, required: true }), body: text({ big: true }), image: text({ big: true }), ...rowColumns },
  { table: 'settings_activities', timestamps: false },
);

class SettingsFacility extends Row {}
SettingsFacility.setup(
  {
    settingsId: parent(),
    name: text({ len: 80, required: true }),
    detail: text({ len: 300 }),
    group: text({ len: 60, def: 'On the grounds' }),
    tag: enumCol(FACILITY_TAGS, 'Included'),
    icon: enumCol(FACILITY_ICONS, 'star'),
    active: bool(true),
    ...rowColumns,
  },
  { table: 'settings_facilities', timestamps: false },
);

class SettingsExperience extends Row {}
SettingsExperience.setup(
  {
    settingsId: parent(),
    slug: text({ len: 80, required: true, lower: true }),
    title: text({ len: 100, required: true }),
    kicker: text({ len: 60 }),
    image: text({ big: true }),
    summary: text({ len: 300 }),
    body: text({ len: 3000 }),
    active: bool(true),
    ...rowColumns,
  },
  { table: 'settings_experiences', timestamps: false },
);

// The single hotel row (key = "hotel").
export class Settings extends Base {
  static async current() {
    let found = await this.findOne({ where: { key: 'hotel' } });
    if (!found) found = this.make({ key: 'hotel' });
    if (!found.paymentsSeeded) {
      found.payments = defaultPayments;
      found.paymentsSeeded = true;
    }
    if (!found.facilitiesSeeded) {
      found.facilities = defaultFacilities.map((facility) => ({ ...facility }));
      found.facilitiesSeeded = true;
    }
    if (!found.experiencesSeeded) {
      found.experiences = defaultExperiences.map((experience) => ({ ...experience }));
      found.experiencesSeeded = true;
    }
    if (found.changed() || found.isNewRecord) {
      try {
        await found.save();
      } catch (error) {
        // Two first requests at once: the other one created the row.
        if (error?.name !== 'SequelizeUniqueConstraintError') throw error;
        return this.findOne({ where: { key: 'hotel' } });
      }
    }
    return found;
  }
}

Settings.setup(
  {
    key: { type: D.STRING(40), allowNull: false, defaultValue: 'hotel', unique: true },
    name: text({ len: 160, def: 'Oasis Resort Skardu' }),
    phone: text({ len: 40, def: '0344-5537788' }),
    email: text({ len: 190, def: 'oasisresortskardu@gmail.com' }),
    whatsapp: text({ len: 30, def: '923445537788' }),
    address: text({ len: 400, def: 'Cold desert, Katpana, Skardu 16100, Gilgit-Baltistan, Pakistan' }),
    checkInTime: text({ len: 10, def: '14:00' }),
    checkOutTime: text({ len: 10, def: '12:00' }),
    policies: text({ big: true }),
    childPolicy: text({ big: true }),
    currency: text({ len: 10, def: 'PKR' }),
    taxRate: percent(),
    restaurantTaxRate: percent(),
    restaurantServiceRate: percent(),
    maxAdvanceDays: int(365, { validate: { min: 1 } }),
    maxNights: int(30, { validate: { min: 1 } }),
    maxRoomsPerBooking: int(4, { validate: { min: 1 } }),
    heroTitle: text({ len: 200 }),
    heroLede: text({ big: true }),
    facilitiesSeeded: bool(false),
    experiencesSeeded: bool(false),
    paymentsSeeded: bool(false),
    // Payment accounts shown to guests (Content & settings -> Payment accounts)
    payments_instructions: text({ len: 600 }),
    payments_easypaisa_enabled: bool(false),
    payments_easypaisa_accountName: text({ len: 80 }),
    payments_easypaisa_number: text({ len: 20 }),
    payments_bank_enabled: bool(false),
    payments_bank_accountTitle: text({ len: 80 }),
    payments_bank_bankName: text({ len: 80 }),
    payments_bank_branchAddress: text({ len: 120 }),
    payments_bank_accountNumber: text({ len: 40 }),
    payments_bank_iban: text({ len: 40 }),
    payments_bank_swift: text({ len: 20 }),
  },
  {
    table: 'settings',
    nested: {
      payments: [
        'instructions',
        'easypaisa.enabled', 'easypaisa.accountName', 'easypaisa.number',
        'bank.enabled', 'bank.accountTitle', 'bank.bankName', 'bank.branchAddress', 'bank.accountNumber', 'bank.iban', 'bank.swift',
      ],
    },
    children: {
      phones: { model: () => SettingsPhone, fk: 'settingsId', scalar: true },
      activities: { model: () => SettingsActivity, fk: 'settingsId' },
      facilities: { model: () => SettingsFacility, fk: 'settingsId' },
      experiences: { model: () => SettingsExperience, fk: 'settingsId' },
    },
  },
);

export { SettingsActivity, SettingsExperience, SettingsFacility, SettingsPhone };
export default Settings;
