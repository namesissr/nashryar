export const env = {
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  appUrl: (process.env.APP_URL || 'http://127.0.0.1:3100').replace(/\/$/, ''),
  isProd: process.env.NODE_ENV === 'production',
  cookieName: 'nashryar_session',
  sessionDays: 30,
};
