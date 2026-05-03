// Deprecated shim for AWS S3 — replaced by Supabase Storage
// Kept for compatibility in case any module still imports from src/lib/s3
// Internally redirects to Supabase Storage implementation.

import { uploadToSupabaseStorage, deleteFromSupabaseStorage } from './supabase-storage';

export async function uploadToS3(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
  // Redirect to Supabase Storage
  return uploadToSupabaseStorage(buffer, fileName);
}

export async function deleteFromS3(imageUrl: string): Promise<void> {
  return deleteFromSupabaseStorage(imageUrl);
}
