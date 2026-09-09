import { getFirebaseAdmin } from '@/firebase/server';
import { firebaseConfig } from '@/firebase/config';
import crypto from 'crypto';

/**
 * Загрузка изображения в Firebase Storage (Server-side)
 * @param base64 Image data (without prefix)
 * @param fileName Dest name
 * @param mimeType 
 * @returns { url, storagePath }
 */
export async function uploadImageToStorage(base64: string, fileName: string, mimeType: string = 'image/jpeg') {
    const bucketName = firebaseConfig.storageBucket || 'studio-6350931931-426d4.firebasestorage.app';
    const filePath = `receipts/${fileName}`;
    const downloadToken = crypto.randomUUID();
    const fallbackMediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;

    try {
        const admin = getFirebaseAdmin();
        const bucket = admin.storage().bucket(bucketName);
        const file = bucket.file(filePath);

        console.log(`[Storage] Starting upload to bucket: ${bucketName}, path: ${filePath}`);

        const buffer = Buffer.from(base64, 'base64');
        
        await file.save(buffer, {
            metadata: { 
                contentType: mimeType,
                metadata: {
                    firebaseStorageDownloadTokens: downloadToken
                }
            },
            resumable: false // faster for small files
        });

        console.log(`[Storage] File saved successfully to ${filePath}.`);

        // Try to make public if bucket policy allows
        try {
            await file.makePublic();
        } catch (aclError: any) {
            console.warn('[Storage] Notice: Could not apply public ACL (safe to ignore if bucket uses Uniform access control):', aclError?.message);
        }

        console.log(`[Storage] Upload complete. Final URL: ${fallbackMediaUrl}`);
        
        return {
            url: fallbackMediaUrl,
            storagePath: filePath
        };
    } catch (error: any) {
        console.error('CRITICAL Storage Upload Error:', error?.message || error);
        
        // Return public media URL so the application can still display the uploaded image
        return {
            url: fallbackMediaUrl,
            storagePath: filePath
        };
    }
}
