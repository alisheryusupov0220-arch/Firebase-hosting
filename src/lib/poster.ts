
import { format } from 'date-fns';

const API_URL = process.env.POSTER_API_URL;
const API_KEY = process.env.POSTER_API_KEY;

async function posterApiFetch(
  method: string,
  httpMethod: 'GET' | 'POST',
  payload: Record<string, any> = {}
) {
  if (!API_URL || !API_KEY) {
    console.error('Poster API URL or Key is not configured in .env.local');
    // Return empty array to prevent crashes on map/filter etc.
    return [];
  }

  // Token is always in the URL query string
  const url = `${API_URL}${method}?format=json&token=${API_KEY}`;
  
  const options: RequestInit = {
    method: httpMethod,
    headers: {},
  };

  if (httpMethod === 'POST') {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(payload);
  } else { // GET
     // For GET requests, additional parameters can be added if needed in the future
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Poster API request failed for method ${method}:`, {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
      });
      throw new Error(`Poster API request failed with status ${response.status}`);
    }

    const data = await response.json();

    // Handle Poster's specific error formats
    if (data.error) {
       // A "real" error from Poster will have properties inside the error object.
       if (typeof data.error === 'object' && data.error !== null && (data.error.message || data.error.code)) {
         console.error(`Poster API error for method ${method}:`, data.error);
         const message = data.error.message || 'No message provided.';
         const code = data.error.code || 'N/A';
         throw new Error(`Poster API error: ${message} (code: ${code})`);
       }
       // If it's not a real error (e.g., an empty object {}), we warn and treat as empty response.
       console.warn(`Poster API for method ${method} returned a non-fatal error object, treating as empty response:`, data.error);
       return false;
    }
    
    // `response: false` is often a valid "not found" or "empty" response.
    if (data.response === false) {
      return [];
    }
    
    return data.response;

  } catch (error) {
      console.error(`An error occurred during fetch for method ${method}:`, error);
      throw error;
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
  try {
    const response = await posterApiFetch('storage.getSupplies', 'GET');
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error("Failed to fetch supplies:", error);
    return [];
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
    try {
        const response = await posterApiFetch('storage.getStorages', 'GET');
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error("Failed to fetch storages:", error);
        return [];
    }
}

export async function getPosterSuppliers(): Promise<PosterSupplier[]> {
    try {
        const response = await posterApiFetch('storage.getSuppliers', 'GET');
        return Array.isArray(response) ? response : [];
    } catch (error)
 {
        console.error("Failed to fetch suppliers:", error);
        return [];
    }
}

export async function getIngredients(): Promise<Ingredient[]> {
    try {
        const response = await posterApiFetch('menu.getIngredients', 'GET');
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error("Failed to fetch ingredients:", error);
        return [];
    }
}

export async function createSupply(data: CreateSupplyData) {
    // This payload structure is based on the user's provided Google Apps Script example.
    const payload = {
      supply: {
        supplier_id: data.supplier_id,
        storage_id: data.storage_id,
        date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        // Note: The provided script does not send a comment for supplies, so we omit it here.
        // If the API supports it, `comment: data.comment` could be added.
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
