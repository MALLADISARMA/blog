import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import { createSessionMiddleware } from './config/session.js';
import authRoutes from './routes/authRoutes.js';
import blogRoutes from './routes/blogRoutes.js';
import sectionRoutes from './routes/sectionRoutes.js';
import adminBlogRoutes from './routes/adminBlogRoutes.js';
import adminSectionRoutes from './routes/adminSectionRoutes.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { uploadDirectory } from './config/uploads.js';

const app = express();
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const cookieSecret = process.env.SESSION_SECRET || 'development-only-change-this-secret';

app.disable('x-powered-by');
app.use(helmet());
app.use('/uploads', express.static(uploadDirectory, {
  immutable: true,
  maxAge: '1y',
}));
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(cookieSecret));
app.use(createSessionMiddleware());
app.use(csrf({
  cookie: {
    key: 'blog.csrf',
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
}));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/admin/blogs', adminBlogRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/admin/sections', adminSectionRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
