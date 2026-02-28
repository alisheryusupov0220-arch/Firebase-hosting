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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Trash } from 'lucide-react';
import type { Ingredient, Storage } from '@/lib/poster';
import { createWriteOffAction } from '@/app/write-offs/actions';
import { useToast } from '@/hooks/use-toast';
import { Combobox } from '../ui/combobox';

type Employee = {
  id: string;
  name: string;
};

const formSchema = z.object({
  storage_id: z.string().min(1, 'Нужно выбрать склад'),
  employee_id: z.string().min(1, 'Нужно выбрать сотрудника'),
  comment: z.string().optional(),
  ingredients: z.array(z.object({
    ingredient_id: z.string().min(1, 'Нужно выбрать ингредиент'),
    quantity: z.coerce.number().min(0.001, 'Количество должно быть больше 0'),
  })).min(1, 'Нужно добавить хотя бы один ингредиент'),
});

type CreateWriteOffFormProps = {
  storages: Storage[];
  ingredients: Ingredient[];
  employees: Employee[];
  onFormSubmitted: () => void;
};

export function CreateWriteOffForm({ storages, ingredients, employees, onFormSubmitted }: CreateWriteOffFormProps) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      storage_id: '',
      employee_id: '',
      comment: '',
      ingredients: [{ ingredient_id: '', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'ingredients',
  });
  
  const ingredientOptions = useMemo(() =>
    ingredients.map(ing => ({
      value: String(ing.ingredient_id),
      label: `${ing.ingredient_name} (${ing.ingredient_unit})`,
    })),
  [ingredients]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const employee = employees.find(e => e.id === values.employee_id);
    if (!employee) {
        toast({ variant: 'destructive', title: 'Ошибка!', description: 'Выбранный сотрудник не найден.' });
        return;
    }

    const finalComment = `Сотрудник: ${employee.name}. ${values.comment || ''}`.trim();

    const result = await createWriteOffAction({
      storage_id: Number(values.storage_id),
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
        <div className="grid grid-cols-2 gap-4">
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
                      <SelectItem key={storage.storage_id} value={String(storage.storage_id)}>
                        {storage.storage_name}
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
            name="employee_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Сотрудник</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите сотрудника" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="space-y-2">
            <FormLabel>Ингредиенты для списания</FormLabel>
            {fields.map((field, index) => {
                return (
                    <div key={field.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-end p-2 border rounded-md">
                       <Controller
                          control={form.control}
                          name={`ingredients.${index}.ingredient_id`}
                          render={({ field: controllerField, fieldState }) => (
                              <FormItem className="flex flex-col gap-1.5">
                                {index === 0 && <FormLabel className="text-xs">Ингредиент</FormLabel>}
                                 <Combobox
                                    options={ingredientOptions}
                                    value={controllerField.value}
                                    onChange={(value) => {
                                      controllerField.onChange(value === null ? '' : String(value));
                                    }}
                                    placeholder="Выберите ингредиент..."
                                    searchPlaceholder="Поиск..."
                                    notFoundMessage="Не найден."
                                  />
                                <FormMessage>{fieldState.error?.message}</FormMessage>
                              </FormItem>
                          )}
                        />
                        <FormField
                            control={form.control}
                            name={`ingredients.${index}.quantity`}
                            render={({ field: formField }) => (
                                <FormItem className="flex flex-col gap-1.5">
                                    {index === 0 && <FormLabel className="text-xs">Количество</FormLabel>}
                                    <FormControl>
                                        <Input {...formField} type="number" step="0.001" placeholder="Кол-во" className="w-32" />
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
        
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Отправка...' : 'Создать списание'}
        </Button>
      </form>
    </Form>
  );
}
