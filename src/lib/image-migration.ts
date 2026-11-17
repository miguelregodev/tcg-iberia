import { db } from './db';
import { downloadFromR2, uploadToR2, getR2PublicUrl, verifyR2ObjectAccessible } from './r2';
import { downloadFromSupabaseStorage, deleteFromSupabaseStorage } from './supabase-storage';
import { getAllImages, detectStorageProvider } from './media-library';

export interface MigrationLog {
  id: string;
  sourceProvider: 'supabase' | 'r2';
  sourceUrl: string;
  sourceKey: string;
  destProvider: 'supabase' | 'r2';
  destUrl: string;
  destKey: string;
  filename: string;
  fileSize: number;
  productCount: number;
  productsAffected: string[]; // product IDs
  status: 'pending' | 'in_progress' | 'success' | 'failed' | 'partial';
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

// In-memory migration logs (in production, you'd want to persist these to the database)
const migrationLogs: MigrationLog[] = [];

/**
 * Migrate a single image from Supabase to R2
 * Safe operation: source file is preserved, database updates are transactional
 */
export async function migrateImageToR2(imageUrl: string): Promise<{
  success: boolean;
  newUrl?: string;
  error?: string;
  productsUpdated?: number;
  log?: MigrationLog;
}> {
  const startTime = new Date();
  const migrationLog: MigrationLog = {
    id: `migration-${Date.now()}`,
    sourceProvider: 'supabase',
    sourceUrl: imageUrl,
    sourceKey: '', // Will be filled
    destProvider: 'r2',
    destUrl: '',
    destKey: '',
    filename: '',
    fileSize: 0,
    productCount: 0,
    productsAffected: [],
    status: 'in_progress',
    createdAt: startTime,
  };

  try {
    // Step 1: Detect storage provider
    const detection = detectStorageProvider(imageUrl);
    if (!detection) {
      throw new Error('Unable to detect image storage provider');
    }

    if (detection.provider !== 'supabase') {
      throw new Error('Image is not stored in Supabase Storage');
    }

    migrationLog.sourceKey = detection.key;

    // Step 2: Download from Supabase
    console.log(`[Migration] Downloading image from Supabase: ${detection.key}`);
    const buffer = await downloadFromSupabaseStorage(imageUrl);
    if (!buffer) {
      throw new Error('Failed to download image from Supabase');
    }

    migrationLog.fileSize = buffer.length;

    // Step 3: Extract filename and MIME type
    const filename = detection.key.split('/').pop() || 'image';
    migrationLog.filename = filename;

    // Guess MIME type from extension
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypeMap: Record<string, string> = {
      webp: 'image/webp',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      avif: 'image/avif',
      gif: 'image/gif',
    };
    const mimeType = mimeTypeMap[ext] || 'image/unknown';

    // Step 4: Find all products using this image
    console.log(`[Migration] Finding products using image: ${imageUrl}`);
    const affectedProducts = await db.product.findMany({
      where: { imageUrl: imageUrl },
      select: { id: true, name: true },
    });

    migrationLog.productCount = affectedProducts.length;
    migrationLog.productsAffected = affectedProducts.map((p) => p.id);

    // Step 5: Upload to R2 with unique key
    console.log(`[Migration] Uploading image to R2`);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const cleanFilename = filename.replace(/\.[^/.]+$/, '');
    const r2Key = `products/${cleanFilename}-${timestamp}-${random}.${ext}`;
    const r2Metadata = await uploadToR2(r2Key, buffer, mimeType);

    migrationLog.destUrl = r2Metadata.publicUrl;
    migrationLog.destKey = r2Key;

    console.log(`[Migration] Uploaded to R2: ${r2Metadata.publicUrl}`);

    // Step 6: Verify R2 object is accessible
    console.log(`[Migration] Verifying R2 object accessibility`);
    let verificationAttempts = 0;
    const maxAttempts = 5;
    let isAccessible = false;

    while (verificationAttempts < maxAttempts && !isAccessible) {
      isAccessible = await verifyR2ObjectAccessible(r2Metadata.publicUrl);
      if (!isAccessible) {
        verificationAttempts++;
        if (verificationAttempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * verificationAttempts));
        }
      }
    }

