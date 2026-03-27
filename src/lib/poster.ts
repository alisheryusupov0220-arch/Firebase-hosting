'use server';

import { format } from 'date-fns';
import { translateUnit } from './utils';

const API_URL = process.env.POSTER_API_URL;
const API_KEY = process.env.POSTER_API_KEY;

/**
 * A robust function to interact with the Poster API.
 */
async function posterApiFetch(
  method: string,
  httpMethod: 'GET' | 'POST' = 'GET',
  payload: Record<string, any> = {}
) {
  if (!API_URL || !API_KEY) {
    throw new Error('Poster API URL or Key is not configured in environment variables.');
  }

  const queryParams = new URLSearchParams({
    token: API_KEY,
    format: 'json',
  });

  if (httpMethod === 'GET') {
    for (const key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        queryParams.append(key, String(payload[key]));
      }
    }
  }

  const url = `${API_URL}/${method}?${queryParams.toString()}`;

  const options: RequestInit = {
    method: httpMethod,
    headers: {},
    cache: 'no-store',
  };

  if (httpMethod === 'POST' && Object.keys(payload).length > 0) {
    const postBody = new URLSearchParams();
    for (const key in payload) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
            const value = payload[key];
            if (Array.isArray(value)) {
                value.forEach((item, index) => {
                    if (typeof item === 'object' && item !== null) {
                        for (const itemKey in item) {
                            if (Object.prototype.hasOwnProperty.call(item, itemKey)) {
                                postBody.append(`${key}[${index}][${itemKey}]`, String(item[itemKey]));
                            }
                        }
                    }
                });
            } else if (typeof value === 'object' && value !== null) {
                for (const subKey in value) {
                    if (Object.prototype.hasOwnProperty.call(value, subKey)) {
                         postBody.append(`${key}[${subKey}]`, String(value[subKey]));
                    }
                }
            } else {
                postBody.append(key, String(value));
            }
        }
    }
    options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    options.body = postBody;
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => {
      throw new Error(`Poster API returned a non-JSON response. Status: ${response.status}`);
    });

    if (data && data.error && (data.error.message || data.error.code)) {
      console.error(`[Poster API Error] Method: ${method}, Error: ${data.message || data.error}`);
      return null;
    }

    return data.response === undefined ? data : data.response;
  } catch (error) {
    console.error(`[Poster Network/Crash Error] Method: ${method}, Message:`, error);
    return null;
  }
}

export type Storage = {
    storage_id: string;
    storage_name: string;
};

export type PosterSupplier = {
    supplier_id: string;
    supplier_name: string;
};

export type Ingredient = {
    ingredient_id: string;
    ingredient_name: string;
    ingredient_unit: string;
};

export type Product = {
    product_id: string;
    product_name: string;
    type: string;
    unit?: string;
    ingredient_id?: string;
};

export async function getStorages(): Promise<Storage[]> {
    const data = await posterApiFetch('storage.getStorages');
    return Array.isArray(data) ? data : [];
}

export async function getIngredients(): Promise<Ingredient[]> {
    const data = await posterApiFetch('menu.getIngredients');
    return Array.isArray(data) ? data : [];
}

export async function getProducts(): Promise<Product[]> {
    const data = await posterApiFetch('menu.getProducts');
    return Array.isArray(data) ? data : [];
}

export async function getStorageFullBalance(storageId: string): Promise<any[]> {
    const response = await posterApiFetch('storage.getStorageBalance', 'GET', {
        storage_id: storageId
    });
    return Array.isArray(response) ? response : [];
}

export async function createSupply(data: any): Promise<string | null> {
    const response = await posterApiFetch('storage.createSupply', 'POST', data);
    return response ? String(response) : null;
}

export type CreateSupplyData = {
    supplier_id: number;
    storage_id: number;
    comment?: string;
    ingredients: {
        ingredient_id: number;
        count: number;
        price: number;
        type: number;
        unit: string;
    }[];
};
