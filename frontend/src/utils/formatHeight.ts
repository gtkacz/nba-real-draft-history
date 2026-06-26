// Formats a height in inches as feet-inches (e.g. 78 -> 6'6").
export function formatHeight(inches: number): string {
  const feet = Math.floor(inches / 12)
  const remainingInches = Math.round(inches % 12)
  return `${feet}'${remainingInches}"`
}
