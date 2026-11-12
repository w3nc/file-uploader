# Odin Drive

A file uploader with folders, sign-in, and share links. Built with Express, Prisma (PostgreSQL), Cloudinary, and EJS.

## Tech stack

- **Express 5** — web server
- **Node 20+** — runtime
- **Prisma + PostgreSQL** — database (users, folders, files, shares, sessions)
- **Cloudinary** — file storage
- **EJS** — server-side templates
- **Passport (local strategy)** — sign-in / sessions
- **Multer** — file uploads (5 MB limit, png / jpg / jpeg / pdf / txt)

## Environment

Copy `.env.example` to `.env` and fill in your values:

```
DATABASE_URL=postgresql://user:pass@localhost:5432/odin_drive
SESSION_SECRET=<long random string>
PORT=3000
BASE_URL=http://localhost:3000

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

## Setup

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev        # or npm run start
```

The app runs on `http://localhost:3000`.

## Routes

| Route | Purpose |
|-------|---------|
| `GET /login`, `POST /login` | Sign in |
| `GET /signup`, `POST /signup` | Create account |
| `POST /logout` | Sign out |
| `GET /` | My Drive — folders and top-level files |
| `GET /folders/:id` | View one folder |
| `GET /upload`, `POST /upload` | Upload a file (5 MB max) |
| `GET /files/:id` | File details |
| `GET /files/:id/download` | Download |
| `GET /shared` | Active share links |
| `POST /folders/:id/share` | Create a share link (1 / 10 / 30 days) |
| `GET /share/:id` | Public share page |
| `GET /share/:id/files/:fileId/view\|/download` | View/download a shared file |

## Features

- Sign up / sign in with email and password (bcrypt hashed)
- Create, rename, delete folders
- Upload files to Cloudinary; metadata stored in PostgreSQL
- Share folders via time-limited public links
- Download and inline-view images
- Session survives server restart (Prisma session store)
- CSRF tokens on every form

## Database models

- `User` — email, name, password hash
- `Folder` — belongs to a user; holds files and shares
- `File` — name, Cloudinary URL, MIME type, size, upload time
- `Share` — folder link with expiry
- `Session` — Prisma session store table

## Scripts

- `npm run start` — production start
- `npm run dev` — watch mode
