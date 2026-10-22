# Rollback and recovery

No rollback was executed. Preserve the existing deployment URL and data. Prefer fixing forward after investigation when a transaction has committed. Take private source/data/property backups before any operator action.

## Interrupted import

Do not clear _OPS or RECOVERY_ROW. locked_ replays a PREPARED transaction before returning data. Retry the same commit request ID from the same page when the response is unknown. If committed, replay returns the stored compact result without repeating writes. After refresh or lost page memory, inspect readiness/audit and validate the same workbook again; matching records are skipped. If pending recovery is corrupt, halt writes, preserve backup/journal and investigate on copies. Do not sort/delete table rows or rewrite headers.

A rollback of source is not a rollback of school records. Missing workbook rows never mean deletion; this release does not provide a destructive undo-import button. Restore a spreadsheet backup only under separately approved reconciliation after accounting for any marks/results written since it was taken.

## Before reverting to v1.0.2 — mandatory pending-account safeguard

The old version ignores authentication_data.must_change. Active pending users still carry a common temporary verifier and would be unsafe under old auth code. While v1.0.3 HEAD is still installed:

1. Pause new user writes/onboarding and background jobs in a controlled window; capture all state/backups. Review current execution and WAL recovery first.
2. In the project-owner Apps Script editor, review and explicitly run private `suspendPendingOnboarding_()` only as the approved rollback operation. It sets active=FALSE for pending users, increments auth_version and audits a count in a normal WAL transaction. It never resets established PINs or deletes records. The agent has not run it.
3. Verify every account with must_change=true is inactive and previous capabilities/sessions are revoked. Do not reactivate those accounts in v1.0.2. Activated users already have compatible permanent verifiers and can remain active.
4. Re-select the previous immutable version in Manage deployments. Restore matching project HEAD from the verified v1.0.2 RC backup with an explicit reviewed clasp push; triggers otherwise continue on new HEAD. Keep URL/execute-as/audience intact. Do not run an installer.
5. If using an older source than this workspace's v1.0.2 RC, retain its private-installer security correction. Do not reintroduce a public initializer as a shortcut.

Keep pending accounts suspended until v1.0.3 is restored or individually provisioned with an approved unique permanent credential through an authorized flow. On rolling forward, use the normal admin account controls to reactivate reviewed pending users, then issue fresh private codes; do not mass-reactivate blindly.

## Metadata/properties

No headers/tables need dropping. Old code ignores new _STATE keys and authentication_data metadata. Existing marks, snapshots, sessions/version history and audit remain. Names changed by school-profile commit remain Script Properties; restore the previous two presentation-name properties from backup only if intended. Secrets/infrastructure were not changed. When returning to v1.0.3, _STATE profile is the committed authority and will resynchronize those two names; review that state before changing properties manually.

Source rollback cannot undo already delivered activation codes; suspension/version changes invalidate them safely. Never include private backups or secret metadata in public tickets/logs. Validate the runbook using synthetic pending/activated accounts in staging before any school-wide rollout.
