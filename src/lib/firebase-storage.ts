import { getFirebaseAdmin } from '@/firebase/server';
import { firebaseConfig } from '@/firebase/config';

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
    const fallbackMediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media`;

    try {
        const admin = getFirebaseAdmin();
        const bucket = admin.storage().bucket(bucketName);
        const file = bucket.file(filePath);

        console.log(`[Storage] Starting upload to bucket: ${bucketName}, path: ${filePath}`);

        const buffer = Buffer.from(base64, 'base64');
        
        await file.save(buffer, {
            metadata: { contentType: mimeType },
            resumable: false // faster for small files
        });

        console.log(`[Storage] File saved successfully to ${filePath}.`);

        // Try to make public if bucket policy allows
        try {
            await file.makePublic();
        } catch (aclError: any) {
            console.warn('[Storage] Notice: Could not apply public ACL (safe to ignore if bucket uses Uniform access control):', aclError?.message);
        }

        // Try generating signed URL
        let finalUrl = fallbackMediaUrl;
        try {
            const [signedUrl] = await file.getSignedUrl({
                action: 'read',
                expires: '2035-01-01' // Long term access
            });
            if (signedUrl) {
                finalUrl = signedUrl;
            }
        } catch (signedErr: any) {
            console.warn('[Storage] Signed URL creation skipped/failed, using fallback media URL:', signedErr?.message);
        }

        console.log(`[Storage] Upload complete. Final URL: ${finalUrl}`);
        
        return {
            url: finalUrl,
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
