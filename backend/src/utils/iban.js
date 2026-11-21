// IBAN check: move the first four characters to the end, turn letters into numbers
// (A=10 ... Z=35) and the remainder when divided by 97 must be 1. It catches almost
// every mistyped digit, which matters when the number is where guests send money.
export function cleanIban(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

export function isValidIban(value) {
  const iban = cleanIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith('PK') && iban.length !== 24) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of moved) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}
