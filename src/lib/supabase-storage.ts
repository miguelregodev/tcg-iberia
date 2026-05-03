import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initializer for Supabase admin client to provide clearer errors when env vars are missing
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let _supabaseAdmin: SupabaseClient | null = null;
export function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must be set in server environment.');
  }

  _supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return _supabaseAdmin;
}

// Storage bucket name for product images
const BUCKET_NAME = 'product-images';

/**
 * Upload product image to Supabase Storage
 * @param buffer - File buffer
 * @param fileName - Original file name
 * @returns Public URL of the uploaded image
 */
export async function uploadToSupabaseStorage(
  buffer: Buffer | ArrayBuffer,
  fileName: string
): Promise<string> {
  try {
    // Normalize to Uint8Array for supabase upload
    let fileData: Uint8Array;
    if (Buffer.isBuffer(buffer)) {
      fileData = new Uint8Array(buffer);
    } else if (buffer instanceof ArrayBuffer) {
      fileData = new Uint8Array(buffer);
    } else {
      // Fallback: convert via Buffer
      fileData = new Uint8Array(Buffer.from(String(buffer)));
    }

    // Generate unique filename with timestamp
    const fileExtension = fileName.split('.').pop();
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const filePath = `products/${uniqueName}`;

    // Upload file to Supabase Storage
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileData, {
        contentType: `image/${fileExtension}`,
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Storage upload error:', error);
    throw error instanceof Error ? error : new Error('Unknown upload error');
  }
}

/**
 * Delete product image from Supabase Storage
 * @param imageUrl - Full public URL of the image
 */
export async function deleteFromSupabaseStorage(imageUrl: string): Promise<void> {
  try {
    // Extract file path from URL
    const supabaseAdmin = getSupabaseAdmin();

    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    // URL pathname like: /storage/v1/object/public/product-images/products/xxx
    const storageIndex = pathParts.indexOf('object');
    const filePath = storageIndex !== -1 ? pathParts.slice(storageIndex + 3).join('/') : pathParts.slice(3).join('/');

    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('Supabase delete error:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }
  } catch (error) {
    console.error('Storage delete error:', error);
    throw error;
  }
}

/**
 * Initialize Supabase storage bucket for product images
 * Call this once during setup
 */
export async function initializeStorageBucket(): Promise<void> {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();

    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }

    // Check if bucket already exists
    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

    if (!bucketExists) {
      const { error: createError } = await supabaseAdmin.storage.createBucket(
        BUCKET_NAME,
        {
          public: true,
          fileSizeLimit: 5242880, // 5MB
        }
      );

      if (createError) {
        console.error('Error creating bucket:', createError);
      } else {
        console.log(`✅ Created storage bucket: ${BUCKET_NAME}`);
      }
    } else {
      console.log(`✅ Storage bucket already exists: ${BUCKET_NAME}`);
    }
  } catch (error) {
    console.error('Storage initialization error:', error);
  }
}
