import { WriteOffsPageHeader } from '@/components/write-offs/write-offs-page-header';
import { getStorages } from '@/lib/poster';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getLocalIngredients } from '@/app/ingredients/actions';

export const dynamic = 'force-dynamic';

export default async function WriteOffsPage() {
    const [storages, ingredients] = await Promise.all([
        getStorages(),
        getLocalIngredients()
    ]);
    
    const ingredientsForForm = ingredients.map(ing => ({
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      ingredient_unit: ing.unit,
    }));


    return (
        <div className="space-y-8">
            <WriteOffsPageHeader
                storages={storages}
                ingredients={ingredientsForForm}
            />
        
            <Card>
                <CardHeader>
                    <CardTitle>Последние списания</CardTitle>
                    <CardDescription>Список недавних списаний будет отображаться здесь.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-24 flex items-center justify-center text-muted-foreground">
                        Нет данных о списаниях.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
