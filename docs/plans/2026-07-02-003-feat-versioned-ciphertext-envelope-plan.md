---
title: "Versioned Ciphertext Envelope for Key Rotation and AES-GCM Path - Plan"
type: feat
date: 2026-07-02
topic: versioned-ciphertext-envelope
execution: code
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
---

# Versioned Ciphertext Envelope for Key Rotation and AES-GCM Path - Plan

## Goal Capsule

Objective: add a leading version segment to the stored ciphertext envelope and a small current+previous keyring, so `decrypt()` selects key and algorithm by version — unlocking `ENCRYPTION_KEY` rotation, ending the NULL-on-decrypt clobber of still-recoverable data, and reserving a path to authenticated AES-GCM, all backward-compatible with existing unprefixed ciphertext.

Product authority: idea I6 in `docs/ideation/2026-07-01-full-project-review-ideation.html:326`.

Open blockers: none. Two config-shape questions (version-tag delimiter, keyring env layout) are captured under Outstanding Questions and should be resolved before planning.

## Product Contract

### Summary

Every value the current `encrypt()` writes is a bare `base64(iv_hex:ciphertext_hex)` blob with no key or algorithm tag, so the system has exactly one usable key and no safe rotation story. Wrap new writes in a versioned envelope (`v1:base64(iv:ct)`), keep decrypting unprefixed values as legacy forever, and route decryption through a keyring keyed by version. This is a security-critical change to the shared encryption path used by member PII and donation records, so backward-compatible round-trips and a key-rotation scenario must be proven by tests.

### Problem Frame

The stored format carries no discriminator: `encrypt()` returns `Buffer.from(iv_hex:ciphertext_hex).toString('base64')` (`src/utils/encryptionHelper.js:49`) and `decrypt()` assumes exactly that shape, splitting the decoded string on `:` and using `parts[0]`/`parts[1]` (`src/utils/encryptionHelper.js:66`). There is no version or algorithm field, so a changed `ENCRYPTION_KEY` makes prior ciphertext undecryptable with no fallback.

That gap causes a concrete data-loss path. Member fields decrypt through a failure-tolerant `safeDecrypt` that returns null on any error (`src/services/MemberDirectoryService.js:159`). The owner edit view maps those results with `safeDecrypt(...) || ''` (`src/services/MemberDirectoryService.js:234`), so after a key change the form loads blank; the shared upsert then re-encrypts the blank value, and `encrypt('')` returns null, NULLing the `*_encrypted` column (`src/services/MemberDirectoryService.js:266`). Ciphertext that was still recoverable under the old key is destroyed by an ordinary re-save. A keyring that retains the previous key removes the failure at its root: the value decrypts, the form populates, and the save re-encrypts under the current version instead of clobbering.

### Key Decisions

- Version lives in the outer envelope as a leading `<tag>:` prefix; the inner `base64(...)` payload is unchanged for the first version, so the change is additive.
- A `vN:` prefix is an unambiguous discriminator because base64 never contains `:`; any value without a recognized prefix is legacy.
- The legacy read path is permanent, not a migration with a deadline.
- Re-encryption is lazy: existing callers already call `encrypt()` on every write, so post-rotation writes adopt the new version automatically — no batch job.
- The version registry maps version → (key, algorithm), reserving a future AES-256-GCM version without touching legacy or v1 reads. AES-GCM itself is not built here.
- `encrypt()`/`decrypt()` keep their `(string) -> string|null` signatures, so `MemberDirectoryService` and `DonationService` need no changes.

### Requirements

**Envelope format**

R1. `encrypt()` produces a versioned envelope of the form `<version-tag>:<base64(payload)>`, where the version tag identifies both the key and the cipher algorithm used.

R2. The version tag is drawn from a fixed, documented registry mapping each version to one key and one algorithm; the initial version (e.g. `v1`) maps to the current `ENCRYPTION_KEY` and AES-256-CBC, reproducing today's behavior.

R3. The inner payload layout is defined per version; the initial version keeps the existing `iv_hex:ciphertext_hex` layout so v1 encoding is byte-compatible with today's output apart from the added prefix.

**Backward-compatible decryption**

R4. `decrypt()` treats any value lacking a recognized `<version-tag>:` prefix as legacy and decrypts it via the current AES-256-CBC + `sha256(ENCRYPTION_KEY)` path exactly as today.

R5. `decrypt()` routes a prefixed value by its version tag to the matching key and algorithm from the keyring; a syntactically-versioned value whose tag is not in the keyring raises a decryption error rather than falling back or mis-decrypting.

R6. The legacy unprefixed read path is retained indefinitely with no forced-migration cutoff.

R7. Every value produced by the pre-change `encrypt()` still decrypts to the identical plaintext after the change.

**Keyring and rotation**

R8. Keys are held in a small keyring containing one current key plus zero or more previous keys, each addressable by version tag.

R9. `encrypt()` always uses the single designated current version; `decrypt()` may resolve to any version present in the keyring.

R10. Rotating `ENCRYPTION_KEY` means adding a new current version while retaining prior version(s) in the keyring, so pre-rotation ciphertext stays decryptable and new writes use the new key.

R11. The keyring is configured from environment/config without per-rotation code edits, and a deployment that sets only `ENCRYPTION_KEY` (no additional keyring config) behaves as today with that key as the current version.

**Data-loss fix (lazy)**

R12. Because a retained previous key keeps rotated-out ciphertext decryptable, a subsequent save re-encrypts the field under the current version rather than replacing the stored column with NULL; no caller write flow changes to achieve this.

