import { db } from './db';
import {
  listSupabaseStorageObjects,
  extractSupabaseKeyFromUrl,
  deleteFromSupabaseStorage,
  uploadToSupabaseStorage,
} from './supabase-storage';
import {
  listR2Objects,
  extractR2KeyFromUrl,
  uploadToR2,
  deleteFromR2,
  getR2PublicUrl,
  downloadFromR2,
  r2ObjectExists,
  verifyR2ObjectAccessible,
} from './r2';

export type StorageProvider = 'supabase' | 'r2';

export interface MediaLibraryImage {
  id: string; // Unique identifier (provider:key)
  provider: StorageProvider;
  bucket: string;
  key: string;
  filename: string;
  publicUrl: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  width?: number;
  height?: number;
  assignedProducts: AssignedProduct[];
  migrationStatus: MigrationStatus;
}

export interface AssignedProduct {
  productId: string;
  productName: string;
  productSlug: string;
}

export type MigrationStatus = 'not_applicable' | 'not_started' | 'migrated' | 'failed';

/**
 * Determine storage provider and extract key from image URL
 */
export function detectStorageProvider(
  imageUrl: string
): { provider: StorageProvider; key: string } | null {
  // Try R2 first
  const r2Key = extractR2KeyFromUrl(imageUrl);
  if (r2Key) {
    return { provider: 'r2', key: r2Key };
  }

  // Try Supabase
  const supabaseKey = extractSupabaseKeyFromUrl(imageUrl);
  if (supabaseKey) {
    return { provider: 'supabase', key: supabaseKey };
  }

  return null;
}

/**
 * Get all images from both Supabase and R2
 */
export async function getAllImages(
  filter?: {
    provider?: StorageProvider;
    search?: string;
    assignedOnly?: boolean;
    unassignedOnly?: boolean;
  }
): Promise<MediaLibraryImage[]> {
  try {
    const images: MediaLibraryImage[] = [];

    // Fetch from Supabase
    if (!filter?.provider || filter.provider === 'supabase') {
      const supabaseResult = await listSupabaseStorageObjects('products');
      const supabaseImages = supabaseResult.objects.map((obj) => ({
        id: `supabase:${obj.key}`,
        provider: 'supabase' as const,
        bucket: 'product-images',
        key: obj.key,
        filename: obj.filename,
        publicUrl: obj.publicUrl,
        mimeType: obj.mimeType || 'image/unknown',
        size: obj.size,
        createdAt: obj.createdAt,
        assignedProducts: [] as AssignedProduct[],
        migrationStatus: 'not_started' as const,
      }));
      images.push(...supabaseImages);
    }

    // Fetch from R2
    if (!filter?.provider || filter.provider === 'r2') {
      const r2Result = await listR2Objects('products');
      const r2Images = r2Result.objects.map((obj) => ({
        id: `r2:${obj.key}`,
        provider: 'r2' as const,
        bucket: 'tcgiberia-images',
        key: obj.key,
        filename: obj.filename,
        publicUrl: obj.publicUrl,
        mimeType: obj.mimeType || 'image/unknown',
        size: obj.size,
        createdAt: obj.createdAt,
        assignedProducts: [] as AssignedProduct[],
        migrationStatus: 'migrated' as const,
      }));
      images.push(...r2Images);
    }

    // Fetch products and link assignments
    const products = await db.product.findMany({
      where: { imageUrl: { not: null } },
      select: { id: true, name: true, slug: true, imageUrl: true },
    });

    // Assign products to images based on URL matching
    for (const image of images) {
      const assignedProducts: AssignedProduct[] = [];

      for (const product of products) {
        if (product.imageUrl && urlsMatch(product.imageUrl, image.publicUrl)) {
          assignedProducts.push({
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
          });
        }
      }

      image.assignedProducts = assignedProducts;
    }

    // Apply filters
    let filtered = images;

    if (filter?.search) {
      const term = filter.search.toLowerCase();
      filtered = filtered.filter(
        (img) =>
          img.filename.toLowerCase().includes(term) ||
          img.publicUrl.toLowerCase().includes(term) ||
          img.key.toLowerCase().includes(term) ||
          img.assignedProducts.some((p) => p.productName.toLowerCase().includes(term))
      );
    }

    if (filter?.assignedOnly) {
      filtered = filtered.filter((img) => img.assignedProducts.length > 0);
    }

    if (filter?.unassignedOnly) {
      filtered = filtered.filter((img) => img.assignedProducts.length === 0);
    }

    return filtered;
  } catch (error) {
    console.error('Error fetching media library images:', error);
    throw error;
  }
}

/**
 * Get single image with full details
 */
