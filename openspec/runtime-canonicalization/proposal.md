# Runtime Canonicalization Proposal

## Problem

Current runtime initialization uses adapter-style installation:

legacy core module
→ install wrappers
→ stable runtime patches selected methods

This creates ownership ambiguity and makes future changes harder to verify.

## Goal

Move runtime ownership to a canonical runtime entry while preserving existing business output.

Target:

canonical runtime entry
→ stable runtime
→ legacy fallback only

## Non-goals

- No product rule changes
- No IP output changes
- No UI changes
- No database migration
- No new features

## Acceptance Criteria

- Final runtime owner is explicit
- No runtime layer mutates final IP/nickname/bio outputs outside approved owners
- Existing API behavior remains unchanged
