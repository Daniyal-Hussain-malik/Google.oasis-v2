// One rule for every new password: 8 to 128 characters with a letter and a number.
// Returns an error message, or an empty string when the password is fine.
export function passwordProblem(value) {
  const password = String(value ?? '');
  if (password.length < 8) return 'The new password must be at least 8 characters.';
  if (password.length > 128) return 'The new password must be at most 128 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'The new password needs at least one letter and one number.';
  return '';
}
