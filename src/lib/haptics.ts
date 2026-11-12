/** Vibración corta como confirmación al tocar. Donde no hay soporte (iOS), no hace nada. */
export function haptic(kind: 'tap' | 'record') {
  try {
    navigator.vibrate?.(kind === 'record' ? [25, 70, 45] : 12)
  } catch { /* sin vibración */ }
}
