# Data flow and guarantees

## Identity and source provenance

Random UUIDs identify sessions/captures/reviews. Owner comes only from bearer authentication. Captures retain URL, title, UTC timestamp, type, bounded actual text, optional parent capture, importance tag, and actually observed overview references. The browsing trail is chronological and separate from conceptual relationships. Child tabs are included when Chrome exposes an opener belonging to the active session; other tabs need Include current tab. Opener relationships express browsing continuity, not semantic relevance.

The worker remembers the last capture per tab; captures carry its ID as context. This is a best-effort chronological link, not an assertion that one source verifies another. Full URLs are stored; do not use sensitive/private pages in a judge profile. Text from form/editable fields is excluded before Readability parsing and selection capture. Automatic extraction is partial by design, not access-control bypass. No raw DOM or screenshots are retained.

Google query extraction uses a small explicit supported-host allowlist. Overview parsing requires an explicitly labeled visible region; many Google variants will not match. In that case use explicit selection; searches and articles continue working. The DOM observer only schedules Google extraction, debounces mutations, and a low-frequency URL check handles History API navigation. Article clones are parsed once per successful URL, excluding inputs, editable regions, scripts, forms and navigation.

## Bounds

- 12,000 characters per capture, 20 observed outbound references.
- 300 captures/session; 100 sessions/owner; 2,000 review attempts/session.
- GetSession returns at most 12 pending captures, with offset or explicit evidence IDs. Agent instructions cap one run at 24 captures.
- Analysis: 40 concepts, 70 edges, 40 study items; tool POST body limit 750 KB.
- Extension storage.local has a browser quota shared by sessions and retry data. New capture storage is conservatively capped below the browser quota with a visible warning and toolbar badge. This prototype should be used for short sessions; export/delete old sessions. It is not an unlimited local archive. A full storage device/quota can prevent a capture from being saved; do not treat a page load as capture success.

## Retry and concurrency

Every queue item is persisted before attempted transmission. A single worker chain serializes mutations; a one-minute Chrome alarm retries, and user actions trigger sync. The queue survives worker suspension. Restart does not depend on a permanent timer or the in-memory chain. HTTP timeouts leave failed items queued. Session creation, capture and review retries use stable IDs. Capture dedup uses type + URL + text + tag hash, preserving identical text from different URLs. An ID cannot be reused with different content. Local dedup uses the same key fields.

The analysis uses optimistic versioning. The complete payload and all graph/evidence/quiz references are validated before mutation. A transaction updates the map, processed capture IDs, analysis timestamp and preference snapshot. Older writes fail with 409. Only explicitly processed IDs are marked; later arrivals remain pending. Existing reviewed activities keep their attempt records, including the old analysis version. Old concept order is retained for stable layout. Content quality and preserving meaningful IDs remain Go's responsibility; structural validation does not prove a claim is true.

A stale review fails rather than grading a changed activity. It remains visible as a sync error; export local data before deleting or troubleshooting a blocked queue. Failed permanent requests stop the queue so data is not silently discarded. This can require user intervention; it is a prototype limitation.

## Deletion and export

Export downloads the selected local session as JSON, including sources, analysis, and study attempts. Sync first for the latest backend analysis. Delete removes the local session, clears pending mutations for it, removes tab associations, and queues a server DELETE. If offline, this deletion is retried; remote data remains until sync succeeds. Refresh skips locally pending deletes, preventing resurrection. A capture targeting a deleted server session is rejected. Host backups may retain historical data until their retention expires. Tokens are never included in session exports.

There is no export import feature or automated backup restore UI. Personal tokens and SQLite files are ignored by Git. Operational console logs contain event names, counts, status, and versions, never source text or bearer tokens. These logs follow the host's retention rather than a separate durable processing-audit database.
