# NESCAFÉ Make Your World

A single-deployment Next.js experience containing the landing page, drawing editor, fullscreen live display, upload API, MySQL persistence, uploaded-image serving, and Server-Sent Events.

## Local development

```bash
npm install
npm run dev
```

Without `DATABASE_URL`, development uses `data/designs.json`. Uploaded PNGs are written to `uploads/`.

To use MySQL, copy `.env.example` to `.env`, set `DATABASE_URL`, then run:

```bash
npm run db:push
npm run dev
```

## Production deployment

Deploy this repository as one persistent Node service on Railway or Render:

- Build command: `npm run build`
- Start command: `npm start`
- Before the first start: `npm run db:push`
- Set `DATABASE_URL` to the managed MySQL connection string.
- Mount a persistent volume and set `UPLOAD_DIRECTORY` to that mounted directory.
- Optionally set `MAX_UPLOAD_BYTES` (default: `2097152`).
- Run exactly one application instance because the SSE event hub is process-local.

The public venue display is `/nescafe`. It loads the latest ten designs, receives new submissions over SSE without reload, and automatically reconciles after reconnecting.
