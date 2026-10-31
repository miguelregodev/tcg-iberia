import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

// Cloudflare R2 configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'tcgiberia-images';
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

let _r2Client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (_r2Client) return _r2Client;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      'R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must be set in server environment.'
    );
  }

  _r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  return _r2Client;
}

export interface R2ObjectMetadata {
  key: string;
  filename: string;
  size: number;
  mimeType: string;
  createdAt: Date;
  publicUrl: string;
  width?: number;
  height?: number;
}

export interface R2ListResult {
  objects: R2ObjectMetadata[];
  continuationToken?: string;
}

/**
 * List objects in R2 bucket with pagination
 */
export async function listR2Objects(
  prefix?: string,
  continuationToken?: string,
  maxKeys: number = 100
): Promise<R2ListResult> {
  try {
    const client = getR2Client();

    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
    });

    const response = await client.send(command);

    const objects: R2ObjectMetadata[] = (response.Contents || [])
      .filter((obj) => obj.Key && !obj.Key.endsWith('/')) // Exclude prefixes
      .map((obj) => ({
        key: obj.Key!,
        filename: obj.Key!.split('/').pop() || '',
        size: obj.Size || 0,
        mimeType: 'application/octet-stream',
        createdAt: obj.LastModified || new Date(),
        publicUrl: `${R2_PUBLIC_DOMAIN}/${obj.Key!}`,
      }));

    return {
      objects,
      continuationToken: response.NextContinuationToken,
    };
  } catch (error) {
    console.error('R2 list error:', error);
    throw error instanceof Error ? error : new Error('Failed to list R2 objects');
  }
}

/**
 * Download object from R2
 */
export async function downloadFromR2(key: string): Promise<Buffer> {
  try {
    const client = getR2Client();

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      throw new Error('Empty response body');
    }

    // Convert the readable stream to a Buffer
    const chunks: Uint8Array[] = [];
    const body = response.Body as any;

    if (body.transformToByteArray) {
      // For SDK v3 with Uint8Array support
      const bytes = await body.transformToByteArray();
      return Buffer.from(bytes);
    } else if (Symbol.asyncIterator in body) {
      // For async iterable streams
      for await (const chunk of body) {
        chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
      }
      return Buffer.concat(chunks);
    } else {
      // Fallback: treat as Node.js stream
      return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        body.on('data', (chunk: Uint8Array | Buffer) => {
          chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
        });
        body.on('end', () => resolve(Buffer.concat(chunks)));
        body.on('error', reject);
      });
    }
  } catch (error) {
    console.error('R2 download error:', error);
    throw error instanceof Error ? error : new Error('Failed to download from R2');
  }
}

/**
 * Upload object to R2
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer | Uint8Array,
  mimeType: string = 'application/octet-stream'
): Promise<R2ObjectMetadata> {
  try {
    const client = getR2Client();

    // Ensure it's a Uint8Array for S3 upload
    const bodyData = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: bodyData,
      ContentType: mimeType,
    });

    await client.send(command);

    return {
      key,
      filename: key.split('/').pop() || '',
      size: bodyData.length,
      mimeType,
      createdAt: new Date(),
      publicUrl: `${R2_PUBLIC_DOMAIN}/${key}`,
    };
  } catch (error) {
    console.error('R2 upload error:', error);
    throw error instanceof Error ? error : new Error('Failed to upload to R2');
  }
}

/**
 * Delete object from R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  try {
    const client = getR2Client();

    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await client.send(command);
  } catch (error) {
    console.error('R2 delete error:', error);
    throw error instanceof Error ? error : new Error('Failed to delete from R2');
  }
}

/**
 * Check if object exists in R2
 */
export async function r2ObjectExists(key: string): Promise<boolean> {
  try {
    const client = getR2Client();

    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return false;
    }
    console.error('R2 head object error:', error);
    throw error;
  }
}

/**
 * Get public URL for an R2 object
 */
export function getR2PublicUrl(key: string): string {
  return `${R2_PUBLIC_DOMAIN}/${key}`;
}

/**
 * Extract R2 object key from public URL
 */
export function extractR2KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes(R2_PUBLIC_DOMAIN.replace(/^https?:\/\//, ''))) {
      return null;
    }
    return urlObj.pathname.substring(1); // Remove leading slash
  } catch {
    return null;
  }
}

/**
 * Verify R2 object is accessible via public URL
 */
export async function verifyR2ObjectAccessible(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}
