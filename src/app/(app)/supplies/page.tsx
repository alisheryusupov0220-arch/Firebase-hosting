import { PageHeader } from '@/components/layout/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getSupplies, type Supply } from '@/lib/poster';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

async function getSuppliesData(): Promise<Supply[]> {
    try {
        // By not providing dates, we should get recent supplies from Poster API.
        // This avoids issues with incorrect server clock.
        const supplies = await getSupplies();
        // Poster API might return an empty object if there are no results
        return Array.isArray(supplies) ? supplies : [];
    } catch (error) {
        console.error("Failed to fetch supplies:", error);
        // Return empty array to prevent crashing the page
        return [];
    }
}


export default async function SuppliesPage() {
  const supplies = await getSuppliesData();

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
      <PageHeader title="Поставки" description="Учет поступлений товаров и материалов." />
      <Card>
        <CardHeader>
            <CardTitle>Последние поставки</CardTitle>
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
                                <TableCell className="text-right">{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Number(supply.supply_sum))}</TableCell>
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
