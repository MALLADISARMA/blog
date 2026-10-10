# Personal Blog Platform

A full-stack personal blog with a public site for reading published blogs and a private dashboard for managing blogs and their nested content. The project is built with React, Express, and PostgreSQL.

## Features

- Public blog listing and long-form reading pages
- Admin dashboard for creating, editing, publishing, and deleting blogs
- Blog-owned sections with rich content, nested hierarchy, and stable ordering
- One administrator account; there is no public sign-up or registration page
- Session-based authentication, password hashing, CSRF protection, and rate-limited login
- Rich-text article editing with formatting, lists, and locally uploaded images
- Server-side and browser-side sanitization for article HTML

## Technology

| Area | Technologies |
| --- | --- |
| Frontend | React, React Router, Vite |
| Backend | Node.js, Express |
| Database | PostgreSQL, `pg`, SQL migration |
| Authentication | `express-session`, `connect-pg-simple`, `bcrypt` |

## Prerequisites

Install the following before setup:

- Node.js 20 or newer (LTS recommended) and npm
- Docker Desktop with Docker Compose

## First-time setup

Run these commands in PowerShell from the project folder:

```powershell
Set-Location e:\blog\personal-blog

Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
notepad server\.env
```

In `server\.env`, set a private `SESSION_SECRET` and choose the administrator's `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Use a password of at least 12 characters. Keep this file private and do not commit it.

In production, set `NODE_ENV=production`, use a `SESSION_SECRET` of at least 32 characters, and serve the site over HTTPS. Production sessions are stored in PostgreSQL; the server refuses to start with in-memory session storage. Session cookies are HttpOnly, Secure in production, and use SameSite=Lax. Cookie-authenticated state-changing requests require a CSRF token; the frontend API client retrieves and sends it automatically.

Install the project dependencies once:

```powershell
npm run setup
```

## Start the app

From the project folder, run:

```powershell
npm run dev
```

The launcher starts PostgreSQL, applies the database migration, creates the administrator account if it does not already exist, starts the API and frontend, and opens the site in your browser.

- Public site: <http://localhost:5173>
- Administrator sign-in: <http://localhost:5173/login>
- API health check: <http://localhost:4000/api/health>

Keep the terminal open while using the app. Press **Ctrl+C** to stop the API and frontend. PostgreSQL stays running; to stop it too, run:

```powershell
docker compose stop postgres
```

## Administrator access

The initial administrator is created using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `server\.env`. There is no public registration route, and the database schema restricts the app to one administrator account.

To provision the administrator initially, configure a valid `ADMIN_EMAIL` and an `ADMIN_PASSWORD` of at least 12 characters in `server\.env`, then run this once from the project folder:

```powershell
npm --prefix server run migrate
node server\src\scripts\createAdmin.js
```

The provisioning command refuses to create a second administrator. It hashes the password with bcrypt and never prints the password or its hash. Application startup does not create or reset administrator credentials.

To rotate the administrator password, update `ADMIN_PASSWORD` in `server\.env` to a new password of at least 12 characters, then explicitly run:

```powershell
node server\src\scripts\rotateAdminPassword.js
```

The script updates the password hash only for the existing `ADMIN_EMAIL`. Remove the temporary plaintext password from `server\.env` (or replace it with the value you intend to retain) after the command completes. Keep the environment file private and do not pass passwords as command-line arguments, where they may be recorded in shell history or process listings.

Cloning this repository does not grant access to your running blog. A separate clone uses its own environment configuration and database. Access to your blog requires access to its administrator credentials or its deployed server/database.

## Useful commands

Run from the project folder:

| Command | Description |
| --- | --- |
| `npm run dev` | Start PostgreSQL, API, and frontend for local development |
| `npm run server:test` | Run backend API tests using the in-memory test store |
| `npm run client:build` | Create a production frontend build |
| `npm --prefix server run migrate` | Apply the database migration |
| `node server\src\scripts\createAdmin.js` | Create the initial administrator from `server\.env` |
| `docker compose stop postgres` | Stop the local PostgreSQL container |

Run all automated backend and API-client tests and produce a production frontend build from the project folder:

```powershell
npm test
npm run build
```

You can also start the components separately. Start PostgreSQL with `docker compose up -d postgres`, apply the schema with `npm --prefix server run migrate`, start the API with `npm --prefix server run dev`, and start Vite in another terminal with `npm --prefix client run dev`.

## API overview

Public published blogs are available at `GET /api/blogs`. Use `page` (default `1`) and `limit` (default `10`, maximum `100`) for pagination, `search` for blog and nested-section title/content search, and `sort` (`publishedAt`, `createdAt`, `updatedAt`, or `title`) with `order` (`asc` or `desc`). `GET /api/blogs/:slug` returns a blog with its nested content sections.

Each blog can own a tree of content sections. The admin editor saves each section's rich text, parent/child relationship, and display order together with its blog; the database enforces that a subsection cannot belong to another blog. The tree is limited to 500 sections and 100 levels per blog to keep requests bounded. The additive `002-blog-sections.sql` migration runs during the standard development startup; if starting components separately, apply it with `npm --prefix server run migrate` before launching the API. The admin detail endpoint is `GET /api/admin/blogs/:id`; existing standalone topic/category endpoints remain available for compatibility.

Administrator post operations use `POST /api/admin/blogs`, `GET /api/admin/blogs`, `PUT` or `DELETE /api/admin/blogs/:id`, and `PATCH /api/admin/blogs/:id/publish` or `/unpublish`. Upload an image with multipart field `image` to `POST /api/admin/blogs/images`; uploads accept JPEG, PNG, GIF, and WebP files up to 5 MB. Admin requests require a valid session and CSRF token. Uploaded images are served publicly from `/uploads/` and stored in `server\uploads` by default. Set `UPLOAD_DIR` in `server\.env` to choose another persistent directory. Back up this directory along with the database; deployments with ephemeral local storage must provide persistent disk or replace this storage with an object-storage service. Section changes use `POST /api/admin/sections`, `PUT /api/admin/sections/:id`, and `DELETE /api/admin/sections/:id`. The existing `/api/blogs/admin/...` and `/api/sections/admin/...` routes remain available for compatibility.

## Project structure

```text
client/     React and Vite frontend
server/     Express API, database migration, and tests
scripts/    Local development launcher
specs/      Project design notes
docker-compose.yml
```

## Troubleshooting

- **Docker is unavailable:** Start Docker Desktop, then retry `npm run dev`.
- **Environment file missing:** Copy the example files as shown under [First-time setup](#first-time-setup).
- **Dependencies are missing:** Run `npm run setup`.
- **Admin sign-in fails:** Check `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `server\.env`. The configured email and password are used when the first administrator is created; changing them later does not automatically change an existing account.
- **Port already in use:** Stop the other process using port `4000`, `5173`, or `5432`, then retry.

## Production deployment

Deploy the Express API and React production build behind HTTPS. Set `NODE_ENV=production`, a private `DATABASE_URL`, a cryptographically random `SESSION_SECRET` of at least 32 characters, and `CLIENT_ORIGIN` to the exact HTTPS origin serving the frontend. Set `VITE_API_BASE_URL` at frontend build time only if the API is on a separate origin; do not put credentials or secrets into any `VITE_` variable. Apply migrations explicitly before starting the API and provision the administrator separately. Use PostgreSQL-backed sessions, allow inbound database access only from the API host, and do not publish PostgreSQL's port to the internet. The included Compose file is for local development and binds PostgreSQL to loopback only; it is not a production deployment configuration.
