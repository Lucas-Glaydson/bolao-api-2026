export const config = () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  timezone: process.env.APP_TIMEZONE || 'UTC',
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0),
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mata-mata-bolao',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  externalApi: {
    baseUrl: process.env.EXTERNAL_FOOTBALL_API_BASE_URL || '',
    apiKey: process.env.EXTERNAL_FOOTBALL_API_KEY || '',
  },
  sync: {
    cron: process.env.SYNC_CRON || '0 */30 * * * *',
  },
});
