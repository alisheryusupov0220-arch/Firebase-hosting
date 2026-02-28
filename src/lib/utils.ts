import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function translateUnit(unit: string | null | undefined): string {
    if (!unit) return '-';
    const lowerUnit = unit.toLowerCase().trim();
    const map: Record<string, string> = {
        'kg': 'кг',
        'kilogram': 'кг',
        'г': 'г',
        'g': 'г',
        'gram': 'г',
        'l': 'л',
        'liter': 'л',
        'мл': 'мл',
        'ml': 'мл',
        'milliliter': 'мл',
        'шт': 'шт',
        'pcs': 'шт',
        'piece': 'шт',
        'unit': 'шт',
    };
    return map[lowerUnit] || unit;
}
