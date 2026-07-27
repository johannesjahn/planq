const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
})

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

export function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date)
}

const DIVISIONS = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" }
] as const

/** "3 days ago" / "in 2 hours", picking the largest unit that still reads naturally. */
export function formatRelative(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  let duration = (date.getTime() - Date.now()) / 1000
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return relative.format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }
  return "—"
}

/** Compact "1h 58m" / "45s" countdown used for the session timer. */
export function formatCountdown(milliseconds: number): string {
  if (milliseconds <= 0) return "expired"

  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function initials(username: string): string {
  const parts = username.split(/[_\-.\s]+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase()
  return username.slice(0, 2).toUpperCase()
}
