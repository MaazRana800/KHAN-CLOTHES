# Khan Storefront and API

This workspace contains a static storefront and an Express API backed by PostgreSQL. The API is not production-ready until a PostgreSQL database is provisioned, the initial catalog is reviewed, and secrets are configured.

## Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer

## Local setup

1. Create a PostgreSQL database named `khan_store` (or choose another name in `DATABASE_URL`).
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, a unique `JWT_SECRET` of at least 32 random characters, `CORS_ORIGIN`, and a unique admin password of at least 12 characters.
3. Install packages with `npm install`.
4. Run `npm run db:migrate` to create the tables.
5. Run `npm run db:seed` to import the current catalog. Review product prices and every size's stock quantity before accepting orders; the checked-in catalog is only starter inventory.
6. Run `npm run admin:create` to create or reset the configured admin account.
7. Start the API with `npm run dev` or `npm start`.
8. Serve the static site from this same origin, or set `KHAN_API_BASE` before `assets/api.js` loads and configure `CORS_ORIGIN` to the exact storefront origin.

The API health check is `GET /api/health`. The browser client expects `/api/products`, `/api/products/:id`, `/api/orders`, `/api/orders/track`, `/api/admin/login`, `/api/admin/orders`, `/api/admin/payments`, and the admin `PATCH` routes.

## Production deployment

- Keep the static site and `/api` behind HTTPS. Configure the hosting provider or reverse proxy to route `/api/*` to this Node service.
- Use a managed PostgreSQL service and its private connection string. Enable `DATABASE_SSL=true` when required by the provider.
- Set `NODE_ENV=production`, a long random `JWT_SECRET`, the exact storefront `CORS_ORIGIN`, and a production `DATABASE_URL` in the hosting secret manager. Never commit `.env` or expose these values in frontend files.
- Create the admin account as a one-off deployment command. Do not keep `ADMIN_PASSWORD` in the running service environment after creation.
- Back up the database and review inventory and payment receiver details before launch.
- The checkout currently supports manual payment references only; it does not charge cards or verify wallet transactions automatically. The receipt file input is not uploaded yet. Do not advertise automated payment or receipt processing until a provider integration and private file storage are added.

## Tests

Run `npm test` for the backend validation and order-state tests. Database-backed endpoint tests still require a configured PostgreSQL instance.# Khan Storefront and API

This project serves the static storefront and its `/api` endpoints from one Express origin. PostgreSQL is the source of truth for the catalog, inventory, orders, payments, and admin accounts.

## Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer

## Local setup

1. Create a PostgreSQL database named `khan_store` (or choose another name and update `DATABASE_URL`).
2. Copy `.env.example` to `.env`, then set `DATABASE_URL`, a unique `JWT_SECRET` of at least 32 characters, and a unique admin password of at least 12 characters.
3. Install dependencies with `npm install`.
4. Create the schema and load the current catalog:

   ```sh
   npm run db:migrate
   npm run db:seed
   npm run admin:create
   ```

5. Start the website and API with `npm start`, then open `http://localhost:3000`.

The seeded catalog carries the current sample stock quantities. Review every price, product image path, size, and inventory count in the database before accepting real orders. Rerunning `db:seed` overwrites catalog data for matching product IDs with the values in `assets/products.js`.

## API routes

- `GET /api/health`
- `GET /api/products` and `GET /api/products/:id`
- `POST /api/orders`
- `GET /api/orders/track?code=...&phone=...`
- `POST /api/admin/login`
- `GET /api/admin/orders` and `GET /api/admin/payments`
- `PATCH /api/admin/orders/:code/status`
- `PATCH /api/admin/payments/:code/verify`
- `POST /api/admin/products`, `PUT /api/admin/products/:id`, and `DELETE /api/admin/products/:id`

Admin routes require `Authorization: Bearer <token>`. The login endpoint issues an eight-hour token. Status transitions are checked on the server; shipping requires a courier tracking number.

`POST /api/orders` accepts customer details, requested product IDs/variants/quantities, payment method and payment reference where applicable, and an optional coupon code. The server ignores client-submitted prices and totals, recalculates the order, checks stock and decrements it within a transaction. Duplicate wallet/bank transaction references are rejected by a database unique index.

## Production notes

- Deploy behind HTTPS and set `NODE_ENV=production`, `DATABASE_SSL=true` as appropriate for the PostgreSQL provider, `DATABASE_URL`, `JWT_SECRET`, and `CORS_ORIGIN`.
- Keep `.env` and database credentials out of source control. Restrict database network access and use a least-privilege database account.
- The manual wallet/bank verification flow is not a payment-provider integration. Staff must confirm incoming funds in the provider/bank before approving.
- SMS delivery and receipt-image uploads are not implemented yet. Do not show a receipt as uploaded or an SMS as sent until those services are connected.
- Admins can create, edit, and soft-archive products. Payment-provider webhooks, password reset/MFA, and operational audit logging remain future production work.

Run backend domain tests with `npm test`.