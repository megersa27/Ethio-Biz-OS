# EthioBiz MS

EthioBiz MS is a smartphone-first business management system designed
to help Ethiopian small and medium-sized businesses manage their daily
business operations. It works online and is built to support offline use,
and the interface is available in English, Afaan Oromoo, and Amharic.

## Project Status

MVP fullstack — backend API and a React + Vite frontend covering the core
business flows. The backend test suite (13 tests) passes against the
configured database.

## Product Scope

The MVP focuses on:

- Authentication (per-business accounts, JWT)
- Dashboard (live sales, expenses, profit, credit and stock alerts)
- Product management (with reorder levels)
- Inventory management (stock movements + history)
- Sales management (atomic sales, stock updates, credit)
- Customer management (contacts + outstanding credit)
- Customer credit (partial payments)
- Expense management
- Business reports (sales, expenses, profit, stock, summary)
- Settings (business + personal profile)
- Multilingual UI (English / Afaan Oromoo / Amharic)

## Target Businesses

Initial target businesses:

- Mini-markets
- Supermarkets
- Pharmacies
- Retail shops

## Technology Stack

### Frontend

- React 19 + Vite
- react-i18next (English, Afaan Oromoo, Amharic)
- recharts (dashboard charts)

### Backend

- Node.js + Express
- MongoDB + Mongoose
- JSON Web Tokens (JWT), bcrypt password hashing
- Multi-tenant: every record is scoped to a `businessId`

### Development

- Git / GitHub
- Postman
- Docker (optional)

## Getting Started

### Backend

```bash
cd backend
cp .env.example .env        # then fill in JWT_SECRET and MONGODB_URI
npm install
npm run dev                  # starts on http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                  # starts on http://localhost:5174
```

The Vite dev server proxies `/api` requests to the backend on port 5000,
so run both servers during development.

## Testing

```bash
cd backend
npm test                     # node --test (13 integration tests)
```

Tests connect to the database configured by `MONGODB_URI` and clean up the
data they create. For safe CI, point `MONGODB_URI` at a dedicated test
database (or an in-memory MongoDB) rather than your production database.

## Building the Frontend

```bash
cd frontend
npm run build                # outputs to frontend/dist
npm run preview              # preview the production build locally
```

## Deployment

The production setup is a single origin served by a reverse proxy
(for example Nginx, Caddy, or a static host + API host):

- Serve the built frontend (`frontend/dist`) as static files.
- Reverse-proxy any request to `/api/*` to the backend on port 5000.

The frontend calls a relative `/api` path, so it works behind such a
proxy with no hardcoded URL changes.

Backend environment (set in production):

- `NODE_ENV=production`
- `PORT` (or the port your proxy forwards to)
- `MONGODB_URI` (your production MongoDB / Atlas connection string)
- `JWT_SECRET` (at least 32 random characters — never reuse a leaked secret)

### Pre-deployment checklist

- [ ] Rotate `JWT_SECRET` if it was ever committed or exposed.
- [ ] Generate a strong `JWT_SECRET` (>= 32 chars) for production.
- [ ] Restrict the MongoDB/Atlas database user to only the databases it needs.
- [ ] Run `npm test` against a test database and confirm all tests pass.
- [ ] Run `npm run build` for the frontend and confirm it succeeds.
- [ ] Have a native Afaan Oromoo and Amharic speaker review the translations
      in `frontend/src/locales/*.json` before going live.

## Known follow-ups for after MVP

- Frontend bundle is a single ~850 kB chunk; add `React.lazy` route-based
  code-splitting to speed initial load.
- Consider moving the JWT from `sessionStorage` to an httpOnly cookie set by
  the backend, plus a refresh-token flow, before scaling.
- Set up a dedicated test database (or `mongodb-memory-server`) so the test
  suite never runs against production data.

## Project Structure

```text
EthioBiz MS - Fullstack/
├── backend/        Node + Express + MongoDB API
├── frontend/       React + Vite SPA (src/locales holds the translations)
├── doc/            Business plan and system-design documents
├── .gitignore
└── README.md
```
