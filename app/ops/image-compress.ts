/**
 * Shrinks a large photo / screenshot before upload. The /api/ops proxy runs on Vercel,
 * whose request body limit is ~4.5 MB, so a comment with several screenshots must stay well under it.
 * GIFs are left alone (re-encoding drops the animation); anything that fails to decode is sent as-is.
 */
const MAX_SIDE = 2000;
const SKIP_BELOW = 600 * 1024;

export async function compressImage(file: File): Promise<File> {
    if (file.type === 'image/gif' || file.size <= SKIP_BELOW) return file;
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
        if (!blob || blob.size >= file.size) return file;
        const name = file.name.replace(/\.[^.]+$/, '') || 'image';
        return new File([blob], `${name}.webp`, { type: 'image/webp' });
    } catch {
        return file;
    }
}
