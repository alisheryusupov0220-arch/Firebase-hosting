'use server';

import { format } from 'date-fns';
import { translateUnit } from './utils';

import { adminDb } from '@/firebase/server';

async function getPosterCredentials(orgId?: string) {
  // Try org-specific credentials from Firestore first
  if (orgId) {
    try {
      const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
      if (orgSnap.exists) {
        const data = orgSnap.data();
        const apiUrl = data?.posterApiUrl?.trim();
        const apiKey = data?.posterApiKey?.trim();
        if (apiUrl && apiKey) {
          return { apiUrl, apiKey };
        }
      }
    } catch (e) {
      console.error('[Poster] Failed to load org credentials from Firestore:', e);
    }
  }

  // Fallback to environment variables
  const apiUrl = process.env.POSTER_API_URL?.trim();
  const apiKey = process.env.POSTER_API_KEY?.trim();
  return { apiUrl: apiUrl || null, apiKey: apiKey || null };
}

/**
 * A robust function to interact with the Poster API.
 */
async function posterApiFetch(
  method: string,
  httpMethod: 'GET' | 'POST' = 'GET',
  payload: Record<string, any> = {},
  orgId?: string
) {
  const creds = await getPosterCredentials(orgId);
  const API_URL = creds.apiUrl;
  const API_KEY = creds.apiKey;

  if (!API_URL || !API_KEY) {
    const hint = orgId
      ? `Перейдите в Настройки → Интеграция с Poster и введите URL и токен для организации "${orgId}".`
      : 'Добавьте POSTER_API_URL и POSTER_API_KEY в .env.local или настройте через интерфейс Настроек.';
    throw new Error(`Poster API не настроен. ${hint}`);
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
    
    // Recursive flattener for Poster's PHP-style nested POST parameters
    const flatten = (obj: any, prefix = '') => {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key];
          const fullKey = prefix ? `${prefix}[${key}]` : key;
          
          if (Array.isArray(value)) {
            value.forEach((item, index) => {
               if (typeof item === 'object' && item !== null) {
                 flatten(item, `${fullKey}[${index}]`);
               } else {
                 postBody.append(`${fullKey}[${index}]`, String(item));
               }
            });
          } else if (typeof value === 'object' && value !== null) {
            flatten(value, fullKey);
          } else {
            postBody.append(fullKey, String(value));
          }
        }
      }
    };

    flatten(payload);
    options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    options.body = postBody;
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => {
      throw new Error(`Poster API returned a non-JSON response. Status: ${response.status}`);
    });

    if (data && data.error) {
      const errorMsg = data.message || data.error.message || `API Error ${data.error}`;
      console.error(`[Poster API Error] Method: ${method}, Error: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    return data.response === undefined ? data : data.response;
  } catch (error) {
    console.error(`[Poster API Exception] Method: ${method}:`, error);
    throw error;
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
    ingredient_unit: 'kg' | 'p' | 'l';
    ingredient_barcode: string;
    category_id: string;
    ingredient_left: string;
    limit_value: string;
    ingredient_weight: number;
    ingredients_losses_clear: string;
    ingredients_losses_cook: string;
    ingredients_type: string; // 1 - ingredient, 2 - system
    storage_id?: any;
    id_1c?: string;
    delete?: string;
    hidden?: string;
};

export type Product = {
    product_id: string;
    product_name: string;
    type: string;
    unit?: string;
    ingredient_id?: string;
    category_id?: string;
    storage_id?: any;
    composition?: {
        ingredient_id: string;
        type: string;
        brutto: string;
    }[];
    price?: Record<string, string>;
};

export type Supply = {
    supply_id: string;
    supplier_id: string;
    supplier_name: string;
    storage_id: string;
    date_created: string;
    supply_sum: string;
    supply_status: string;
    comment: string;
};

export async function getStorages(orgId?: string): Promise<Storage[]> {
    const data = await posterApiFetch('storage.getStorages', 'GET', {}, orgId);
    return Array.isArray(data) ? data : [];
}

export async function getIngredients(orgId?: string): Promise<Ingredient[]> {
    const data = await posterApiFetch('menu.getIngredients', 'GET', {}, orgId);
    return Array.isArray(data) ? data : [];
}

export async function getProducts(payload?: Record<string, any>, orgId?: string): Promise<Product[]> {
    const data = await posterApiFetch('menu.getProducts', 'GET', payload, orgId);
    return Array.isArray(data) ? data : [];
}

export async function getStorageFullBalance(storageId: string, orgId?: string): Promise<any[]> {
    const response = await posterApiFetch('storage.getStorageBalance', 'GET', {
        storage_id: storageId
    }, orgId);
    return Array.isArray(response) ? response : [];
}

export async function getSupplies(orgId?: string): Promise<Supply[]> {
    const data = await posterApiFetch('storage.getSupplies', 'GET', {}, orgId);
    return Array.isArray(data) ? data : [];
}

export async function getPosterSuppliers(orgId?: string): Promise<PosterSupplier[]> {
    const data = await posterApiFetch('storage.getSuppliers', 'GET', {}, orgId);
    return Array.isArray(data) ? data : [];
}

export async function getWastes(orgId?: string): Promise<any[]> {
    const data = await posterApiFetch('storage.getWastes', 'GET', {}, orgId);
    return Array.isArray(data) ? data : [];
}

export async function createSupply(data: any, orgId?: string): Promise<string | null> {
    const response = await posterApiFetch('storage.createSupply', 'POST', data, orgId);
    return response ? String(response) : null;
}

export async function createWriteOff(data: any, orgId?: string): Promise<string | null> {
    const response = await posterApiFetch('storage.createWriteOff', 'POST', data, orgId);
    return response ? String(response) : null;
}

export async function createIngredientInPoster(name: string, unit: string = 'кг', orgId?: string): Promise<string | null> {
    try {
        const response = await posterApiFetch('menu.createIngredient', 'POST', {
            ingredient_name: name,
            ingredient_unit: unit,
            category_id: "1" // Default category ID
        }, orgId);
        return response ? String(response) : null;
    } catch (e: any) {
        console.warn('[createIngredientInPoster] failed with default category "1", trying to fetch categories:', e.message || e);
        try {
            const categories = await posterApiFetch('menu.getCategories', 'GET', {}, orgId);
            if (categories && categories.length > 0) {
                const firstCategoryId = String(categories[0].category_id);
                console.log(`[createIngredientInPoster] Found valid Poster category: ${firstCategoryId} (${categories[0].category_name || 'No Name'})`);
                const response = await posterApiFetch('menu.createIngredient', 'POST', {
                    ingredient_name: name,
                    ingredient_unit: unit,
                    category_id: firstCategoryId
                }, orgId);
                return response ? String(response) : null;
            }
        } catch (catErr: any) {
            console.error('[createIngredientInPoster] failed to resolve category from menu.getCategories:', catErr.message || catErr);
        }
        return null;
    }
}

export type CreateSupplyData = {
    supply: {
        date: string;
        supplier_id: string;
        storage_id: string;
        supply_comment?: string;
    };
    ingredient: {
        id: string;
        type: string;
        num: string;
        price: string;
    }[];
    products?: {
        product_id: string;
        type: string;
        num: string;
        price: string;
    }[];
};

export type CreateWriteOffData = {
    write_off: {
        date: string;       // "Y-m-d H:i:s"
        storage_id: string;
        reason?: string;
    };
    ingredient?: {
        id: string;
        type: string; 
        weight: string;
    }[];
    products?: {
        product_id: string;
        type: string;
        weight: string;
    }[];
};

export type Waste = {
    waste_id: string;
    date: string;
    reason_name?: string;
    total_sum: string;
};
