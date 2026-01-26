'use client';

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
import { ChevronsUpDown, Trash } from 'lucide-react';
import type { Ingredient, PosterSupplier, Storage } from '@/lib/poster';
import { requestSupplyAction } from '@/app/(app)/supplies/actions';
import { useToast } from '@/hooks/use-toast';
import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type Employee = {
  id: string;
  name: string;
};

const formSchema = z.object({
  supplier_id: z.string().min(1, 'Нужно выбрать поставщика'),
  storage_id: z.string().min(1, 'Нужно выбрать склад'),
  employee_id: z.string().min(1, 'Нужно выбрать сотрудника'),
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
  employees: Employee[];
  onFormSubmitted: () => void;
};


function IngredientCombobox({ ingredients, value, onChange }: { ingredients: Ingredient[]; value: string; onChange: (value: string) => void; }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedIngredientName = value ? ingredients.find((ing) => ing.ingredient_id === value)?.ingredient_name : "";

  const filteredIngredients = React.useMemo(() => {
    if (!search) return ingredients;
    return ingredients.filter((ing) =>
      ing.ingredient_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, ingredients]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {value ? selectedIngredientName : "Выберите..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        onMouseDown={(e) => {
          e.preventDefault();
        }}
      >
        <div className="p-2">
          <Input
            placeholder="Поиск ингредиента..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </div>
        <ScrollArea className="h-48">
          {filteredIngredients.length > 0 ? (
            filteredIngredients.map((ing) => (
              <div
                key={ing.ingredient_id}
                onClick={() => {
                  onChange(String(ing.ingredient_id));
                  setOpen(false);
                }}
                className={cn(
                  "p-2 text-sm hover:bg-accent cursor-pointer",
                  ing.ingredient_id === value && "bg-accent"
                )}
              >
                {ing.ingredient_name} ({ing.ingredient_unit})
              </div>
            ))
          ) : (
             <div className="p-2 text-sm text-center text-muted-foreground">Ингредиент не найден.</div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}


export function CreateSupplyForm({ suppliers, storages, ingredients, employees, onFormSubmitted }: CreateSupplyFormProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplier_id: '',
      storage_id: '',
      employee_id: '',
      comment: '',
      ingredients: [{ ingredient_id: '', count: 1, price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'ingredients',
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const employee = employees.find(e => e.id === values.employee_id);
    if (!employee) {
        toast({
            variant: 'destructive',
            title: 'Ошибка!',
            description: 'Выбранный сотрудник не найден.',
        });
        return;
    }
    
    const finalComment = `Сотрудник: ${employee.name}. ${values.comment || ''}`.trim();

    const result = await requestSupplyAction({
      supplier_id: Number(values.supplier_id),
      storage_id: Number(values.storage_id),
      comment: finalComment,
      ingredients: values.ingredients.map(ing => ({
        ingredient_id: Number(ing.ingredient_id),
        count: ing.count,
        price: ing.price,
      })),
      requesterId: employee.id,
      requesterName: employee.name,
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
        <div className="grid grid-cols-2 gap-4">
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
                      <SelectItem key={supplier.supplier_id} value={String(supplier.supplier_id)}>
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
        </div>
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


        <div className="space-y-2">
            <FormLabel>Ингредиенты</FormLabel>
            {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end p-2 border rounded-md">
                   <Controller
                      control={form.control}
                      name={`ingredients.${index}.ingredient_id`}
                      render={({ field: controllerField, fieldState }) => (
                          <FormItem>
                          {index === 0 && <FormLabel className="text-xs">Ингредиент</FormLabel>}
                           <IngredientCombobox
                              ingredients={ingredients}
                              value={controllerField.value}
                              onChange={controllerField.onChange}
                           />
                          <FormMessage>{fieldState.error?.message}</FormMessage>
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
                                    <Input
                                        {...field}
                                        type="text"
                                        placeholder="Цена"
                                        className="w-24 text-right"
                                        value={field.value ? new Intl.NumberFormat('ru-RU').format(field.value) : ''}
                                        onChange={(e) => {
                                            const rawValue = e.target.value.replace(/\s/g, '').replace(',', '.');
                                            if (rawValue === '' || /^\d*\.?\d*$/.test(rawValue)) {
                                                field.onChange(rawValue);
                                            }
                                        }}
                                        onBlur={(e) => {
                                            const rawValue = e.target.value.replace(/\s/g, '').replace(',', '.');
                                            const numValue = parseFloat(rawValue);
                                            field.onChange(isNaN(numValue) ? '' : numValue);
                                            field.onBlur();
                                        }}
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
        
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Отправка...' : 'Отправить на утверждение'}
        </Button>
      </form>
    </Form>
  );
}
