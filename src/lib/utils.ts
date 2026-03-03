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

export function formatNumberString(value: string): string {
  if (!value) return '';

  let cleanValue = value.replace(/[^0-9.]/g, '');
  const parts = cleanValue.split('.');
  
  if (parts.length > 2) {
    cleanValue = `${parts[0]}.${parts.slice(1).join('')}`;
  }
  const [integerPart, decimalPart] = cleanValue.split('.');

  const formattedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  if (decimalPart !== undefined) {
    return `${formattedIntegerPart}.${decimalPart}`;
  }

  return formattedIntegerPart;
}

export function parseFormattedNumber(value: string): number {
  return Number(value.replace(/\s/g, ''));
}
