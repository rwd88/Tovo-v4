export function getTimeRemainingText(eventTime: Date): string {
  const now = new Date()
  const end = new Date(eventTime)
  const diffMs = end.getTime() - now.getTime()

  if (diffMs <= 0) return '⏳ Closed'

  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const days = Math.floor(diffMinutes / (60 * 24))
  const hours = Math.floor((diffMinutes % (60 * 24)) / 60)
  const minutes = diffMinutes % 60

  if (days > 0) return `⏳ Ends in ${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`
  if (hours > 0) return `⏳ Ends in ${hours} hour${hours > 1 ? 's' : ''} ${minutes} min`
  return `⏳ Ends in ${minutes} min`
}
