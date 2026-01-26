import { format } from 'date-fns';

const API_URL = process.env.POSTER_API_URL;
const API_KEY = process.env.POSTER_API_KEY;

// This function will now throw on API or network errors, mimicking the user's script.
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
  if (!response.ok) {
    throw new Error(`Poster API network error for method ${method}: ${response.status} ${response.statusText} - ${responseText}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Failed to parse JSON response from Poster API for method ${method}: ${responseText}`);
  }

  // Following the user's script logic: throw if the API indicates an error.
  if (data.response === false || data.error) {
    const errorDetails = data.error ? JSON.stringify(data.error) : 'response was false';
    throw new Error(`Poster API logical error for method ${method}: ${errorDetails}`);
  }
  
  // Return the successful response payload.
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

// This function will now let errors bubble up to the server action.
export async function createSupply(data: CreateSupplyData) {
    const payload = {
      supply: {
        supplier_id: data.supplier_id,
        storage_id: data.storage_id,
        date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      },
      // The user's script uses `id`, `num`, `type`, `price`.
      ingredient: data.ingredients.map(ing => ({
        id: String(ing.ingredient_id),
        num: String(ing.count),
        type: "4", 
        price: String(ing.price)
      }))
    };
    
    // The response here will be the new supply ID from posterApiFetch on success,
    // or posterApiFetch will throw on error.
    return await posterApiFetch('storage.createSupply', 'POST', payload);
}
