import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Anthropic's vision guidance: images over ~1568px on the long edge are downscaled
// server-side anyway, and full-resolution photos can exceed the 5MB request limit.
const MAX_LONG_EDGE = 1568;

export async function prepareImageForUpload(uri: string, width?: number, height?: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  const w = width ?? 0;
  const h = height ?? 0;
  if (Math.max(w, h) > MAX_LONG_EDGE || (!w && !h)) {
    ctx.resize(w >= h ? { width: MAX_LONG_EDGE } : { height: MAX_LONG_EDGE });
  }
  const ref = await ctx.renderAsync();
  const result = await ref.saveAsync({ base64: true, compress: 0.7, format: SaveFormat.JPEG });
  if (!result.base64) throw new Error('No image data');
  return result.base64;
}
