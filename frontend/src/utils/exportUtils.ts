export const exportUtils = {
  downloadBlob: (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    a.remove()
  },

  openInNewTab: (blob: Blob) => {
    const url = window.URL.createObjectURL(blob)
    window.open(url, '_blank')
  },

  printHtml: (html: string) => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.print()
    }
  },
}