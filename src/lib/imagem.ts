/** Reduz a imagem para no máximo `max` px no maior lado e converte para WebP (fotos de celular costumam ter vários MB). */
export async function redimensionarImagem(arquivo: File, max = 1200, qualidade = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo)
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * escala)
  const h = Math.round(bitmap.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a imagem.')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', qualidade))
  // Safari antigo não gera WebP: usa JPEG
  if (blob && blob.type === 'image/webp') return blob
  const jpeg = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', qualidade))
  if (!jpeg) throw new Error('Não foi possível processar a imagem.')
  return jpeg
}
