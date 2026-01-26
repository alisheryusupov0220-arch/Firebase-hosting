import { format } from 'date-fns';

const API_URL = process.env.POSTER_API_URL;
const API_KEY = process.env.POSTER_API_KEY;

// This function is now remodeled to be much more robust, based on the user's provided Apps Script.
// It will always try to parse the JSON response to get a meaningful error message from the API.
async function posterApiFetch(
  method: string,
  httpMethod: 'GET' | 'POST',
  payload: Record<string, any> = {}
) {
  if (!API_URL || !API_KEY) {
    throw new Error('Poster API URL or Key is not configured in environment variables.');
  }

  const url = `${API_URL}${method}?token=${encodeURIComponent(API_KEY)}`;
  
  const options: RequestInit = {
    method: httpMethod,
    headers: {},
    cache: 'no-store',
  };

  if (httpMethod === 'POST' && Object.keys(payload).length > 0) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(payload);
  }

  const response = await fetch(url, options);
  const responseText = await response.text();
  
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    // If parsing fails, it's a network or server-side issue, not a logical API error.
    throw new Error(`Poster API network error: ${response.status} ${response.statusText}. Failed to parse JSON response: ${responseText}`);
  }

  // Check for logical API errors or non-successful HTTP status.
  // The API might return a 200 OK but with an error in the body, or a non-200 status with an error body.
  if (!response.ok || data.response === false || data.error) {
    // Try to get a meaningful error message from the JSON payload.
    const apiErrorDetails = data.error ? JSON.stringify(data.error) : `response was '${data.response}'`;
    // If there's an error object in the JSON, use it; otherwise, fall back to the HTTP status.
    const errorMessage = data.error ? apiErrorDetails : `${response.status} ${response.statusText}`;

    throw new Error(`Poster API error for method ${method}: ${errorMessage}`);
  }
  
  // If we're here, the request was successful and the response is valid.
  return data.response;
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


// The GET functions will now handle errors and return empty arrays on failure.
export async function getSupplies(): Promise<Supply[]> {
  try {
    const response = await posterApiFetch('storage.getSupplies', 'GET');
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error("Failed to get supplies:", error);
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

export async function getStorages(): Promise<Storage[]> {
    try {
        const response = await posterApiFetch('storage.getStorages', 'GET');
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error("Failed to get storages:", error);
        return [];
    }
}

export async function getPosterSuppliers(): Promise<PosterSupplier[]> {
    try {
        const response = await posterApiFetch('storage.getSuppliers', 'GET');
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error("Failed to get suppliers:", error);
        return [];
    }
}

export async function getIngredients(): Promise<Ingredient[]> {
    try {
        const response = await posterApiFetch('menu.getIngredients', 'GET');
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error("Failed to get ingredients:", error);
        return [];
    }
}


// Create Supply types and function
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

// This function is now corrected based on the user's provided Apps Script.
export async function createSupply(data: CreateSupplyData) {
    const payload = {
      supply: {
        supplier_id: data.supplier_id,
        storage_id: data.storage_id,
        date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      },
      // Corrected payload key from 'ingredients' to 'ingredient'
      ingredient: data.ingredients.map(ing => ({
        id: String(ing.ingredient_id),
        num: String(ing.count),
        type: "4", 
        price: String(ing.price)
      }))
    };
    
    // posterApiFetch will now throw a detailed error on failure.
    return await posterApiFetch('storage.createSupply', 'POST', payload);
}
