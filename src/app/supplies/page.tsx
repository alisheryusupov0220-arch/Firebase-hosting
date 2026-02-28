import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getSupplies, type Supply, getStorages, getPosterSuppliers } from '@/lib/poster';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SuppliesPageHeader } from "@/components/supplies/supplies-page-header";
import { PendingSuppliesCard } from "@/components/supplies/pending-supplies-card";
import { getLocalIngredients } from "@/app/ingredients/actions";

export const dynamic = 'force-dynamic';

export default async function SuppliesPage() {
  const [supplies, storages, suppliers, ingredients] = await Promise.all([
    getSupplies(),
    getStorages(),
    getPosterSuppliers(),
    getLocalIngredients()
  ]);

  const ingredientsForForm = ingredients.map(ing => ({
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      ingredient_unit: ing.unit,
  }));

  const getStatusVariant = (status: string) => {
    switch (status) {
      case '1': return 'secondary'; // open
      case '2': return 'default'; // closed
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case '1': return 'Открыта';
      case '2': return 'Закрыта';
      default: return 'Неизвестно';
    }
  };


  return (
    <div className="space-y-8">
      <SuppliesPageHeader
        storages={storages}
        suppliers={suppliers}
        ingredients={ingredientsForForm}
      />

       <PendingSuppliesCard 
          storages={storages}
          suppliers={suppliers}
          ingredients={ingredientsForForm}
       />
     
      <Card>
        <CardHeader>
            <CardTitle>Последние поставки</CardTitle>
            <CardDescription>Список недавних поставок, полученных из Poster.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">ID</TableHead>
                        <TableHead>Дата</TableHead>
                        <TableHead>Поставщик</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Комментарий</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {supplies.length > 0 ? (
                        supplies.map((supply) => (
                            <TableRow key={supply.supply_id}>
                                <TableCell className="font-medium">{supply.supply_id}</TableCell>
                                <TableCell>{supply.date_created ? format(new Date(supply.date_created.replace(' ', 'T')), 'dd.MM.yyyy HH:mm') : '-'}</TableCell>
                                <TableCell>{supply.supplier_name || '-'}</TableCell>
                                <TableCell className="text-right">{new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS' }).format(Number(supply.supply_sum) / 100)}</TableCell>
                                <TableCell>
                                    <Badge variant={getStatusVariant(supply.supply_status)}>
                                        {getStatusLabel(supply.supply_status)}
                                    </Badge>
                                </TableCell>
                                <TableCell>{supply.comment || '-'}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                Поставок не найдено.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
