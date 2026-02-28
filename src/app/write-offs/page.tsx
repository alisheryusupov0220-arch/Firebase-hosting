import { getWriteOffs } from '@/lib/poster';
import { WriteOffsPageClient } from '@/components/write-offs/write-offs-page-client';

export const dynamic = 'force-dynamic';

export default async function WriteOffsPage() {
    const writeOffs = await getWriteOffs();
    return (
        <WriteOffsPageClient initialWriteOffs={writeOffs} />
    );
}
