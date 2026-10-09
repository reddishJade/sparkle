export function downloadText(name: string, type: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function csvField(value: unknown): string {
  const text = String(value ?? '')
  return /[,"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
