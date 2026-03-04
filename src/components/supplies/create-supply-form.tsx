'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Trash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMemo } from 'react';
import { useUser } from '@/firebase/hooks';
import type { LocalIngredient } from '@/app/ingredients/actions';
import { SearchableSelect } from '../ui/searchable-select';
import { formatNumberString, parseFormattedNumber, translateUnit } from '@/lib/utils';
import { type Storage, type PosterSupplier, type CreateSupplyData } from '@/lib/poster';
import { createDirectSupplyAction } from '@/app/supplies/actions';

const formSchema = z.object({
  supplier_id: z.string().min(1, 'Нужно выбрать поставщика'),
  storage_id: z.string().min(1, 'Нужно выбрать склад'),
  comment: z.string().optional(),
  ingredients: z.array(z.object({
    ingredient_id: z.string().min(1, 'Нужно выбрать ингредиент'),
    count: z.string().min(1, 'Введите кол-во').refine(val => parseFormattedNumber(val) > 0, { message: 'Кол-во > 0'}),
    price: z.string().min(1, 'Введите цену')
      .refine(val => parseFormattedNumber(val) >= 0, { message: 'Цена >= 0'}),
  })).min(1, 'Нужно добавить хотя бы один ингредиент'),
});

type CreateSupplyFormValues = z.infer<typeof formSchema>;

type CreateSupplyFormProps = {
  ingredients: LocalIngredient[] | null;
  storages: Storage[];
  suppliers: PosterSupplier[];
  onFormSubmitted: () => void;
};

export function CreateSupplyForm({ ingredients, storages, suppliers, onFormSubmitted }: CreateSupplyFormProps) {
  const { toast } = useToast();
  const { user } = useUser();

  const form = useForm<CreateSupplyFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplier_id: '',
      storage_id: '',
      comment: '',
      ingredients: [{ ingredient_id: '', count: '', price: '' }],
    },
  });

  const ingredientOptions = useMemo(() => {
    return (ingredients || []).map(ing => ({
      value: String(ing.id),
      label: ing.name
    }));
  }, [ingredients]);
  
  const supplierOptions = useMemo(() => {
    return (suppliers || []).map(s => ({
      value: String(s.supplier_id),
      label: s.supplier_name
    }));
  }, [suppliers]);

  const storageOptions = useMemo(() => {
    return (storages || []).map(s => ({
      value: String(s.storage_id),
      label: s.storage_name
    }));
  }, [storages]);


  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'ingredients',
  });

  const watchedIngredients = form.watch('ingredients');

  async function onSubmit(values: CreateSupplyFormValues) {
    if (!user) {
        toast({
            variant: 'destructive',
            title: 'Ошибка!',
            description: 'Вы должны быть авторизованы для выполнения этого действия.',
        });
        return;
    }
    
    const finalComment = `Сотрудник: ${user.email}. ${values.comment || ''}`.trim();

    const supplyData: CreateSupplyData = {
      supplier_id: Number(values.supplier_id),
      storage_id: Number(values.storage_id),
      comment: finalComment,
      ingredients: values.ingredients.map(ing => {
        const fullIngredient = ingredients?.find(i => i.id === ing.ingredient_id);
        const posterType = fullIngredient?.type === 'product' ? 3 : 1;
        const unit = fullIngredient?.unit || '';

        return {
          ingredient_id: Number(ing.ingredient_id),
          count: parseFormattedNumber(ing.count),
          price: parseFormattedNumber(ing.price), // This is the total sum for the line item
          type: posterType,
          unit: unit,
        };
      }),
    };

    const result = await createDirectSupplyAction(supplyData);

    if (result.success) {
        toast({
            title: 'Успех!',
            description: 'Поставка успешно создана в Poster.',
        });
        onFormSubmitted();
        form.reset();
    } else {
        toast({
            variant: 'destructive',
            title: 'Ошибка создания поставки',
            description: result.message
        });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Поставщик</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={supplierOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Выберите поставщика"
                      disabled={!suppliers || suppliers.length === 0}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="storage_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Склад</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={storageOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Выберите склад"
                      disabled={!storages || storages.length === 0}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>

        <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-start gap-2 px-2">
                <FormLabel>Ингредиент</FormLabel>
                <FormLabel className="w-28 text-center">Кол-во</FormLabel>
                <FormLabel className="w-28 text-center">Общая сумма</FormLabel>
                <div className="w-9"></div>
            </div>
            {fields.map((field, index) => {
                const selectedIngredientId = watchedIngredients[index]?.ingredient_id;
                const selectedIngredient = ingredients?.find(ing => ing.id === selectedIngredientId);
                const unit = selectedIngredient ? translateUnit(selectedIngredient.unit) : '';
                const isUnitBased = unit === 'штук';
                const countPlaceholder = isUnitBased ? '1, 2, 3...' : '1.123';

                return (
                    <div key={field.id} className="grid grid-cols-[1fr_auto_auto_auto] items-start gap-2 p-2 border rounded-md">
                       <FormField
                          control={form.control}
                          name={`ingredients.${index}.ingredient_id`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <SearchableSelect
                                  options={ingredientOptions}
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="Выберите ингредиент"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                            control={form.control}
                            name={`ingredients.${index}.count`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input {...field} type="text" inputMode="decimal" value={field.value || ''} placeholder={`${countPlaceholder} ${unit}`} className="w-28 text-right" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`ingredients.${index}.price`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            type="text"
                                            inputMode="decimal"
                                            value={field.value || ''}
                                            onChange={(e) => {
                                                const formatted = formatNumberString(e.target.value);
                                                field.onChange(formatted);
                                            }}
                                            placeholder="Сумма"
                                            className="w-28 text-right"
                                         />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                            <Trash className="h-4 w-4" />
                        </Button>
                    </div>
                )
            })}
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => append({ ingredient_id: '', count: '', price: '' })}
            >
                Добавить ингредиент
            </Button>
        </div>

        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Комментарий</FormLabel>
              <FormControl>
                <Textarea placeholder="Добавьте комментарий к поставке..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" disabled={form.formState.isSubmitting || !ingredients}>
          {form.formState.isSubmitting ? 'Создание...' : 'Создать поставку'}
        </Button>
      </form>
    </Form>
  );
}
