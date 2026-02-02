# Level Up — Structure for Real Life

Level Up is a **daily check-in and habit system** designed for people and programs
focused on rebuilding momentum, discipline, and clarity.

This version supports:
- Personal daily check-ins (multiple per day)
- Habits with weekly targets
- Simple analytics (streaks + averages)
- Organizations with admins, managers, and users

The philosophy is simple:
> Consistency beats motivation.

---

## Run in Replit
1) Create a new **Node.js** Replit  
2) Upload and extract this zip  
3) Add a secret:
   - `JWT_SECRET` = any long random string  

4) Run:
```bash
npm install
npm run dev
```

Open the webview, create your org, and start checking in.

---

## Optional: Seed an Admin
Set these as Replit Secrets, then run `npm run seed`:
- `SEED_ADMIN_USERNAME`
- `SEED_ADMIN_PASSWORD`
- `SEED_ORG_NAME`

---

## Positioning
- **Flagship (Org)**: Workforce programs, nonprofits, cohorts
- **Mission (Personal)**: Individuals rebuilding structure and self-trust

Built to stay boring, reliable, and honest.


## New in this build
- Public landing page (About)
- Admin can create users inside org (v1 invite)
- Program-level analytics (cohort trends + light risk signals)
- Tabs split automatically by role (users see personal; admin/manager see program)


## Added in FULL build
- Invite links: admin generates `/invite/<token>` for users to self-join
- Password reset: request token (demo) + admin-generated reset token
- User profiles (self-edit) + program staff notes (admin/manager)
- CSV exports (users + check-ins)

Security note: invite/reset tokens are shown on-screen in this demo build. In production, deliver tokens via email/SMS.