**Non-functional constraints**

R13. `encrypt()`/`decrypt()` retain their existing `(string) -> string|null` signatures and null-handling, requiring no changes to `MemberDirectoryService` or `DonationService`.

R14. The implementation uses only the Node standard-library `crypto` module — no new dependency, bundler, or framework.

**Test coverage (security-critical)**

R15. Tests prove legacy round-trip: a value in the pre-change unprefixed format decrypts to its original plaintext.

R16. Tests prove versioned round-trip: `encrypt()` output carries the current version prefix and `decrypt()` recovers the plaintext.

R17. Tests prove a key-rotation scenario: a value encrypted under the previous version still decrypts after the current version is rotated to a new key with the previous key retained, and a fresh `encrypt()` emits the new current version.

R18. Tests assert that a value with an unrecognized version tag throws, and that a corrupted payload still throws (preserving the existing corrupted-data guarantee).

### Acceptance Examples

AE1. Given a ciphertext string produced by the old `encrypt()` (no `vN:` prefix), when `decrypt()` runs, then it returns the original plaintext. Covers R4, R6, R7.

AE2. Given a plaintext encrypted by the new `encrypt()`, when the result is inspected, then it begins with the current version tag and `decrypt()` returns the original plaintext. Covers R1, R9, R16.

AE3. Given a value encrypted under version v1, when the keyring is reconfigured so v2 is current (new key) with v1 retained and the value is decrypted, then it still returns the original plaintext; and a new `encrypt()` call emits a `v2:` envelope. Covers R5, R8, R10, R12, R17.

AE4. Given a value with a syntactically valid but unknown version tag, when `decrypt()` runs, then it throws a decryption error and never returns a partially-decoded or wrong plaintext. Covers R5, R18.

### Success Criteria

- The existing suites `__tests__/security/encryptionHelper.test.js`, `__tests__/services/MemberDirectoryService.test.js`, and `__tests__/services/DonationService.test.js` pass unchanged.
- The preflight `ENCRYPTION_KEY` checks in `src/config/preflight.js` remain green for a single-key deployment.
- Global coverage stays at or above the 60% threshold.

### Scope Boundaries

- Implementing AES-256-GCM: the registry reserves an algorithm-per-version slot, but no GCM version is built here.
- Any batch or offline re-encryption of existing rows — re-encryption is lazy only.
- A caller-side guard that prevents NULL-clobbering when decrypt fails for a genuinely unrecoverable value (key truly lost, not merely rotated) — this keyring change fixes the recoverable-value case only.
- Database schema or column-type changes.
- Key-management infrastructure beyond environment/config (no KMS/HSM/secrets-manager integration).
- Performing an actual production key rotation (operational, not code).

### Dependencies / Assumptions

- All currently stored ciphertext is in the legacy unprefixed format.
- Base64 payloads never contain `:`, making a leading `vN:` an unambiguous legacy-vs-versioned discriminator (base64 alphabet excludes `:`).
- `ENCRYPTION_KEY` continues to back the initial/current version; `sha256(ENCRYPTION_KEY)` key derivation for v1 matches today so legacy and v1 share a key.
- Test conventions from `__tests__/security/encryptionHelper.test.js` hold: set `ENCRYPTION_KEY` and clear the `require` cache before loading the helper.
- No consumer stores or matches on ciphertext bytes (encrypted columns are never used in WHERE/ORDER), so a longer prefixed value is safe for callers.

### Outstanding Questions

Resolve Before Planning:
- Exact version-tag syntax and delimiter (`v1:` colon vs. another separator) and how the current version is selected (an explicit pointer such as `ENCRYPTION_KEY_VERSION` vs. highest-numbered key present).
- Keyring configuration shape: additional `ENCRYPTION_KEY_V<n>` variables vs. a single JSON key map, and whether `validateKey()`/preflight should length-validate every keyring entry.

Deferred to Planning:
- Whether to add the caller-side NULL-clobber guard for genuinely unrecoverable values in the `MemberDirectoryService` edit/save path.
- The concrete AES-256-GCM payload layout (e.g. `iv:tag:ct`) for the eventual authenticated version.

### Sources / Research

- `docs/ideation/2026-07-01-full-project-review-ideation.html:326` — idea I6 (versioned envelope, keyring, three unlocked moves); basis note at `:349`, downsides at `:351`.
- `src/utils/encryptionHelper.js:8` — key/algorithm from env; `:9` AES-256-CBC; `:49` `encrypt()` returns `base64(iv_hex:ct_hex)` with no version tag; `:57`–`:80` `decrypt()` splits decoded string on `:` and assumes that shape, throwing `Decryption failed` on error.
- `src/services/MemberDirectoryService.js:16` — imports encrypt/decrypt; `:159` `safeDecrypt` returns null on failure; `:234` edit view maps `safeDecrypt(...) || ''`; `:266`–`:290` upsert re-encrypts blank → `encrypt('')` returns null → NULLs the `*_encrypted` column (the clobber).
- `src/services/DonationService.js:13` — imports encrypt/decrypt; `:47` `safeDecrypt`; `:66` encrypts amount/donor email; `:103`, `:134`, `:185`, `:237` decrypt on read/aggregate.
- `src/config/preflight.js:41`–`:80` — `ENCRYPTION_KEY` must be set, non-placeholder, ≥32 chars (mirrors `validateKey()`).
- `__tests__/security/encryptionHelper.test.js:1`–`115` — existing round-trip/IV/corrupted-data coverage; `:87`–`99` two key-validation tests are inert placeholders (module reads key at load time).
