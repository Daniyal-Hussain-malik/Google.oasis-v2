// The accounts the website shows guests. Copied into the hotel settings the first
// time settings are read; after that the admin portal owns them (Content &
// settings -> Payment accounts). The IBAN is the bank's "PK34HABB00" prefix plus
// the 14-digit account number, and passes the IBAN check-digit test.
export const defaultPayments = {
  instructions: 'Send the amount, then tell us on the website or WhatsApp the transaction ID so the desk can confirm it. Your booking is held while we verify.',
  easypaisa: { enabled: true, accountName: 'Kashif Hassan', number: '03445537788' },
  bank: {
    enabled: true,
    accountTitle: 'OASIS RESORT',
    bankName: 'HABIB BANK',
    branchAddress: 'SKARDU',
    accountNumber: '04767918738803',
    iban: 'PK34HABB0004767918738803',
    swift: 'HABBPKKA',
  },
};
