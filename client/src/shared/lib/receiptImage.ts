import imageCompression from "browser-image-compression";

const READABLE_SHORT_SIDE_PX = 1200;
const DEFAULT_LONG_SIDE_PX = 1600;
const MAX_LONG_SIDE_PX = 4096;
const MAX_UPLOAD_SIZE_MB = 2;

export function receiptLongSideLimit(width: number, height: number): number {
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  if (shortSide <= 0) return DEFAULT_LONG_SIDE_PX;

  const scaleKeepingShortSideReadable = Math.min(1, READABLE_SHORT_SIDE_PX / shortSide);
  const longSideKeepingShortSideReadable = Math.ceil(longSide * scaleKeepingShortSideReadable);
  return Math.min(longSide, MAX_LONG_SIDE_PX, Math.max(DEFAULT_LONG_SIDE_PX, longSideKeepingShortSideReadable));
}

async function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

export async function prepareReceiptImage(file: File): Promise<File> {
  const size = await readImageSize(file);
  const maxWidthOrHeight = size ? receiptLongSideLimit(size.width, size.height) : DEFAULT_LONG_SIDE_PX;
  try {
    return await imageCompression(file, {
      maxSizeMB: MAX_UPLOAD_SIZE_MB,
      maxWidthOrHeight,
      useWebWorker: true,
    });
  } catch {
    return file;
  }
}
