import { WriteOffsPageHeader } from '@/components/write-offs/write-offs-page-header';
import { getStorages, getIngredients } from '@/lib/poster';
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

// Data moved here to be passed down to the form
const employees = [
  {
    id: 'employee-1',
    name: "Елена Попова",
    email: "elena.popova@example.com",
    role: "Администратор",
    avatar: PlaceHolderImages.find(p => p.id === 'employee-1')
  },
  {
    id: 'employee-2',
    name: "Михаил Захаров",
    email: "mikhail.z@example.com",
    role: "Сотрудник",
    avatar: PlaceHolderImages.find(p => p.id === 'employee-2')
  },
  {
    id: 'employee-3',
    name: "София Кузнецова",
    email: "sofia.k@example.com",
    role: "Сотрудник",
    avatar: PlaceHolderImages.find(p => p.id === 'employee-3')
  },
];


export default async function WriteOffsPage() {
    const [storages, ingredients] = await Promise.all([
        getStorages(),
        getIngredients()
    ]);

    const employeesForForm = employees.map(e => ({ id: e.id, name: e.name }));

    return (
        <div className="space-y-8">
            <WriteOffsPageHeader
                storages={storages}
                ingredients={ingredients}
                employees={employeesForForm}
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
