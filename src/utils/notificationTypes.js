export const NOTIFICATION_TYPE_META = {
  INVITE: { icon: '📩', color: 'text-blue-600', bg: 'bg-blue-50' },
  REMINDER: { icon: '⏰', color: 'text-orange-600', bg: 'bg-orange-50' },
  CANCELLATION: { icon: '❌', color: 'text-red-600', bg: 'bg-red-50' },
  RESCHEDULE: { icon: '🔄', color: 'text-purple-600', bg: 'bg-purple-50' },
  NOTE_ADDED: { icon: '📝', color: 'text-slate-600', bg: 'bg-slate-100' },
  RESCHEDULE_REQUEST: { icon: '❓', color: 'text-amber-600', bg: 'bg-amber-50' },
}

export function getNotificationMeta(type) {
  return NOTIFICATION_TYPE_META[type] ?? { icon: '🔔', color: 'text-slate-600', bg: 'bg-slate-100' }
}