    if (!isAccessible) {
      throw new Error('R2 object is not accessible via public URL');
    }

    // Step 7: Update product URLs in database (transactional)
    console.log(`[Migration] Updating ${affectedProducts.length} product(s) in database`);
    const updateResult = await db.product.updateMany({
      where: { id: { in: affectedProducts.map((p) => p.id) } },
      data: { imageUrl: r2Metadata.publicUrl },
    });

    if (updateResult.count !== affectedProducts.length) {
      throw new Error(
        `Database update mismatch: expected ${affectedProducts.length}, updated ${updateResult.count}`
      );
    }

    migrationLog.status = 'success';
    migrationLog.completedAt = new Date();
    migrationLogs.push(migrationLog);

    console.log(`[Migration] Successfully migrated image to R2`);

    return {
      success: true,
      newUrl: r2Metadata.publicUrl,
      productsUpdated: affectedProducts.length,
      log: migrationLog,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    migrationLog.status = 'failed';
    migrationLog.errorMessage = errorMessage;
    migrationLog.completedAt = new Date();
    migrationLogs.push(migrationLog);

    console.error(`[Migration] Failed:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
      log: migrationLog,
    };
  }
}

/**
 * Migrate multiple images to R2
 * Processes with controlled concurrency
 */
export async function migrateBulkToR2(imageUrls: string[], concurrency: number = 3): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    url: string;
    success: boolean;
    newUrl?: string;
    error?: string;
  }>;
}> {
  const results: Array<{
    url: string;
    success: boolean;
    newUrl?: string;
    error?: string;
  }> = [];

  // Process in batches to control concurrency
  for (let i = 0; i < imageUrls.length; i += concurrency) {
    const batch = imageUrls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        const result = await migrateImageToR2(url);
        return {
          url,
          success: result.success,
          newUrl: result.newUrl,
          error: result.error,
        };
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          url: '',
          success: false,
          error: result.reason?.message || 'Unknown error',
        });
      }
    }
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    total: imageUrls.length,
    successful,
    failed,
    results,
  };
}

/**
 * Get migration history
 */
export function getMigrationHistory(limit: number = 50): MigrationLog[] {
  return migrationLogs.slice(-limit).reverse();
}

/**
 * Get migration statistics
 */
export function getMigrationStatistics(): {
  totalMigrations: number;
  successfulMigrations: number;
  failedMigrations: number;
  totalSize: number;
  totalProducts: number;
} {
  return {
    totalMigrations: migrationLogs.length,
    successfulMigrations: migrationLogs.filter((l) => l.status === 'success').length,
    failedMigrations: migrationLogs.filter((l) => l.status === 'failed').length,
    totalSize: migrationLogs.reduce((sum, l) => sum + l.fileSize, 0),
    totalProducts: migrationLogs.reduce((sum, l) => sum + l.productCount, 0),
  };
}

/**
 * Check if an image has already been migrated
 */
export async function checkMigrationStatus(imageUrl: string): Promise<{
  isMigrated: boolean;
  migratedUrl?: string;
}> {
  // Check migration logs
  const existingMigration = migrationLogs.find(
    (log) => log.sourceUrl === imageUrl && log.status === 'success'
  );

  if (existingMigration) {
    return {
      isMigrated: true,
      migratedUrl: existingMigration.destUrl,
    };
  }

  // Check if image is currently in R2
  const detection = detectStorageProvider(imageUrl);
  if (detection?.provider === 'r2') {
    return {
      isMigrated: true,
      migratedUrl: imageUrl,
    };
  }

  return {
    isMigrated: false,
  };
}
