# GEM Student Manager

`Code.gs` is the complete source deployed as Apps Script version 19 on 2026-09-27 (KST).
Use only Code.gs; do not append a second copy of its functions. The existing Code_backup.gs contains only an empty myFunction and is unchanged.

The existing spreadsheet and deployment URL are preserved. Existing columns and lesson logs remain in place; five named membership columns are appended. All functions except doGet/doPost end with an underscore to block google.script.run access to internal helpers and owner issuance.

Public plans: trial (T, 24 hours), month1 (M, 100,000 KRW), month2 (N, 150,000 KRW), month3 (P, 200,000 KRW), lifetime (L, custom pledge). Monthly expiry is midnight after the anniversary date in Asia/Seoul, clamped to the last day of the target month. Representative D is owner-issued only. Existing R registration remains unchanged; legacy T/F expiry is derived from its recorded creation date.

Registration uses a script lock and an idempotent request key. Repeating the same pledged membership request returns the original ID. A changed name, grade, plan or amount with the same key is rejected. No payment confirmation is implied by a pledge.

Login and lesson start both enforce expiry. Vercel validates the returned metadata, signs it in the session and clamps session and classroom-ticket expiration. The mission board clamps its own session to the same expiration.

Verify with `node --test tests/membership.test.mjs tests/student-registration.test.mjs tests/session-security.test.mjs`.
