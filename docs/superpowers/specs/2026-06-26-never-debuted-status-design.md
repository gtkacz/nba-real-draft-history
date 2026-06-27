# Never-Debuted Player Status

## Goal

Represent drafted players with no NBA identity or playing data as "Never debuted in the NBA" instead of incorrectly treating null data as retirement.

## Classification

A draft pick is `never-debuted` when all three conditions hold:

- `nba_id` is null or missing.
- `played_until_year` is null or missing.
- `plays_for` is null, missing, or blank.

The rule deliberately ignores draft year and whether the pre-draft team was international. Records that do not satisfy the complete rule continue through the normal active, retired, or unknown classification.

Status precedence is:

1. `never-debuted`
2. `unknown` when `played_until_year` is absent but some NBA data exists
3. `retired` when `played_until_year` precedes the current season
4. `active` otherwise

## Frontend Design

Create a focused player-status utility that owns classification and related predicates. Desktop table, mobile card, player detail card, and retirement filtering will consume this shared rule instead of implementing separate null-sensitive comparisons.

The `DraftPick` type will reflect the published JSON by allowing nullable enrichment fields.

For `never-debuted`, status displays will use a registered `mdi-account-clock` icon and the text or tooltip "Never debuted in the NBA." Existing active, rookie, retired, and unknown treatments remain unchanged.

Retirement filters will not classify `never-debuted` or `unknown` records as retired or active.

## Data Flow

No generated JSON or backend schema changes are required. The frontend derives the status from the existing `nba_id`, `played_until_year`, and `plays_for` fields when data is loaded and whenever a component or filter needs the status.

## Testing

Unit tests will cover:

- all enrichment fields absent produces `never-debuted`;
- an NBA ID or current-team value prevents `never-debuted` classification;
- a missing playing-through year with partial NBA data produces `unknown`;
- playing-through years produce active or retired status relative to the current season;
- null values never coerce to a retirement year;
- retirement filtering excludes never-debuted records from both active and retired results.

Component checks will verify that all player-status surfaces use the shared classification and display the dedicated icon and wording.
