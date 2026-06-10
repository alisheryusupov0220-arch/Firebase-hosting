'use client';

import { useMemo } from 'react';
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
import { useUser, useFirebase } from '@/firebase/hooks';
import { type ERPItem } from '@/lib/types/erp';
import { SearchableSelect } from '../ui/searchable-select';
import { translateUnit } from '@/lib/utils';
import { createDirectWriteOffAction } from '@/app/write-offs/actions';
import type { CreateWriteOffData } from '@/lib/poster';

const formSchema = z.object({
  comment: z.string().optional(),
  ingredients: z.array(z.object({
    ingredient_id: z.string().min(1, 'Нужно выбрать ингредиент'),
    quantity: z.string().min(1, 'Введите кол-во').pipe(z.coerce.number().positive('Кол-во > 0')),
  })).min(1, 'Нужно добавить хотя бы один ингредиент'),
});

type CreateWriteOffFormValues = z.infer<typeof formSchema>;

type CreateWriteOffFormProps = {
  ingredients: ERPItem[] | null;
  onFormSubmitted: () => void;
};

export function CreateWriteOffForm({ ingredients, onFormSubmitted }: CreateWriteOffFormProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const { orgId } = useFirebase();

  const form = useForm<CreateWriteOffFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      comment: '',
      ingredients: [{ ingredient_id: '', quantity: '' as unknown as number }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'ingredients',
  });
  
  const ingredientOptions = useMemo(() => {
    return (ingredients || []).map(ing => ({
      value: String(ing.id),
      label: ing.name
    }));
  }, [ingredients]);

  const watchedIngredients = form.watch('ingredients');

  async function onSubmit(values: CreateWriteOffFormValues) {
    if (!user) {
        toast({ variant: 'destructive', title: 'Ошибка!', description: 'Вы должны быть авторизованы.' });
        return;
    }

    const finalComment = `Сотрудник: ${user.email}. ${values.comment || ''}`.trim();

    // We must format the date according to Poster API expectations (Y-m-d H:i:s)
    const formattedDate = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const posterDate = `${formattedDate.getFullYear()}-${pad(formattedDate.getMonth() + 1)}-${pad(formattedDate.getDate())} ${pad(formattedDate.getHours())}:${pad(formattedDate.getMinutes())}:${pad(formattedDate.getSeconds())}`;

    const firstIngredientId = values.ingredients[0]?.ingredient_id;
    const firstIngredient = ingredients?.find(i => i.id === firstIngredientId);
    const storageId = 1; // Default to storage ID 1 since erp_items don't hold storage_id

    const writeOffData: CreateWriteOffData = {
      write_off: {
          date: posterDate,
          storage_id: String(storageId),
          reason: finalComment || 'Списание FLOW'
      },
      ingredient: values.ingredients.map(ing => {
          const matchedIng = ingredients?.find(i => i.id === ing.ingredient_id);
          // type 4 = ingredient, type 3 = semi-finished
          const posterType = (matchedIng?.type === 'PRODUCT' || matchedIng?.type === 'SEMI_FINISHED') ? '3' : '4';
          const posterId = matchedIng?.posterId || matchedIng?.id || ing.ingredient_id;
          return {
              id: String(posterId),
              type: posterType,
              weight: String(ing.quantity)
          };
      })
    };

    const result = await createDirectWriteOffAction(writeOffData, orgId || undefined);
    
    if (result.success) {
        toast({
            title: 'Успех!',
            description: 'Списание успешно создано в Poster.',
        });
        onFormSubmitted();
        form.reset();
    } else {
        toast({
            variant: 'destructive',
            title: 'Ошибка создания списания',
            description: result.message
        });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto_auto] items-start gap-2 px-2">
                <FormLabel>Ингредиент</FormLabel>
                <FormLabel className="w-28 text-center">Кол-во</FormLabel>
                <div className="w-9" />
            </div>
            {fields.map((field, index) => {
                const selectedIngredientId = watchedIngredients[index]?.ingredient_id;
                const selectedIngredient = ingredients?.find(ing => ing.id === selectedIngredientId);
                const unit = selectedIngredient ? translateUnit(selectedIngredient.baseUnit) : '';
                const isUnitBased = unit === 'штук';
                const countPlaceholder = isUnitBased ? '1, 2, 3 шт' : '1.123 кг/л';

                return (
                    <div key={field.id} className="grid grid-cols-[1fr_auto_auto] items-start gap-2 p-2 border rounded-md">
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
                            name={`ingredients.${index}.quantity`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input {...field} value={field.value || ''} type="text" inputMode="decimal" placeholder={countPlaceholder} className="w-28 text-right" />
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
                onClick={() => append({ ingredient_id: '', quantity: '' as unknown as number })}
            >
                Добавить ингредиент
            </Button>
        </div>

        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Комментарий (причина)</FormLabel>
              <FormControl>
                <Textarea placeholder="Например, порча продуктов..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" disabled={form.formState.isSubmitting || !ingredients}>
          {form.formState.isSubmitting ? 'Создание...' : 'Создать списание'}
        </Button>
      </form>
    </Form>
  );
}
