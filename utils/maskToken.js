// utils/maskToken.js
export function maskToken(token, left = 4, right = 4) {
  if (!token || typeof token !== 'string') return '';
  if (token.length <= left + right + 4) return token.replace(/./g, '•');
  const start = token.slice(0, left);
  const end = token.slice(-right);
  const middle = '•'.repeat(Math.max(6, token.length - left - right));
  return `${start}${middle}${end}`;
}
