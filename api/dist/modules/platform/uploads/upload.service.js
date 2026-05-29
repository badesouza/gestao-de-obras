import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../../shared/errors.js';
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);
const EXTENSION_BY_MIME = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
};
const MAX_FILE_SIZE = 2 * 1024 * 1024;
/** Returns absolute uploads directory for coat of arms images */
export function getCoatOfArmsUploadDir() {
    return path.join(process.cwd(), 'uploads', 'coats-of-arms');
}
/** Writes image buffer to coat of arms storage */
async function writeCoatOfArmsFile(buffer, mimeType) {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Formato inválido. Use JPG, PNG, WEBP ou GIF.');
    }
    if (buffer.byteLength > MAX_FILE_SIZE) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Imagem deve ter no máximo 2 MB');
    }
    const extension = EXTENSION_BY_MIME[mimeType] ?? '.png';
    const filename = `${randomUUID()}${extension}`;
    const uploadDir = getCoatOfArmsUploadDir();
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);
    return `/uploads/coats-of-arms/${filename}`;
}
/** Saves uploaded coat of arms file and returns public URL path */
export async function saveCoatOfArmsUpload(file) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Formato inválido. Use JPG, PNG, WEBP ou GIF.');
    }
    const buffer = await file.toBuffer();
    return writeCoatOfArmsFile(buffer, file.mimetype);
}
/** Saves base64 data URL as coat of arms file */
async function saveCoatOfArmsFromDataUrl(dataUrl) {
    const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([\s\S]+)$/i.exec(dataUrl.trim());
    if (!match) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Formato de imagem inválido');
    }
    const mimeType = match[1].toLowerCase();
    const base64 = match[2].replace(/\s/g, '');
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.byteLength) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Imagem inválida ou vazia');
    }
    return writeCoatOfArmsFile(buffer, mimeType);
}
/** Normalizes coat of arms input — data URLs are persisted as uploaded files */
export async function persistCoatOfArmsUrl(url) {
    if (!url?.trim())
        return null;
    const value = url.trim();
    if (value.startsWith('data:')) {
        return saveCoatOfArmsFromDataUrl(value);
    }
    if (value.startsWith('/uploads/coats-of-arms/')) {
        return value;
    }
    try {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('invalid protocol');
        }
        return parsed.toString();
    }
    catch {
        throw new AppError(400, 'VALIDATION_ERROR', 'URL do brasão inválida');
    }
}
//# sourceMappingURL=upload.service.js.map