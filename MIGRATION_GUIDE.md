# Metadata-only compatibility and rollout

SCHEMA_ is byte-for-byte structurally equal to the v1.0.2 baseline:12 core tables plus _STATE/_OPS. No sheet/header migration and no installer are required. Ordinary existing accounts are not marked pending or rehashed during upgrade/import.

Additive metadata is created only by normal authorized operations:

| Location | New metadata / meaning |
|---|---|
| USERS.authentication_data | For newly imported teachers only: existing algorithm/iterations/salt/digest plus must_change=true. After code issuance, activation holds digest/expiry/generation. Successful activation removes temporary fields and increments auth_version. |
| _STATE school-teacher:<ref hash> | Stable teacher_ref → existing/internal user_id. Year rollover can reconstruct refs by code+alias matching if operational state was not copied. |
| _STATE school-profile:<year> | School/year, headmistress, grading/template labels; derived SCHOOL_NAME/HEADMISTRESS_NAME properties are reconciled only after committed profile exists. |
| _STATE school-intent:<exam_id> | Requested DRAFT/PREPARE/OPEN intent; never bypasses readiness or opens exam by import. |
| _STATE school-preview:<id> | Actor, document hash, setup snapshot fingerprint,15-minute expiry. No whole workbook or activation secret. Consumed after commit. |
| _STATE school-last-import:<year> | Actor/time/hash and compact verified counts. |
| _STATE activation-ticket:<ticket hash> | User/version/generation/target/expiry; consumed on success, otherwise invalid after expiry/version change. Raw ticket not stored. |
| _STATE rate:activate:<target>, activation-global | Cooldown/rate metadata, no private activation code. |

Text formats are applied before all identifier/code writes and new-year copies, including student IDs such as000001. Existing values with lost zeros are not silently guessed or padded. School import rejects corrupt/duplicate master IDs for manual reconciliation.

Existing Apps Script project/database/URL/scopes/pepper remain unchanged. Source updates can be rolled back without header migration, but pending accounts MUST be suspended before returning to v1.0.2 because old code cannot enforce must_change. Follow ROLLBACK_GUIDE; do not delete metadata or disable validation to bypass the safeguard. No migration or rollback procedure has been executed against production.

Identifier/date consistency checks also cover native Sheets Date/UTC equivalence, archive text formats and leading-zero journal request/actor IDs. These are storage/comparison safeguards, not a change to examination dates or grade policy.
