This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Firebase User Authentication

Firebase verifies user identity only. This backend continues issuing and
validating the application's existing user access and refresh JWTs.

Configure either `FIREBASE_SERVICE_ACCOUNT_JSON` or all three service account
variables:

```bash
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Firebase Cloud Messaging browser push uses the same Firebase Admin credentials
on the backend and the dashboard web config on each frontend. Configure:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
```

Deploy migration `20260721110000_notification_devices` before enabling push
registration in production.

Live dashboard notification badge updates use SSE and can fan out across
multiple backend processes with Redis pub/sub. Configure either variable on
`auto_parts_admin` when running more than one Node process/container:

```bash
NOTIFICATION_REDIS_URL=redis://localhost:6379
# or
REDIS_URL=redis://localhost:6379
```

If Redis is not configured or is temporarily unavailable, notification database
rows and Firebase browser push still work. Only cross-process live SSE delivery
falls back to single-process in-memory behavior. See
`docs/NOTIFICATION_FLOW.md` in the project root for the full flow.

For local frontend access, API CORS is handled globally for `/api/*` routes.
Browser origins must be listed explicitly as a comma-separated allowlist. Native
React Native and server-to-server requests normally omit `Origin` and continue
to work without being added to this list:

```bash
USER_AUTH_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004,http://localhost:4001
```

Use the real HTTPS origins for every deployed web app in production. Unknown
browser origins are rejected with `403`; wildcard credentialed CORS is not
supported.

Also configure the existing user auth JWT settings:

```bash
USER_JWT_ACCESS_SECRET=
USER_JWT_REFRESH_SECRET=
USER_COOKIE_DOMAIN=.websitedesignersdubai.ae
```

## Stripe Payments

Stripe is the payment authority for customer checkout, garage booking advances,
and paid business plan/add-on purchases. Configure test-mode keys locally:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=http://localhost:3001/cart?payment=success&session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=http://localhost:3001/cart?payment=cancelled
```

Webhook endpoint:

```text
/api/v1/payments/webhook
```

Do not commit Stripe keys. Use live-mode keys only in production secrets.

`USER_COOKIE_DOMAIN` allows the main website and role dashboards on sibling
subdomains to receive the same HttpOnly user session after authentication. It
should remain unset for localhost development.

Apply the Prisma migration before deploying the Firebase login flow.
Deploy migration `20260715180000_api_rate_limits` before starting this version;
login, account creation, token refresh, and public business-query abuse controls
use its shared database-backed counter.
Google and phone sign-in from the public website are Firebase Auth providers;
the backend validates Firebase ID tokens and then issues the app session cookies.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

<!-- BEGIN:autoparts-pro-codex-docs -->

## AutoParts Pro App Notes

### App Purpose

Admin dashboard and main backend/API surface for approvals, users, suppliers, garages, vehicles, catalog, public pages, RFQs, orders, marketplace, auth, Prisma, VIN lookup, and S3 uploads.

### Important Folders

- app/(dashboard)
- app/api, app/api/v1, app/api/v2
- `actions/`
- `services/`
- `lib/auth, lib/user-auth, lib/storage, lib/17vin.ts, lib/vin-search`
- `prisma/schema.prisma, prisma.config.ts`
- `types/`
- `skills/`

### Environment Variables

Detected or documented variables:

- `DATABASE_URL`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `USER_AUTH_ALLOWED_ORIGINS`
- `USER_JWT_ACCESS_SECRET`
- `USER_JWT_REFRESH_SECRET`
- `ADMIN_JWT_ACCESS_SECRET`
- `ADMIN_JWT_REFRESH_SECRET`
- `ADMIN_TOKEN_PEPPER`
- `ADMIN_BOOTSTRAP_TOKEN`
- `AWS_S3_BUCKET`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `VIN17_BASE_URL`
- `VIN_API_BASE_URL`
- `VIN17_USER`
- `VIN_API_USER`
- `VIN17_PASSWORD`
- `VIN_API_PASS`
- `GARAGE_EMAIL_VERIFICATION_WEBHOOK_URL`
- `GARAGE_SMS_OTP_WEBHOOK_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

### Run, Build, and Test Commands

Install:

```bash
npm install
```

Detected scripts:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

Runtime note: dev/start use Next.js defaults unless overridden.

### Connected Apps and Services

- All frontend apps through API routes
- Database through Prisma
- Firebase Admin/service-account auth
- S3-compatible storage for images/files
- 17VIN/VIN API integrations

### Common Checks Before Deployment

- Admin pages and API routes compile
- Prisma schema/API contract changes are coordinated with every frontend app
- Auth, S3, VIN, marketplace, RFQ, order, and supplier inventory flows are verified after changes
- Run lint/build for this app before deployment.
- Re-check affected API, auth, database, and env contracts in connected apps.

<!-- END:autoparts-pro-codex-docs -->
