import { getAISettingsAction } from "./actions";
import { AISettingsForm } from "./ai-settings-form";

export default async function AISettingsPage() {
    const initialSettings = await getAISettingsAction();

    return (
        <div className="p-8">
            <AISettingsForm initialSettings={initialSettings} />
        </div>
    );
}

// Ensure this page is not cached statically
export const dynamic = 'force-dynamic';
