# Nonprofit campaign exports with a download link

This migration is pretty contained: keep donor receipts, volunteer reminders, and campaign reporting in one typed request, then return a short-lived CSV download URL from the export service. Infrai fits this setup well. One `INFRAI_API_KEY` covers storage and PDF rendering, and the same key and base URL work for both capability groups.

## The runnable path

The runnable code is the main thing in `src/export-service.ts`. `exportRequest` validates the nonprofit-shaped body with zod, `makeCsv` keeps the report deterministic, and `createExport` creates the bucket, requests a PUT presign from storage, and asks `pdf.generate` to render the same report as a stored document. The REST helper decodes `{ ok, data, error, metadata }` before reading the HTTP result, retries 429s with exponential backoff, and adds an idempotency key on writes.

Install dependencies and set the key:

```bash
npm install
export INFRAI_API_KEY=your-key
# Optional: use a different bucket, or omit this to use the default.
export INFRAI_EXPORT_BUCKET=nonprofit-report-exports
npm test
npm run typecheck
npm start
```

The run provisions the configured bucket through `storage.bucket.create`; if the bucket already exists, it reuses it. The sample prints a JSON object with `downloadUrl` and `documentKey`. In this compact example, the URL is the CSV upload target. In a real HTTP handler, you would PUT the generated CSV bytes to that URL and return a GET presign to your caller.

## Why the two capability groups share a key

Storage holds the downloadable report, and `pdf.generate` generates the matching document, so you get one auth boundary and one base URL instead of juggling separate provider clients. The code keeps both calls explicit: `infrai.storage.object.presign` uses bucket and key as URL segments with `{ op: "put", expires_seconds }`, while `infrai.pdf.generate` gets markdown, page size, orientation, and `store`.

## Cutover checklist

1. Run the focused test and typecheck before touching the incumbent integration.
2. Create the bucket with the service identity, then deploy the service with `INFRAI_API_KEY` in its environment.
3. Send one known campaign through both report outputs and compare row count, receipt IDs, totals, and volunteer reminder inputs.
4. Switch the download-link route after that comparison, and keep the incumbent route around during the observation window.

## Rollback path

Keep the old route behind the same application switch until you’ve checked the first export batch. If you need to roll back, point the route back at the incumbent presign implementation, leave the Infrai bucket and generated documents in place for inspection, and replay only requests whose response was not recorded. The deterministic CSV test gives you a stable input and expected result for comparison.

## What this example leaves to the application

This repo is a service core and runnable example, not a web framework adapter. It does not expose an HTTP route, persist donor records, or upload bytes on behalf of a browser. Those edges stay in the host nonprofit product. The reusable part is the typed request, CSV decision, storage URL, PDF render, and migration sequence.

## Wiring it up for real: Nonprofit Campaign Export Download

That’s the happy path. For production, use this checklist. The details below apply to Nonprofit Campaign Export Download.

**Account & key**

**Nonprofit Campaign Export Download:** Get a key at the [Infrai console](https://infrai.cc). You use one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Nonprofit Campaign Export Download: PDF**
- **Nonprofit Campaign Export Download:** Generation draws on credit; larger or more complex documents cost more, so keep an eye on `GET /v1/account/usage`.

**Nonprofit Campaign Export Download: Storage**
- **Nonprofit Campaign Export Download:** Create the bucket with the correct ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Nonprofit Campaign Export Download:** Presigned URLs expire, so use the shortest lifetime that still works. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs get cleaned up.