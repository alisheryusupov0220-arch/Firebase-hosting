import { getProducts, type Product } from '@/lib/poster';
import { getFirebaseApp } from '@/firebase/server';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

type EnrichedProduct = Product & {
    realCost: number;
    margin: number | null;
    sellingPrice: number;
};

// Helper function to fetch the latest prices for a list of ingredient IDs
async function getLatestPrices(ingredientIds: string[]): Promise<Record<string, number>> {
    const db = getFirestore(getFirebaseApp());
    const prices: Record<string, number> = {};

    const pricePromises = ingredientIds.map(async (id) => {
        const pricesQuery = query(
            collection(db, `ingredients/${id}/price_history`),
            orderBy('date', 'desc'),
            limit(1)
        );
        const querySnapshot = await getDocs(pricesQuery);
        if (!querySnapshot.empty) {
            return { id, price: querySnapshot.docs[0].data().price };
        }
        return { id, price: 0 }; // Default to 0 if no price history
    });
    
    const results = await Promise.all(pricePromises);
    results.forEach(result => {
        prices[result.id] = result.price;
    });

    return prices;
}

const getMarginVariant = (margin: number | null) => {
    if (margin === null) return 'secondary';
    if (margin < 60) return 'destructive';
    if (margin >= 60 && margin <= 70) return 'secondary';
    return 'default';
};

const getMarginLabel = (margin: number | null) => {
    if (margin === null) return 'N/A';
    if (margin < 60) return 'Low';
    if (margin >= 60 && margin <= 70) return 'Medium';
    return 'Healthy';
}

export default async function MenuAnalyticsPage() {
    const products = await getProducts();

    const allIngredientIds = new Set<string>();
    products.forEach(product => {
        if (product.composition) {
            product.composition.forEach(comp => {
                if (comp.type === '1') { // Type '1' is an ingredient
                    allIngredientIds.add(comp.ingredient_id);
                }
            });
        }
    });

    const latestPrices = await getLatestPrices(Array.from(allIngredientIds));

    const enrichedProducts: EnrichedProduct[] = products.map(product => {
        let realCost = 0;
        if (product.composition) {
            product.composition.forEach(comp => {
                if (comp.type === '1') {
                    const price = latestPrices[comp.ingredient_id] || 0;
                    // Poster gives weight in grams, assuming price is per kg
                    const costOfIngredient = (parseFloat(comp.brutto) / 1000) * price;
                    realCost += costOfIngredient;
                }
            });
        }
        
        // Assuming price for the first spot '1' is the main selling price
        const sellingPrice = parseFloat(product.price?.['1'] || '0') / 100; // Price from poster is in cents
        const margin = sellingPrice > 0 ? ((sellingPrice - realCost) / sellingPrice) * 100 : null;

        return {
            ...product,
            realCost,
            sellingPrice,
            margin,
        };
    }).sort((a, b) => (a.margin ?? 100) - (b.margin ?? 100)); // Sort by margin ascending

    return (
        <div className="space-y-6">
            <PageHeader title="Аналитика меню" description="Анализ рентабельности блюд на основе реальной себестоимости." />
            <Card>
                <CardHeader>
                    <CardTitle>Рентабельность блюд</CardTitle>
                    <CardDescription>
                        Себестоимость рассчитывается на основе последних цен закупки. Маржа: (Цена - Себестоимость) / Цена.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Блюдо</TableHead>
                                <TableHead className="text-right">Цена продажи</TableHead>
                                <TableHead className="text-right">Реальная себестоимость</TableHead>
                                <TableHead className="text-right">Маржа</TableHead>
                                <TableHead className="text-center">Статус</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {enrichedProducts.map(product => (
                                <TableRow key={product.product_id}>
                                    <TableCell className="font-medium">{product.product_name}</TableCell>
                                    <TableCell className="text-right">
                                        {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(product.sellingPrice)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(product.realCost)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {product.margin?.toFixed(1) ?? 'N/A'}%
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant={getMarginVariant(product.margin)}>
                                            {getMarginLabel(product.margin)}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
