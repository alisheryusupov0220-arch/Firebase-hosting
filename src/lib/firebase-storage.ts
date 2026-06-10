import { getFirebaseAdmin } from '@/firebase/server';

/**
 * Загрузка изображения в Firebase Storage (Server-side)
 * @param base64 Image data (without prefix)
 * @param fileName Dest name
 * @param mimeType 
 * @returns { url, storagePath }
 */
export async function uploadImageToStorage(base64: string, fileName: string, mimeType: string = 'image/jpeg') {
    try {
        const admin = getFirebaseAdmin();
        const bucket = admin.storage().bucket();
        const filePath = `receipts/${fileName}`;
        const file = bucket.file(filePath);

        console.log(`[Storage] Starting upload to bucket: ${bucket.name}, path: ${filePath}`);

        const buffer = Buffer.from(base64, 'base64');
        
        await file.save(buffer, {
            metadata: { contentType: mimeType },
            resumable: false // faster for small files
        });

        console.log(`[Storage] File saved successfully. Generating signed URL...`);

        // Используем Signed URL (срок действия 10 лет), так как Public Access может быть заблокирован политиками
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: '2035-01-01' // Long term access
        });

        console.log(`[Storage] Upload complete. URL: ${url}`);
        
        return {
            url: url,
            storagePath: filePath
        };
    } catch (error: any) {
        console.error('CRITICAL Storage Upload Error:', error.message);
        if (error.message.includes('bucket does not exist')) {
            console.error('--- ACTION REQUIRED: Please enable Firebase Storage in the Firebase Console and ensure the bucket name is correct in src/firebase/config.ts ---');
        }
        return null;
    }
}
