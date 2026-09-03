# Runtime Canonicalization Design

## Current

runtime adapters dynamically replace methods on the legacy core module.

## Target

Introduce an explicit runtime owner.

Responsibilities:

- stable runtime owns approved output lookup
- legacy generation remains fallback only
- runtime contracts prevent hidden mutation paths

## Constraints

Changes must be isolated to runtime wiring.

No changes to product generation rules.
