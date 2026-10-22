# v1.0.3 performance and capacity evidence

No live Google timings were collected. Existing v1.0.2 request-local caches, class-block reuse, TextFinder receipts, consistent locks, lazy admin monitoring and small selector endpoint remain. Historical before/after evidence is retained in docs/v1.0.2/PERFORMANCE_REPORT.md; it must not be read as a new Google v1.0.3 benchmark.

- One complete import uses one compact preview-write request, one authorized detail-read, one confirmed commit and fresh readiness/admin data reads. XLSX decompression/parsing and temporary PBKDF2 run locally in browser; no external parser service or per-row RPC registration loop.
- Whole setup is staged and committed through existing WAL batch writes. Preview details are deliberately not stored as a potentially oversized journal response. Master snapshot reads are request-cached; actual users/assignments/history are revalidated under the lock.
- Synthetic large case:2000 students,60 classes,20 teachers and780 subject assignments, successful PREPARED crash recovery/replay. One observed local elapsed duration was 1108.80ms including20 real PBKDF2 computations. It is not a distribution, latency target or cloud capacity guarantee.
-20 vs300 teacher provisioning cost is browser-dependent; credential preparation reports actual count. No false progress percentage or timeout-as-failure assumption is used. Preview expiry15 minutes and8MB/40MB file limits are explicit.
- Workspace HTML increased from 91,569 to 398,803 bytes because it bundles the offline parser/vendor and exact downloadable XLSX. This avoids external code/template hosting and parser calls, at a first-load payload cost for all users. HTTP compression/real-device load time is unmeasured. Future lazy asset delivery would need its own tests; it is not claimed here.
- Readiness uses current school tables; full-master reads, _STATE growth, global lock throughput and Google quotas remain constraints. No speculative shared cache of permissions or active marks was added.

Use staging diagnostics to collect30+ observations/action and real lock wait/hold, Sheets calls, request bytes, errors/retries, iframe rendering and job times before school-wide adoption. Do not infer production readiness from a single local large-dataset run.
