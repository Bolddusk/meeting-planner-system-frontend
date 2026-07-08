export const NOTE_TYPE_VARIANT = {
  MINUTES: 'info',
  DECISION: 'primary',
  ACTION_ITEM: 'warning',
  PERSONAL: 'default',
}

export const OFFICIAL_NOTE_TYPES = ['MINUTES', 'DECISION']

export const ALL_NOTE_TYPES = ['MINUTES', 'DECISION', 'ACTION_ITEM', 'PERSONAL']

export function isOfficialNoteType(noteType) {
  return ['MINUTES', 'DECISION', 'ACTION_ITEM'].includes(noteType)
}
