# Reset Column Widths Design

## Goal

Let desktop table users restore resized columns to their default widths without changing their chosen column order or visibility.

## Current Behavior

Column order, visibility, and widths are stored together in local storage through `useColumnPreferences`. The Columns menu has one reset action that restores all three settings at once.

## Design

Extend `useColumnPreferences` with:

- `resetWidths()`, which replaces only the current widths with the configured defaults.
- `hasCustomWidths`, a computed value that is true when any current column width differs from its configured default.

Keep the existing full-layout reset unchanged. Add a labeled **Reset widths** action to the Columns menu. Disable the action when all widths already match their defaults. Activating it updates the table immediately and lets the existing preference watcher persist the restored widths.

The width-only action preserves column order and visibility. It applies to all columns, including currently hidden columns, so showing one later does not restore an obsolete custom width.

## Error Handling

No new error path is required. Persistence continues to use the composable's existing handling for unavailable or invalid local storage.

## Testing

Add composable tests covering:

- default widths report no customization;
- resizing a column reports customized widths;
- resetting widths restores every configured default;
- resetting widths preserves order and visibility;
- the restored state is persisted by the existing watcher.

Add a focused component assertion if the current test setup can mount `DraftTable` without broad fixture work; otherwise, type checking and the composable coverage provide the behavioral verification for the thin menu binding.

## Scope

This change does not alter resize mechanics, default widths, mobile cards, column ordering, visibility defaults, or the existing full-layout reset.
