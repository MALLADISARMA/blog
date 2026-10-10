import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { isMemoryMode, pool } from './database.js';

export function createSessionMiddleware() {
  if (process.env.NODE_ENV === 'production' && isMemoryMode()) {
    throw new Error('In-memory sessions are not allowed in production. Configure PostgreSQL-backed sessions.');
  }
  if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
    throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
  }
  const PgStore = connectPgSimple(session);
  return session({
    name: 'blog.sid',
    secret: process.env.SESSION_SECRET || 'development-only-change-this-secret',
    resave: false,
    saveUninitialized: false,
    store: isMemoryMode()
      ? undefined
      : new PgStore({ pool, tableName: 'sessions', createTableIfMissing: true }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8,
    },
  });
}
