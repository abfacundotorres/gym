/** ¿Se pueden compartir archivos con el menú del sistema (Android: WhatsApp, Drive, correo)? */
export function canShareFiles(): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['x'], 'x.txt', { type: 'text/plain' })] })
  } catch {
    return false
  }
}

/**
 * Comparte un archivo de texto por el menú del sistema. Algunos navegadores no aceptan application/json
 * como archivo compartible: en ese caso se manda como texto plano con la misma extensión.
 */
export async function shareTextFile(filename: string, text: string, mime: string): Promise<'shared' | 'cancelled' | 'failed'> {
  try {
    const tries = [mime, 'text/plain']
    for (const type of tries) {
      const file = new File([text], filename, { type })
      if (!navigator.canShare?.({ files: [file] })) continue
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    }
    return 'failed'
  } catch (e) {
    return e instanceof DOMException && e.name === 'AbortError' ? 'cancelled' : 'failed'
  }
}

/** Descarga un archivo generado localmente (sin red). */
export function downloadText(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
