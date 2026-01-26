
import { format } from 'date-fns';

const API_URL = process.env.POSTER_API_URL;
const API_KEY = process.env.POSTER_API_KEY;

async function posterApiFetch(
  method: string,
  httpMethod: 'GET' | 'POST',
  payload: Record<string, any> = {}
) {
  if (!API_URL || !API_KEY) {
    console.error('Poster API URL or Key is not configured in .env.local.');
    return httpMethod === 'POST' ? { error: { message: 'API not configured' } } : [];
  }

  const url = `${API_URL}${method}?token=${encodeURIComponent(API_KEY)}`;
  
  const options: RequestInit = {
    method: httpMethod,
    headers: {},
    // Disable caching for server-side fetches to ensure fresh data.
    // This is crucial for Next.js App Router.
    cache: 'no-store',
  };

  if (httpMethod === 'POST' && Object.keys(payload).length > 0) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(payload);
  }

  try {
    const response = await fetch(url, options);
    
    // It's possible to get a non-JSON response on failure (e.g. HTML error page).
    const responseText = await response.text();
    
    if (!response.ok) {
        console.error(`Poster API request failed for method ${method}:`, {
            status: response.status,
            statusText: response.statusText,
            body: responseText,
        });
        // For POST, we want to return an object that the action can parse for an error message
        return httpMethod === 'POST' ? { error: { message: `API Error: ${response.status} ${response.statusText}` } } : [];
    }

    const data = JSON.parse(responseText);

    // This handles cases like { "response": false } or { "error": { ... } }
    // The user's script showed that `response` can be the data or `false`.
    if (data.response === false || data.error) {
       console.warn(`Poster API for method ${method} returned a non-successful response:`, data);
       
       // For createSupply, the action needs the specific error details.
       if (method === 'storage.createSupply' && data.error) {
           return data;
       }
       // For all other cases, especially GET requests, returning an empty array is safe.
       return [];
    }
    
    // Success case: return the actual data payload.
    return data.response;

  } catch (error) {
      console.error(`A network or parsing error occurred during fetch for method ${method}:`, error);
      return httpMethod === 'POST' ? { error: { message: 'Network or parsing error' } } : [];
  }
}


export type Supply = {
    supply_id: string;
    supplier_id: string;
    supplier_name: string;
    supply_status: string; // 1 - open, 2 - closed
    supply_sum: string;
    supply_payed_sum: string;
    date_created: string; // YYYY-MM-DD HH:mm:ss
    comment: string;
};


export async function getSupplies(): Promise<Supply[]> {
  const response = await posterApiFetch('storage.getSupplies', 'GET');
  return Array.isArray(response) ? response : [];
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

export type NewSupplyIngredient = {
    ingredient_id: number;
    count: number;
    price: number;
};

export type CreateSupplyData = {
    supplier_id: number;
    storage_id: number;
    comment?: string;
    ingredients: NewSupplyIngredient[];
};


export async function getStorages(): Promise<Storage[]> {
    const response = await posterApiFetch('storage.getStorages', 'GET');
    return Array.isArray(response) ? response : [];
}

export async function getPosterSuppliers(): Promise<PosterSupplier[]> {
    const response = await posterApiFetch('storage.getSuppliers', 'GET');
    return Array.isArray(response) ? response : [];
}

export async function getIngredients(): Promise<Ingredient[]> {
    const response = await posterApiFetch('menu.getIngredients', 'GET');
    return Array.isArray(response) ? response : [];
}

export async function createSupply(data: CreateSupplyData) {
    const payload = {
      supply: {
        supplier_id: data.supplier_id,
        storage_id: data.storage_id,
        date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      },
      ingredient: data.ingredients.map(ing => ({
        id: String(ing.ingredient_id),
        num: String(ing.count),
        type: "4", // As per the user's example script
        price: String(ing.price)
      }))
    };
    
    return posterApiFetch('storage.createSupply', 'POST', payload);
}
