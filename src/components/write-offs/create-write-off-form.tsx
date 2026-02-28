'use client';

import React, { useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
import { createWriteOffAction } from '@/app/write-offs/actions';
import { useToast } from '@/hooks/use-toast';
import { Combobox } from '../ui/combobox';
import { useUser } from '@/firebase/hooks';
import type { LocalIngredient } from '@/app/ingredients/actions';

const formSchema = z.object({
  comment: z.string().optional(),
  ingredients: z.array(z.object({
    ingredient_id: z.string().min(1, 'Нужно выбрать ингредиент'),
    quantity: z.coerce.number().min(0.001, 'Количество должно быть больше 0'),
  })).min(1, 'Нужно добавить хотя бы один ингредиент'),
});

type CreateWriteOffFormProps = {
  ingredients: LocalIngredient[] | null;
  onFormSubmitted: () => void;
};

const DEFAULT_STORAGE_ID = 1;

export function CreateWriteOffForm({ ingredients, onFormSubmitted }: CreateWriteOffFormProps) {
  const { toast } = useToast();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      comment: '',
      ingredients: [{ ingredient_id: '', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'ingredients',
  });
  
  const ingredientOptions = useMemo(() =>
    ingredients
      ? ingredients.map(ing => ({
        value: String(ing.id),
        label: `${ing.name} (${ing.unit})`,
      }))
      : [],
  [ingredients]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
        toast({ variant: 'destructive', title: 'Ошибка!', description: 'Вы должны быть авторизованы.' });
        return;
    }

    const finalComment = `Сотрудник: ${user.email}. ${values.comment || ''}`.trim();

    const firstIngredientId = values.ingredients[0]?.ingredient_id;
    const firstIngredient = ingredients?.find(i => i.id === firstIngredientId);
    const storageId = firstIngredient?.storage_id ? Number(firstIngredient.storage_id) : DEFAULT_STORAGE_ID;

    const result = await createWriteOffAction({
      storage_id: storageId,
      comment: finalComment,
      ingredients: values.ingredients.map(ing => ({
        ingredient_id: Number(ing.ingredient_id),
        num: ing.quantity,
      }))
    });

    if (result.success) {
      toast({
        title: 'Успех!',
        description: 'Списание успешно создано и отправлено в Poster.',
      });
      onFormSubmitted();
      form.reset();
    } else {
      toast({
        variant: 'destructive',
        title: 'Ошибка!',
        description: result.message || 'Не удалось создать списание.',
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
            <FormLabel>Ингредиенты для списания</FormLabel>
            {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_auto_auto] items-end gap-2 p-2 border rounded-md">
                   <div className="flex flex-col">
                      {index === 0 && <FormLabel className="text-xs">Ингредиент</FormLabel>}
                      <Controller
                        control={form.control}
                        name={`ingredients.${index}.ingredient_id`}
                        render={({ field: controllerField, fieldState }) => (
                            <FormItem>
                               <Combobox
                                  options={ingredientOptions}
                                  value={controllerField.value}
                                  onChange={(value) => {
                                    controllerField.onChange(value === null ? '' : String(value));
                                  }}
                                  placeholder="Выберите ингредиент..."
                                  searchPlaceholder="Поиск ингредиента..."
                                  notFoundMessage="Ингредиент не найден."
                                />
                              <FormMessage>{fieldState.error?.message}</FormMessage>
                            </FormItem>
                        )}
                      />
                   </div>
                    <FormField
                        control={form.control}
                        name={`ingredients.${index}.quantity`}
                        render={({ field }) => (
                            <FormItem>
                                {index === 0 && <FormLabel className="text-xs">Количество</FormLabel>}
                                <FormControl>
                                    <Input {...field} type="number" step="0.001" placeholder="Кол-во" className="w-24" />
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
                onClick={() => append({ ingredient_id: '', quantity: 1 })}
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
          {form.formState.isSubmitting ? 'Отправка...' : 'Создать списание'}
        </Button>
      </form>
    </Form>
  );
}
