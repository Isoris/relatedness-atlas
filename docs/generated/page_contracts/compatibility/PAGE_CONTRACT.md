# compatibility — breeding-partner finder — Page Capability Contract

**Atlas**: relatedness · **Stage**: hub · **Status**: active (round 1)

## Purpose

Breeding-partner finder. Pick a focal individual + target karyotype +
scope; the page lists compatible partners with sex-aware and exclude-kin
filters.

## Architecture

Reads `inversion_karyotypes`, `family_hub_roster`, `res_pairwise` (for
the exclude-kin filter). Compute endpoint
`relatedness_compatibility_search` (sync, browser fallback
[`compatibility.js::runCompatibilitySearch`](../../../../atlases/relatedness/pages/hub/compatibility.js)).

## Capabilities

- Focal individual picker.
- Target-karyotype selector.
- Scope selector (full cohort / family-pruned / specific hub).
- Sex-aware filter.
- Exclude-kin filter (parameterised by `res_pairwise` edges).

## Required data

- **Registry says (round 1)**: `requires_layers: []`
- **Actually consumed**: `inversion_karyotypes`, `family_hub_roster`,
  `res_pairwise`

## User interactions

- Focal + target + scope selectors.
- "Find partners" button.

## Outputs

Partner-candidate list.

## Connected analyses / adapters

- **IN adapters**: three layers above.
- **Server compute**:
  `relatedness_compatibility_search` (browser fallback documented).

## Status and known issues

- **Sex column** required on `family_hub_roster` for sex-aware filter.
  Page degrades gracefully (no sex filter) when absent.

## Documents

- **Per-page README**: [pages/hub/README.md](../../../../atlases/relatedness/pages/hub/README.md)

**Confidence**: high
