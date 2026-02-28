import { getWastes } from '@/lib/poster';
import { WriteOffsPageClient } from '@/components/write-offs/write-offs-page-client';
import { getWriteOffCommentsAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function WriteOffsPage() {
    const wastes = await getWastes();
    const comments = await getWriteOffCommentsAction();
    
    return (
        <WriteOffsPageClient initialWastes={wastes} comments={comments} />
    );
}