export async function getImageDetails(id: string): Promise<MediaLibraryImage | null> {
  const images = await getAllImages();
  return images.find((img) => img.id === id) || null;
}

/**
 * Find products using a specific image URL
 */
export async function findProductsByImageUrl(imageUrl: string): Promise<AssignedProduct[]> {
  const products = await db.product.findMany({
    where: { imageUrl: normalizeUrl(imageUrl) },
    select: { id: true, name: true, slug: true },
  });

  return products.map((p) => ({
    productId: p.id,
    productName: p.name,
    productSlug: p.slug,
  }));
}

/**
 * Extract the file path component from a storage URL (regardless of domain)
 * Handles both Supabase and R2 URLs
 */
function extractPathComponent(url: string): string {
  if (!url) return '';
  
  try {
    const urlObj = new URL(url);
    let pathname = urlObj.pathname;
    
    // For Supabase: /storage/v1/object/public/product-images/products/filename
    // Extract everything after 'products/'
    if (pathname.includes('/storage/v1/object/public/')) {
      const match = pathname.match(/\/products\/(.+)$/);
      if (match) {
        return match[1];
      }
    }
    
    // For R2 or direct paths: /products/filename
    if (pathname.includes('/products/')) {
      const match = pathname.match(/\/products\/(.+)$/);
      if (match) {
        return match[1];
      }
    }
    
    // Fallback: return full pathname
    return pathname;
  } catch {
    // If URL parsing fails, try manual extraction
    const match = url.match(/\/products\/([^?#]+)/);
    return match ? match[1] : '';
  }
}

/**
 * Normalize URLs for comparison
 * Handles trailing slashes, query parameters, and URL encoding
 * Focuses on comparing the actual file paths, not the domain/provider
 */
function normalizeUrl(url: string): string {
  if (!url) return '';
  
  try {
    const urlObj = new URL(url);
    // Construct normalized URL: protocol + host + pathname (lowercase)
    // Don't include search params or hash
    return (urlObj.protocol + '//' + urlObj.host + urlObj.pathname).toLowerCase();
  } catch {
    // Fallback: simple string normalization
    // Remove trailing slashes and convert to lowercase
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Compare two URLs for equality, handling different domain/provider formats
 */
function urlsMatch(url1: string, url2: string): boolean {
  if (!url1 || !url2) return false;
  
  // First try exact normalized match
  const norm1 = normalizeUrl(url1);
  const norm2 = normalizeUrl(url2);
  
  if (norm1 === norm2) {
    return true;
  }
  
  // If direct match fails, compare just the file path component
  // This handles cases where the domain/provider changed
  const path1 = extractPathComponent(url1);
  const path2 = extractPathComponent(url2);
  
  if (path1 && path2 && path1.toLowerCase() === path2.toLowerCase()) {
    console.log(`URL path match found: ${path1}`);
    return true;
  }
  
  return false;
}

/**
 * Delete image from storage
 * Safely checks for product references first
 */
export async function deleteImage(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const image = await getImageDetails(id);
    if (!image) {
      return { success: false, error: 'Image not found' };
    }

    // Check for assigned products
    if (image.assignedProducts.length > 0) {
      return {
        success: false,
        error: `Cannot delete: ${image.assignedProducts.length} product(s) using this image`,
      };
    }

    // Delete from storage
    if (image.provider === 'supabase') {
      await deleteFromSupabaseStorage(image.publicUrl);
    } else if (image.provider === 'r2') {
      await deleteFromR2(image.key);
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Assign image to a product
 */
export async function assignImageToProduct(
  imageId: string,
  productId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const image = await getImageDetails(imageId);
    if (!image) {
      return { success: false, error: 'Image not found' };
    }

    const product = await db.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    // Update product with new image URL
    await db.product.update({
      where: { id: productId },
      data: { imageUrl: image.publicUrl },
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Remove image assignment from a product without deleting the image
 */
export async function removeImageAssignment(productId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const product = await db.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    // Clear the imageUrl
    await db.product.update({
      where: { id: productId },
      data: { imageUrl: null },
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Upload image to specified provider
 */
export async function uploadImage(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  provider: StorageProvider = 'r2'
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    if (provider === 'r2') {
      // Generate unique R2 key
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const ext = filename.split('.').pop() || 'bin';
      const key = `products/${filename.replace(/\.[^/.]+$/, '')}-${timestamp}-${random}.${ext}`;

      const result = await uploadToR2(key, buffer, mimeType);
      return { success: true, url: result.publicUrl };
    } else if (provider === 'supabase') {
      const url = await uploadToSupabaseStorage(buffer, filename);
      return { success: true, url };
    } else {
      return { success: false, error: 'Unknown provider' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
