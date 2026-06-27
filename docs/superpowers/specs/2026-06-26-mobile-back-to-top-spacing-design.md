# Mobile Back-to-Top Button Spacing Design

## Goal

Increase the mobile back-to-top button's distance from the viewport edges while preserving its size, icon alignment, behavior, and desktop layout.

## Design

In the mobile media query for `.back-to-top-btn`, replace the fixed 16px bottom and right offsets with a 24px base inset plus the corresponding CSS safe-area inset:

```scss
bottom: calc(24px + env(safe-area-inset-bottom));
right: calc(24px + env(safe-area-inset-right));
```

This creates more balanced spacing on ordinary mobile screens and avoids collisions with device safe areas. The existing 56px mobile minimum dimensions and all desktop styles remain unchanged.

## Verification

- Run the frontend's existing validation commands.
- Confirm the mobile rule uses the new bottom and right calculations.
- Confirm desktop offsets and button dimensions are unchanged.
