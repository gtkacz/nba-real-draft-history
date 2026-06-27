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

// Membership filters that can each be flipped between "include" (regular) and
// "exclude" (negation) mode. A single map keeps the flags together so the URL
// carries one `exclude` param and the plumbing stays in one place rather than
// six parallel booleans.
export type ExcludableFilterKey =
  | 'team'
  | 'onceOwnedBy'
  | 'playsFor'
  | 'nationalities'
  | 'preDraftTeam'
  | 'draftCountries'

export const EXCLUDABLE_FILTER_KEYS: readonly ExcludableFilterKey[] = [
  'team',
  'onceOwnedBy',
  'playsFor',
  'nationalities',
  'preDraftTeam',
  'draftCountries',
]

export type ExcludeModes = Record<ExcludableFilterKey, boolean>

export function createDefaultExcludeModes(): ExcludeModes {
  return {
    team: false,
    onceOwnedBy: false,
    playsFor: false,
    nationalities: false,
    preDraftTeam: false,
    draftCountries: false,
  }
}

// "Once Owned By" can match a team anywhere in a pick's trade chain ('any') or
// only as the chain's original owner ('first'). 'first' is the default.
export type OnceOwnedByScope = 'first' | 'any'

export const DEFAULT_ONCE_OWNED_BY_SCOPE: OnceOwnedByScope = 'first'
