/**
 * Cloudinary Storage Client for Proctoring Media & Snapshots
 * 
 * Offloads Base64 images and video recordings from PostgreSQL / Neon DB
 * to Cloudinary CDN via Unsigned Uploads.
 * 
 * Required Environment Variables in .env:
 * - VITE_CLOUDINARY_CLOUD_NAME
 * - VITE_CLOUDINARY_UPLOAD_PRESET (Unsigned preset from Cloudinary Console)
 */

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
  isConfigured: boolean;
}

/**
 * Retrieve active Cloudinary credentials from Vite environment
 */
export const getCloudinaryConfig = (): CloudinaryConfig => {
  const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
  const uploadPreset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim();
  const isConfigured = Boolean(
    cloudName &&
    uploadPreset &&
    cloudName !== 'your-cloud-name' &&
    uploadPreset !== 'your-unsigned-upload-preset'
  );

  return {
    cloudName,
    uploadPreset,
    isConfigured,
  };
};

/**
 * Upload an image (Data URL, Blob, or File) to Cloudinary using an unsigned preset.
 * Gracefully falls back to the original Base64 string if Cloudinary is not configured
 * or if a network/upload failure occurs, ensuring exams are never disrupted.
 */
export async function uploadToCloudinary(
  fileOrBase64: string | Blob | File,
  folder: string = 'quiz-proctoring/snapshots'
): Promise<string> {
  const { cloudName, uploadPreset, isConfigured } = getCloudinaryConfig();

  // If not configured, safely return original string or Blob converted to Data URL
  if (!isConfigured) {
    if (typeof fileOrBase64 === 'string') {
      return fileOrBase64;
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(fileOrBase64 as Blob);
    });
  }

  try {
    const formData = new FormData();
    formData.append('file', fileOrBase64);
    formData.append('upload_preset', uploadPreset);
    if (folder) {
      formData.append('folder', folder);
    }

    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errDetails = await response.json().catch(() => ({}));
      console.warn('[Cloudinary] Image upload failed (status %d):', response.status, errDetails);
      // Fallback gracefully so proctoring records are not lost
      if (typeof fileOrBase64 === 'string') return fileOrBase64;
      return '';
    }

    const data = await response.json();
    return data.secure_url || data.url || (typeof fileOrBase64 === 'string' ? fileOrBase64 : '');
  } catch (error) {
    console.warn('[Cloudinary] Network exception during upload, falling back to local snapshot:', error);
    if (typeof fileOrBase64 === 'string') return fileOrBase64;
    return '';
  }
}

/**
 * Upload recorded video (e.g. screen recording snippet) to Cloudinary.
 */
export async function uploadVideoToCloudinary(
  videoBlob: Blob,
  folder: string = 'quiz-proctoring/recordings'
): Promise<string | null> {
  const { cloudName, uploadPreset, isConfigured } = getCloudinaryConfig();

  if (!isConfigured) {
    console.info('[Cloudinary] Video upload skipped: Cloudinary is not configured.');
    return null;
  }

  try {
    const formData = new FormData();
    formData.append('file', videoBlob, 'screen-record.webm');
    formData.append('upload_preset', uploadPreset);
    if (folder) {
      formData.append('folder', folder);
    }

    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errDetails = await response.json().catch(() => ({}));
      console.warn('[Cloudinary] Video upload failed:', errDetails);
      return null;
    }

    const data = await response.json();
    return data.secure_url || data.url || null;
  } catch (error) {
    console.warn('[Cloudinary] Video upload network error:', error);
    return null;
  }
}

/**
 * Specialized helper to upload proctoring snapshots with quiz metadata in path
 */
export async function uploadProctoringSnapshot(
  dataUrl: string,
  quizId?: string | number,
  studentId?: string | number
): Promise<string> {
  const subfolder = quizId
    ? `quiz-proctoring/quiz-${quizId}${studentId ? `/student-${studentId}` : ''}`
    : 'quiz-proctoring/snapshots';

  return uploadToCloudinary(dataUrl, subfolder);
}

/**
 * Generate a Cloudinary thumbnail URL with automatic format and compression
 * Example: insert `c_thumb,w_300,h_200,q_auto,f_auto` into Cloudinary URLs
 */
export function getOptimizedCloudinaryUrl(
  url: string,
  options: { width?: number; height?: number; quality?: string } = {}
): string {
  if (!url || !url.includes('cloudinary.com')) return url;

  const { width = 320, height = 240, quality = 'auto' } = options;
  const transformations = `c_limit,w_${width},h_${height},q_${quality},f_auto`;

  // Look for /upload/ in the Cloudinary URL
  return url.replace('/upload/', `/upload/${transformations}/`);
}
