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
        'l': 'литр',
        'liter': 'литр',
        'мл': 'мл',
        'ml': 'мл',
        'milliliter': 'мл',
        'шт': 'штук',
        'pcs': 'штук',
        'piece': 'штук',
        'unit': 'штук',
        'p': 'штук'
    };
    return map[lowerUnit] || unit;
}
