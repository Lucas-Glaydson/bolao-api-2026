// check-uri.js
require('dotenv').config();
console.log('MONGODB_URI prefix:', (process.env.MONGODB_URI || '').substring(0, 40));
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Env keys count:', Object.keys(process.env).filter(k => !k.startsWith('npm_') && !k.startsWith('PATH')).length);
