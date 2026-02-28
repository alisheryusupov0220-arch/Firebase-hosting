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
import { requestSupplyAction } from '@/app/supplies/actions';
import { useToast } from '@/hooks/use-toast';
import React from 'react';
import { Combobox } from '../ui/combobox';
import { useUser } from '@/firebase/hooks';
import type { LocalIngredient } from '@/app/ingredients/actions';

const formSchema = z.object({
  comment: z.string().optional(),
  ingredients: z.array(z.object({
    ingredient_id: z.string().min(1, 'Нужно выбрать ингредиент'),
    count: z.coerce.number().min(0.001, 'Количество должно быть больше 0'),
    price: z.coerce.number().min(0, 'Цена не может быть отрицательной'),
  })).min(1, 'Нужно добавить хотя бы один ингредиент'),
});

type CreateSupplyFormProps = {
  ingredients: LocalIngredient[] | null;
  onFormSubmitted: () => void;
};

const DEFAULT_SUPPLIER_ID = 1;


export function CreateSupplyForm({ ingredients, onFormSubmitted }: CreateSupplyFormProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      comment: '',
      ingredients: [{ ingredient_id: '', count: 1, price: 0 }],
    },
  });
  
  const ingredientOptions = React.useMemo(() => {
    return (ingredients || []).map(ing => ({
      value: String(ing.id),
      label: ing.name || 'Без названия'
    }));
  }, [ingredients]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'ingredients',
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
        toast({
            variant: 'destructive',
            title: 'Ошибка!',
            description: 'Вы должны быть авторизованы для выполнения этого действия.',
        });
        return;
    }
    
    const finalComment = `Сотрудник: ${user.email}. ${values.comment || ''}`.trim();

    const firstIngredientId = values.ingredients[0]?.ingredient_id;
    const firstIngredient = ingredients?.find(i => i.id === firstIngredientId);
    const storageId = firstIngredient?.storage_id ? Number(firstIngredient.storage_id) : 1;

    const result = await requestSupplyAction({
      supplier_id: DEFAULT_SUPPLIER_ID,
      storage_id: storageId,
      comment: finalComment,
      ingredients: values.ingredients.map(ing => ({
        ingredient_id: Number(ing.ingredient_id),
        count: ing.count,
        price: ing.price,
      })),
      requesterId: user.uid,
      requesterName: user.email || 'Пользователь без email',
    });

    if (result.success) {
      toast({
        title: 'Успех!',
        description: 'Заявка на поставку отправлена на утверждение.',
      });
      onFormSubmitted();
      form.reset();
    } else {
      toast({
        variant: 'destructive',
        title: 'Ошибка!',
        description: result.message || 'Не удалось создать заявку.',
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
            <FormLabel>Ингредиенты</FormLabel>
            {fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-2 p-2 border rounded-md">
                   <FormField
                      control={form.control}
                      name={`ingredients.${index}.ingredient_id`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Combobox
                              options={ingredientOptions}
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Выберите ингредиент"
                              searchPlaceholder="Поиск..."
                              notFoundMessage="Ингредиент не найден."
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
                                    <Input {...field} type="number" step="0.001" placeholder="Кол-во" className="w-24" />
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
                                        type="number"
                                        step="0.01"
                                        placeholder="Цена"
                                        className="w-24 text-right"
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
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => append({ ingredient_id: '', count: 1, price: 0 })}
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
          {form.formState.isSubmitting ? 'Отправка...' : 'Отправить на утверждение'}
        </Button>
      </form>
    </Form>
  );
}
