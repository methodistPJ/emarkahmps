# Performance engineering evidence

## Conditions and limits

18 October2026; local macOS Node/V8 with in-memory Google-service doubles, no network latency. Synthetic267 pupils,10 classes,14 subjects/class and140 subject assignments to stress repeated class reads; it is not a measurement of school production data.40 samples per ordinary benchmark,30 per burst, after3 warmups. Timings are actual monotonic local wall durations. Raw observations summarized in tests/artifacts/performance-before.json and performance-after.json; the scripts are supplied for reproduction with the original ZIP extracted separately.

Two maxima are very large: baseline20-request burst593884.68ms and candidate10-request burst305378.08ms. They occurred during the local run; cause was not established (host scheduling/suspension is possible). They are **retained**, not erased. Therefore these maxima are not meaningful cloud SLA evidence; rerun on an uninterrupted controlled host before accepting timing targets. Transfer counts remain deterministic under the doubles. No baseline or candidate cloud latency is available.

| Local operation | N | Before median / P95 / max ms | After median / P95 / max ms | getValues calls | cells transferred |
|---|---:|---:|---:|---:|---:|
| dashboard_140_assignments | 40 | 69.26 / 70.35 / 80.65 | 13.16 / 13.77 / 14.25 | 150 → 21 | 786,108 → 57,213 |
| 14_subject_class_reads | 40 | 6.88 / 6.95 / 7.07 | 1.08 / 1.11 / 1.21 | 16 → 4 | 79,402 → 5,707 |
| replay_miss_10000 | 40 | 2.88 / 3.08 / 3.32 | 0.21 / 0.25 / 0.63 | 1 → 0 | 70,000 → 0 |
| replay_miss_50000 | 40 | 14.91 / 15.65 / 17.73 | 1.04 / 1.20 / 2.37 | 1 → 0 | 350,000 → 0 |
| queued_5_requests | 30 | 346.41 / 359.07 / 371.45 | 58.11 / 62.37 / 63.08 | 750 → 105 | 3,930,540 → 286,065 |
| queued_10_requests | 30 | 691.94 / 704.82 / 708.32 | 114.81 / 121.93 / 305378.08 | 1500 → 210 | 7,861,080 → 572,130 |
| queued_20_requests | 30 | 1390.42 / 2276.06 / 593884.68 | 231.27 / 278.66 / 285.25 | 3000 → 420 | 15,722,160 → 1,144,260 |

TextFinder scans the request column on the Sheets server; zero getValues cells on a miss does **not** mean zero server work or zero API calls. The mock's TextFinder also scans in memory. Cache hints store row coordinates only and every hit is reread and validated against actor/request/state/payload fingerprint. The full receipts and recovery pointer are retained.

Dashboard serialized response:451,993 →108,658 bytes (approximately76% smaller); cells786,108 →57,213 (approximately93% fewer). It returns identical task statistics for this fixture, while avoiding repeating the full subject_snapshot in every task.14 subject lookups share one validated class block instead of rereading14 blocks. Repeated append positions no longer reread/reduce the full table. These are measured/structural reductions, not an assumed number of seconds saved in Google.

## Decisions

The critical optimization is fewer service transfers, consistent with [Google's batching guidance](https://developers.google.com/apps-script/guides/support/best-practices). Master/config caching stays request-local. Marks, permissions and exam status are never shared-cache authoritative data. Ordinary read snapshots retain the exclusive lock because WAL applies rows in multiple batches; removing the lock would expose partial commits. PDF blob transfer alone moves outside it and rechecks session/current revision under lock before response.

Login now fetches dashboard once after authentication. Analytics selector uses sessionContext without mark statistics. Admin entry fetches adminData only; dashboard/jobs are lazy on monitoring. The admin monitoring requests still serialize in the backend; Promise.all is not a claim of server parallelism. Audit/master/analytics tables still have full-read costs documented in KNOWN_LIMITATIONS.

Diagnostics opt-in reports action/duration, core Sheets read/write counts/cells/time, transaction time, response size, lock wait/hold and result code, without credentials or payloads. It is a useful field tool, not exhaustive Drive/Docs/trigger timing telemetry. PDF progress uses checkpoint cursor; no invented percentages. Worker heartbeat uses Script Properties rather than idle journal writes.

## Concurrency and targets

Separate concurrency.test.cjs dispatches5/10/20 synthetic authorized actors: disjoint writes and same-ID retries succeed once; competing stale writes accept one and reject4/9/19 respectively. JavaScript/service doubles serialize execution; live lock wait/fairness/timeouts remain unmeasured. The burst benchmarks above are queued read workloads, not true parallel writers.

Visible response<100ms, cached navigation<200ms, modules1–3s, login2–5s, marks2–4s, save1–3s and analytics2–5s remain engineering targets. They have not been established in Google. Browser mock RPC20ms and deliberate300ms post-render fade cannot establish these targets. No production error/retry rates or actual PDF generation durations were collected.

Reproduction: use MPS_SOURCE=/absolute/path/to/extracted-baseline MPS_BASELINE=1 node tests/performance.cjs for baseline, and MPS_SOURCE=/absolute/path/to/package/src node tests/performance.cjs for candidate. Baseline-only public-function audit bypass applies solely in that benchmark harness, never application code. Preserve separate outputs and record host/Node versions, dataset, load and any timing outliers.
