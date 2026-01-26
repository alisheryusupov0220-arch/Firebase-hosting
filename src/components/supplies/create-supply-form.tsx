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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Trash } from 'lucide-react';
import type { Ingredient, PosterSupplier, Storage } from '@/lib/poster';
import { createSupplyAction } from '@/app/(app)/supplies/actions';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  supplier_id: z.string().min(1, 'Нужно выбрать поставщика'),
  storage_id: z.string().min(1, 'Нужно выбрать склад'),
  comment: z.string().optional(),
  ingredients: z.array(z.object({
    ingredient_id: z.string().min(1, 'Нужно выбрать ингредиент'),
    count: z.coerce.number().min(0.001, 'Количество должно быть больше 0'),
    price: z.coerce.number().min(0, 'Цена не может быть отрицательной'),
  })).min(1, 'Нужно добавить хотя бы один ингредиент'),
});

type CreateSupplyFormProps = {
  suppliers: PosterSupplier[];
  storages: Storage[];
  ingredients: Ingredient[];
  onFormSubmitted: () => void;
};

export function CreateSupplyForm({ suppliers, storages, ingredients, onFormSubmitted }: CreateSupplyFormProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplier_id: '',
      storage_id: '',
      comment: '',
      ingredients: [{ ingredient_id: '', count: 1, price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'ingredients',
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const result = await createSupplyAction({
      supplier_id: Number(values.supplier_id),
      storage_id: Number(values.storage_id),
      comment: values.comment,
      ingredients: values.ingredients.map(ing => ({
        ingredient_id: Number(ing.ingredient_id),
        count: ing.count,
        price: ing.price,
      }))
    });

    if (result.success) {
      toast({
        title: 'Успех!',
        description: 'Поставка была успешно создана.',
      });
      onFormSubmitted();
      form.reset();
    } else {
      toast({
        variant: 'destructive',
        title: 'Ошибка!',
        description: result.message || 'Не удалось создать поставку.',
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="supplier_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Поставщик</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите поставщика" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.supplier_id} value={supplier.supplier_id}>
                      {supplier.supplier_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите склад" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {storages.map((storage) => (
                    <SelectItem key={storage.storage_id} value={storage.storage_id}>
                      {storage.storage_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
            <FormLabel>Ингредиенты</FormLabel>
            {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end p-2 border rounded-md">
                    <FormField
                    control={form.control}
                    name={`ingredients.${index}.ingredient_id`}
                    render={({ field }) => (
                        <FormItem>
                        {index === 0 && <FormLabel className="text-xs">Ингредиент</FormLabel>}
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Выберите..." />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {ingredients.map((ing) => (
                                <SelectItem key={ing.ingredient_id} value={ing.ingredient_id}>
                                    {ing.ingredient_name} ({ing.ingredient_unit})
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                        control={form.control}
                        name={`ingredients.${index}.count`}
                        render={({ field }) => (
                            <FormItem>
                                {index === 0 && <FormLabel className="text-xs">Кол-во</FormLabel>}
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
                                {index === 0 && <FormLabel className="text-xs">Цена за ед.</FormLabel>}
                                <FormControl>
                                    <Input {...field} type="number" step="0.01" placeholder="Цена" className="w-24" />
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
        
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Создание...' : 'Создать поставку'}
        </Button>
      </form>
    </Form>
  );
}
