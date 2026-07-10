const crypto = require('crypto');
const pinHash = '30acbeaa4710faec809f962c636def7dd4580848cef2c45500687e611888a6fc';
const oldPepper = 'DEFAULT_PEPPER_V3_DEV_ONLY';
const newPepper = 'V3_ORANGE_APP_SECURE_PEPPER_2026';
for (let i = 0; i <= 999999; i++) {
  let p = i.toString().padStart(6, '0');
  let hash1 = crypto.createHash('sha256').update('TJFI' + p + oldPepper).digest('hex');
  let hash2 = crypto.createHash('sha256').update('TJFI' + p + newPepper).digest('hex');
  if (hash1 === pinHash) console.log('MATCH OLD PEPPER:', p);
  if (hash2 === pinHash) console.log('MATCH NEW PEPPER:', p);
}
console.log('Done');
