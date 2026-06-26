// Centralized filter bounds and defaults.
// Previously these literals were duplicated across useDraftData, useFilterUrlSync,
// and DraftTable, which let them drift apart (bug B4).

export const YEAR_MIN = 1947
// Derived at load time rather than hardcoded so that newly-added draft years are
// never silently excluded by the default range, and so the "active filter"
// detection keeps matching the default (bug B4).
export const YEAR_MAX = new Date().getFullYear()

export const PICK_MIN = 1
export const PICK_MAX = 61

export const AGE_MIN = 17
export const AGE_MAX = 50

export const HEIGHT_MIN = 60
export const HEIGHT_MAX = 96

export const WEIGHT_MIN = 140
export const WEIGHT_MAX = 403

export const YOS_MIN = 0
export const YOS_MAX = 30

export const DEFAULT_ITEMS_PER_PAGE = 30
export const MOBILE_ITEMS_PER_PAGE = 20
