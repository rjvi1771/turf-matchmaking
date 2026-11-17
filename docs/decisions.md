# Decisions log

Project: turf-matchmaking (MERN + TypeScript)
Owner: Vijay
Created: 2026-11-16
Last updated: 2026-11-16

## How to use this file

- One entry per decision. Never delete an entry. If a decision changes, add a new entry that supersedes the old one and mark the old one `Superseded by D-0xx`.
- Status values: `Decided` (I chose it), `Open` (still to choose), `Superseded`.
- The "Why" columns are starter drafts. Rewrite each one in your own words. In an interview, the why is what gets asked.
- Update this file in the same commit as the code that changes a decision.
- Never put secrets, connection strings, passwords or IP addresses in this file.

## Decisions made before coding

| ID | Decision | Status | Why (draft, rewrite in your words) |
| --- | --- | --- | --- |
| D-001 | Domain: sports turf booking with open matches and split payment | Decided | Covers the gaps Project 1 left (auth, MongoDB, real-time, roles, user-owned CRUD) and has real concurrency problems to solve and test. |
| D-002 | Stack: MongoDB, Express, React, Node, TypeScript in all packages | Decided | Matches Project 1's TypeScript standard and the MERN roles I am applying for. |
| D-003 | Delivery: 3 phases over 8 weeks. Phase 1 (auth, roles, turfs, bookings) deployed by week 4. Phase 3 (split payment) can be cut. | Decided | I am applying for jobs now, so a deployed Phase 1 must exist early. |
| D-004 | Database host: MongoDB Atlas free tier (M0), Mumbai region, cluster name `turf-matchmaking` | Decided | Free, closest region to me, enough for a portfolio app. |
| D-005 | Database access: one app user with `readWrite` on `turf_matchmaking` only. IP access list limited to my own IPs. No `0.0.0.0/0` unless Render's published IP ranges cannot be used, and then it is documented in the README. | Decided | Limits the damage if the connection string leaks. |
| D-006 | Repository: one monorepo with npm workspaces `client`, `server`, `shared` | Decided | One place for the API contract (Zod schemas and types in `shared`), one repo to review and deploy. |

## Technical decisions (confirmed 2026-11-16 as recommended in the blueprint)

| ID | Decision | Status | Why (draft, rewrite in your words) |
| --- | --- | --- | --- |
| D-007 | Available slots are computed from turf hours minus confirmed bookings. Empty slots are not stored. | Decided | Avoids thousands of empty documents and a sync problem. Trade-off: slightly more work on read. |
| D-008 | Double-booking is prevented by a unique partial index on `(turfId, date, slotStart)` where `status` is `confirmed`. The service inserts and handles the duplicate-key error. It never checks first and inserts second. | Decided | The database enforces the rule, so a bug in service code cannot break it. Check-then-insert is a race condition. |
| D-009 | Joining a match is one atomic `findOneAndUpdate` that matches only if status is `open`, the user is not already in, and the count is below `capacity`. | Decided | Two people grabbing the last spot cannot both succeed. |
| D-010 | Money is stored as integer paise, never floats. | Decided | Avoids rounding errors in split payments. |
| D-011 | Dates are stored as an IST calendar string (`YYYY-MM-DD`) plus slot start (`HH:mm`). | Decided | Avoids the timezone bugs from Project 1. |
| D-012 | Match participants are embedded in the match document (max 30). | Decided | A match is always read with its roster. Needs an index on `participants.userId` for "my matches". |
| D-013 | Sockets only broadcast. Every write goes through REST. | Decided | One set of authorization rules to secure and test. |
| D-014 | Payments sit behind an adapter. The gateway is simulated and labelled as simulated in the README. | Decided | Teaches the state machine and idempotency without weeks of gateway work. |
| D-015 | Unpaid payment holds expire through a `holdExpiresAt` timestamp checked on read and write, plus a sweep job. A MongoDB TTL index is not used on payments. | Decided | A TTL index deletes the whole document and runs only about once a minute. (Corrects the earlier TTL suggestion.) |
| D-016 | Request validation uses Zod schemas defined once in `shared` and used by both client and server. | Decided | The API contract is written once. |

## Product and platform decisions (confirmed 2026-11-16, recommended option chosen)

### D-017 Unfilled match payment rule

- Decision: each player pays within a 15-minute window. Unpaid spots are released.
- Rejected: host pays upfront and is reimbursed.
- Why: reuses the expiry mechanism from D-015 and avoids chasing friends for money. (Rewrite in your words.)
- Status: Decided

### D-018 Auth cookies across Vercel and Render

- Decision: a Vercel rewrite proxies `/api` to Render so cookies are same-origin. Sockets use a short-lived token from the API.
- Rejected: cross-site cookies with `SameSite=None; Secure`.
- Why: Safari blocks third-party cookies, so the rejected option can break the demo for iPhone viewers. (Rewrite in your words.)
- Revisit when: the first deploy. Test login on Safari or an iPhone, and confirm the socket connection still works through the token.
- Status: Decided

### D-019 Cancellation rule

- Decision: a booking can be cancelled free until 2 hours before the slot starts.
- Rejected: free until the slot starts.
- Why: keeps the cancel logic testable. (Rewrite in your words.)
- Status: Decided

### D-020 Slot length

- Decision: fixed 60 minutes for the MVP.
- Rejected: set per turf.
- Why: simplest overlap logic. (Rewrite in your words.)
- Status: Decided

### D-021 Token lifetimes

- Decision: access token 15 minutes, refresh token 7 days, rotated on use.
- Why: short-lived access limits the damage of a stolen token, and rotation lets the server detect reuse. (Rewrite in your words.)
- Status: Decided

### D-022 App name and domain

- Decision: not made yet. The repo name stays `turf-matchmaking`.
- Needed before: README v1 and the resume line.
- Status: Open

### D-023

-Node 24 (Active LTS) for local, CI and deploy; .nvmrc 24, engines >=24.
- Why: Node 20 is end-of-life, and I test on the version I ship..
- Status: Decided

### D-024 
- Decision: ESLint 9 and TypeScript 5.9 for now, not ESLint 10 or TypeScript 7.
- Why: A major toolchain jump mid-project risks breaking tooling. The audit is clean, so waiting has no security cost. Revisit after Phase 1..
- Status: Decided

## Change log

| Date | Change |
| --- | --- |
| 2026-11-16 | File created. D-015 corrects the earlier TTL-index suggestion for payment holds. |
| 2026-11-16 | D-007 to D-021 confirmed as recommended. D-022 (app name) still open. |