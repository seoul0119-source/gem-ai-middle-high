# Membership approval rollout

This change keeps the existing Apps Script deployment and spreadsheet. New paid-plan registrations are saved as `pending`; pre-existing rows with an empty approval column remain approved. T and F memberships do not require donation approval. Owner-only management issues new F IDs without exposing free issuance to the public registration API.

The approval email recipient remains the existing office address, `gemissions@gmail.com`. The email links to the current Apps Script deployment with `action=member-admin&id=<member ID>`. The web management page requires the signed-in Google user to match the script owner. GET only displays data; every mutation requires an owner-bound, single-use, 30-minute CSRF token. Email forwarding does not grant administrative access.

Approve only after checking the actual deposit. Initial approval resets start and expiry once, using the established Korean anniversary calculation. Repeated approval cannot extend the period. Block requires confirmation; restoring keeps the existing expiry. The representative ID cannot be blocked from this page.

For the ten previously issued complimentary memberships, search each exact ID and select the free-use speaking restriction. This preserves its ID and expiry. The owner must identify those ten records; do not infer free status from a name, a one-month plan, or a donation pledge.

New logins carry signed policy metadata. Protected Korean classroom/API requests and new cross-classroom pass verification recheck current approval via the original Sheet session. Old signed cookies/tickets remain compatible until their fixed expiry (maximum 12 hours); already-open external classrooms retain their existing authorization lifetime. Do not claim instantaneous revocation across all external Sites.

Speaking rejects T and F IDs before provider calls, checks the verified speaking permission for legacy IDs, and freshly revalidates at every ten-minute segment. A currently running segment may continue until its existing ten-minute deadline.

New approval mail is sent through the student script's MailApp. A quota failure leaves a pending mail marker; a started but uncertain send is marked `review`, never retried automatically. All pending memberships remain visible to the owner. No existing registrations are emailed in bulk. Google may require the owner to approve the additional send-mail permission before activating this release.

Release order: verify tests; deploy the compatible Vercel authentication changes and hub changes; update the existing Apps Script deployment without changing its URL; verify owner management and anonymous denial. All new registration/approval tests use local fixtures, not fake production students or donors.
