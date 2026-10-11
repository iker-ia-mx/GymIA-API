# SEC-07 · Progress photo upload authorization

Status: **audit branch / test-first**, not production-ready.

## Verified current behavior

`POST /progress-photos/upload-url` creates a signed Supabase Storage upload URL for a server-generated path. `POST /progress-photos` currently accepts any path prefixed with the authenticated user's ID and inserts a Prisma `ProgressPhoto` record without verifying an issued upload intent or that the object exists.

## Tests

Run locally with dependencies installed:

```bash
npm test -- src/body-composition/body-composition.security.spec.ts
```

The third test is **intentionally expected to fail** against the current service. Do not treat this branch as passing CI.

## Required implementation before merge

1. Add a Prisma `ProgressPhotoUploadIntent` model, migration and relation to `User`. Track user ID, unique storage path, expected MIME type, creation/expiration, and single-use completion.
2. Persist the intent before issuing the signed URL; ensure failure cleanup for abandoned intents.
3. During finalization, enforce owner, unexpired intent, expected path and exact Storage object existence; validate size and image signature (not extension alone).
4. Atomically consume the intent and create `ProgressPhoto`, preventing double-finalization and handling retries.
5. Ensure private bucket `progress-photos` exists in the intended Supabase project; validate bucket access policy, limits and backend credentials.
6. Add two-user integration tests and cover deletion, storage errors, expiry, races, and orphan cleanup.

## Deployment gate

The connected Supabase project had no buckets at audit time. Do not deploy photo endpoints or apply migration until the intended environment is confirmed, migrations are reviewed, and automated tests pass.

This branch changes only a test file and this audit note. No production changes.
