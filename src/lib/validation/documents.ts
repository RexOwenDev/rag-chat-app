import { z } from 'zod';
import { config } from '@/lib/config';

const MAX_FILE_SIZE_BYTES = config.upload.maxFileSizeMb * 1024 * 1024;

/**
 * Schema for file-based document upload (multipart/form-data).
 * File type + size validation; the actual File object is validated separately
 * from the MIME type because FormData File objects are not plain serialisable values.
 */
export const fileUploadSchema = z.object({
  title: z
    .string()
    .min(1, 'Document title is required')
    .max(255, 'Title must be 255 characters or fewer')
    .trim(),
});

/** Validates a File's extension + size constraints */
export function validateUploadedFile(file: File): void {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (!config.upload.allowedExtensions.includes(extension as never)) {
    throw new Error(
      `File type ".${extension}" is not supported. Allowed: ${config.upload.allowedExtensions.join(', ')}.`
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${config.upload.maxFileSizeMb} MB.`
    );
  }

  if (file.size === 0) {
    throw new Error('File is empty.');
  }
}

/**
 * Schema for URL-based document import.
 */
export const urlImportSchema = z.object({
  url: z
    .string()
    .url('Please enter a valid URL')
    .max(2048, 'URL must be 2048 characters or fewer')
    .refine(
      (val) => val.startsWith('http://') || val.startsWith('https://'),
      'Only HTTP and HTTPS URLs are supported'
    ),
  title: z
    .string()
    .max(255, 'Title must be 255 characters or fewer')
    .trim()
    .optional(),
});

export type UrlImportInput = z.infer<typeof urlImportSchema>;
