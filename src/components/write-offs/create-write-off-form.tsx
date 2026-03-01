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
import { useUser, useFirestore } from '@/firebase/hooks';
import type { LocalIngredient } from '@/app/ingredients/actions';
import { SearchableSelect } from '../ui/searchable-select';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { translateUnit } from '@/lib/utils';

const formSchema = z.object({
  comment: z.string().optional(),
  ingredients: z.array(z.object({
    ingredient_id: z.string().min(1, 'Нужно выбрать ингредиент'),
    quantity: z.string().min(1, 'Введите кол-во').pipe(z.coerce.number().positive('Кол-во > 0')),
  })).min(1, 'Нужно добавить хотя бы один ингредиент'),
});

type CreateWriteOffFormValues = z.infer<typeof formSchema>;

type CreateWriteOffFormProps = {
  ingredients: LocalIngredient[] | null;
  onFormSubmitted: () => void;
};

export function CreateWriteOffForm({ ingredients, onFormSubmitted }: CreateWriteOffFormProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const form = useForm<CreateWriteOffFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      comment: '',
      ingredients: [{ ingredient_id: '', quantity: '' }],
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
    if (!user || !firestore) {
        toast({ variant: 'destructive', title: 'Ошибка!', description: 'Вы должны быть авторизованы.' });
        return;
    }

    const finalComment = `Сотрудник: ${user.email}. ${values.comment || ''}`.trim();

    const firstIngredientId = values.ingredients[0]?.ingredient_id;
    const firstIngredient = ingredients?.find(i => i.id === firstIngredientId);
    const storageId = firstIngredient?.storage_id ? Number(firstIngredient.storage_id) : 1;

    const writeOffRequestData = {
      storage_id: storageId,
      comment: finalComment,
      ingredients: values.ingredients.map(ing => ({
        ingredient_id: Number(ing.ingredient_id),
        quantity: ing.quantity,
      })),
      requesterId: user.uid,
      requesterName: user.email || 'Пользователь без email',
      status: 'pending',
      createdAt: serverTimestamp(),
    };

    const pendingWriteOffsCollection = collection(firestore, 'pendingWriteOffs');

    addDoc(pendingWriteOffsCollection, writeOffRequestData)
      .then(() => {
          toast({
              title: 'Успех!',
              description: 'Заявка на списание отправлена на утверждение.',
          });
          onFormSubmitted();
          form.reset();
      })
      .catch((error) => {
          console.error("Error creating write-off request:", error);
          const permissionError = new FirestorePermissionError({
              path: pendingWriteOffsCollection.path,
              operation: 'create',
              requestResourceData: writeOffRequestData,
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({
              variant: 'destructive',
              title: 'Ошибка создания заявки',
              description: 'Недостаточно прав для выполнения операции. Убедитесь, что у вас есть права на создание заявок.'
          });
      });
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
                const unit = selectedIngredient ? translateUnit(selectedIngredient.unit) : 'кг/л/шт';
                const isUnitBased = unit === 'штук';
                const countPlaceholder = isUnitBased ? 'шт' : 'кг/л';
                const countStep = isUnitBased ? '1' : '0.001';

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
                                        <Input {...field} value={field.value || ''} type="number" step={countStep} placeholder={countPlaceholder} className="w-28 text-right" />
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
                onClick={() => append({ ingredient_id: '', quantity: '' })}
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
          {form.formState.isSubmitting ? 'Отправка...' : 'Отправить на утверждение'}
        </Button>
      </form>
    </Form>
  );
}
