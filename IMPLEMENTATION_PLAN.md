# v1.0.3 implementation plan

Baseline: latest workspace v1.0.2 RC; preserved at ../baseline. Do not reset/install/deploy.

1. Single shared field contract, bounded offline OOXML parser and branded Excel template.
2. Admin-only preview/commit with current database fingerprint, deterministic references, no deletions, conflict rejection and existing WAL.
3. Pending-account metadata within existing authentication_data; teacher refs, preview receipts and school profile within existing _STATE. No header/schema migration.
4. Separate activation capability with private single-use code issuance, hashed code/ticket storage, cooldown/expiry and mandatory permanent PIN; never create normal session for pending teacher.
5. Six-stage import wizard and setup readiness/explicit prepare actions; preserve CSV/history import and v1.0.2 workflows.
6. Synthetic regression/failure-injection/browser/XLSX tests; documented Google staging gate, controlled upgrade and rollback; no production changes.
