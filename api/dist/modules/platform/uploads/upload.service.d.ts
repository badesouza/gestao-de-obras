import type { MultipartFile } from '@fastify/multipart';
/** Returns absolute uploads directory for coat of arms images */
export declare function getCoatOfArmsUploadDir(): string;
/** Saves uploaded coat of arms file and returns public URL path */
export declare function saveCoatOfArmsUpload(file: MultipartFile): Promise<string>;
/** Normalizes coat of arms input — data URLs are persisted as uploaded files */
export declare function persistCoatOfArmsUrl(url: string | null | undefined): Promise<string | null>;
//# sourceMappingURL=upload.service.d.ts.map