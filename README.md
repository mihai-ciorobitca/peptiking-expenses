# Peptiking

A mobile-first spending tracker for small teams. Team members can record cash, card, online, and phone-wallet spending; choose who paid; and attach a receipt photo or payment screenshot. Admins can add members and manage currency and proof requirements.

## Run locally

```bash
npm install
npm run dev
```

Without Supabase environment values, the interface runs in a clearly marked demo mode.

## Install on a phone

Open the deployed app over HTTPS. On Android, tap **Install app** when offered, or choose **Install app / Add to Home screen** from the browser menu. On iPhone, open it in Safari and choose **Share → Add to Home Screen → Add**. The app opens from its home-screen icon in a standalone window, with the same login and team data. Installation is available from the login page as well as the tracker.

## Connect Supabase

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor. It creates the team tables and a private `expense-proofs` storage bucket.
3. Copy `.env.example` to `.env.local` and fill in the project URL and service-role key.
4. Restart the app. The admin signs in with `SITE_PASSWORD`, then creates members and assigns each person an individual password in Admin.

Peptiking supports Euro and Vietnamese đồng. Existing unsupported currency settings automatically switch to Euro; [`supabase/migrations/20260804_eur_vnd_only.sql`](supabase/migrations/20260804_eur_vnd_only.sql) can be run once to enforce the same rule directly in Supabase.

To let an admin enable one or both currencies, run [`supabase/migrations/20260804_multiple_currencies.sql`](supabase/migrations/20260804_multiple_currencies.sql) once in the Supabase SQL editor for an existing project.

## Password protection

Set `SITE_PASSWORD` in the production environment as the private admin password and session-signing secret. Members sign in with the individual passwords assigned in Admin. Access is remembered for seven days in a secure, HttpOnly cookie. Changing `SITE_PASSWORD` invalidates existing sessions after redeployment.

Existing databases must run [`supabase/migrations/20260804_member_passwords.sql`](supabase/migrations/20260804_member_passwords.sql) once, then the admin can set passwords for existing members.

The default admin email is `admin@peptikingmedia.com`. `PEPTIKING_ADMIN_EMAIL` and `PEPTIKING_ADMIN_NAME` can override that identity when needed.

## Median app updates

Set `NEXT_PUBLIC_APP_VERSION` to the version embedded in each Median release, for example `1.0.1`, and redeploy the website. In Admin, set **Latest app version** to the same release number after publishing it in Median. Older app builds will then show a **Get update** button. Existing Supabase projects must run [`supabase/migrations/20260804_app_updates.sql`](supabase/migrations/20260804_app_updates.sql) once.

The service-role key is used only in server route handlers and is never sent to the browser. Production access is designed for a private OpenAI Site, which supplies the signed-in user's verified email to the app server.

## Main routes

- `/` — responsive overview, expense activity, add-expense flow, and admin dashboard
- `/api/bootstrap` — current team, member, settings, and expense data
- `/api/expenses` — validated expense and private proof upload
- `/api/admin/members` — admin-only member creation and password management
- `/api/admin/settings` — admin-only platform settings
