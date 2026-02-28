
import { format } from 'date-fns';

const API_URL = process.env.POSTER_API_URL;
const API_KEY = process.env.POSTER_API_KEY;

/**
 * A robust function to interact with the Poster API, modeled after the official documentation.
 * It handles GET and POST requests, authentication, and various error scenarios.
 * @param method The API method to call (e.g., 'storage.getStorages').
 * @param httpMethod The HTTP method to use ('GET' or 'POST').
 * @param payload The JSON payload for POST requests.
 * @returns The 'response' field from the API on success.
 * @throws An error with a detailed message on failure.
 */
async function posterApiFetch(
  method: string,
  httpMethod: 'GET' | 'POST' = 'GET',
  payload: Record<string, any> = {}
) {
  if (!API_URL || !API_KEY) {
    throw new Error('Poster API URL or Key is not configured in environment variables.');
  }

  // Per Poster docs, the token is a URL parameter for all requests.
  // The format=json is added for explicit compliance with documentation.
  const url = `${API_URL}/${method}?token=${encodeURIComponent(API_KEY)}&format=json`;

  const options: RequestInit = {
    method: httpMethod,
    headers: {},
    // Disable caching for all API calls to ensure data is always fresh.
    cache: 'no-store',
  };

  if (httpMethod === 'POST' && Object.keys(payload).length > 0) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(payload);
  }

  try {
    const response = await fetch(url, options);
    
    // Try to parse the response as JSON. Poster API can return JSON even for errors.
    const data = await response.json().catch(() => {
      // This handles cases where the response is not valid JSON (e.g., server error page).
      throw new Error(`Poster API returned a non-JSON response. Status: ${response.status}`);
    });

    // Check for API-level errors within the JSON payload, as per Poster docs.
    // The API might return an empty `error` object `{}`, which we should ignore.
    if (data && data.error && (data.error.message || data.error.code)) {
      const errorMessage = `Poster API error: ${data.error.message || 'Unknown error'} (code: ${data.error.code || 'N/A'})`;
      throw new Error(errorMessage);
    }
    
    // As a fallback, check the HTTP status if there's no `data.error` field.
    // This catches things like 401 Unauthorized if the token is wrong.
    if (!response.ok) {
        throw new Error(`Poster API request failed with status ${response.status}`);
    }

    // On success, return the 'response' property.
    // Poster returns `{"response": ...}` on success or just `false` sometimes.
    return data.response === undefined ? data : data.response;

  } catch (error) {
    // Prepend the method name to the error for clearer logs and re-throw it.
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[${method}] ${message}`);
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

// The GET functions are now wrapped in try/catch to be defensive.
// If the API call fails, they log the specific error and return an empty array
// to prevent the UI from crashing.

export async function getSupplies(): Promise<Supply[]> {
  try {
    const response = await posterApiFetch('storage.getSupplies', 'GET');
    // The API might return `false` if there are no items, so handle that.
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

// Menu Products
export type TechCardIngredient = {
    ingredient_id: string;
    ingredient_name: string;
    type: '1'; // 1 is ingredient
    brutto: string;
    netto: string;
    cost: string;
    sum: string;
};

export type Product = {
    product_id: string;
    product_name: string;
    price: { [key: string]: string }; // Price per spot, e.g. "1": "15000.00"
    composition: TechCardIngredient[];
};

export async function getProducts(): Promise<Product[]> {
    try {
        const response = await posterApiFetch('menu.getProducts', 'GET', { with_composition: 1 });
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error("Failed to get products:", error);
        return [];
    }
}


// Storage Balance
export type StorageBalanceItem = {
    ingredient_id: string;
    ingredient_name: string;
    balance: string; // "left" in the response
    unit: string;
    sum: string;
};

export async function getStorageBalance(storageId: string): Promise<StorageBalanceItem[]> {
    try {
        // Poster API uses date in YYYYMMDD format for this method
        const date = format(new Date(), 'yyyyMMdd');
        const response = await posterApiFetch('storage.getStorage', 'GET', {
            date: date,
            id_storage: storageId,
        });
        
        // The response contains a 'storage' array with items.
        // We map 'left' to 'balance' for clarity.
        if (response && Array.isArray(response.storage)) {
             return response.storage.map((item: any) => ({
                ingredient_id: item.id,
                ingredient_name: item.name,
                balance: item.left,
                unit: item.unit,
                sum: item.sum,
             }));
        }
        return [];
    } catch (error) {
        console.error(`Failed to get storage balance for storage ${storageId}:`, error);
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

/**
 * Creates a new supply in Poster.
 */
export async function createSupply(data: CreateSupplyData) {
    const payload = {
      supply: {
        supplier_id: data.supplier_id,
        storage_id: data.storage_id,
        date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        comment: data.comment,
      },
      // Poster expects price in the smallest currency unit (e.g. kopecks, tiyins)
      ingredient: data.ingredients.map(ing => ({
        id: String(ing.ingredient_id),
        num: String(ing.count),
        type: "4", 
        price: String(ing.price * 100)
      }))
    };
    
    return await posterApiFetch('storage.createSupply', 'POST', payload);
}

// Create Write-off
export type NewWriteOffIngredient = {
    ingredient_id: number;
    num: number; // quantity
    comment?: string;
};

export type CreateWriteOffData = {
    storage_id: number;
    comment?: string;
    ingredients: NewWriteOffIngredient[];
};

/**
 * Creates a new write-off in Poster.
 */
export async function createWriteOff(data: CreateWriteOffData) {
    const payload = {
      write_off: {
        storage_id: data.storage_id,
        comment: data.comment,
      },
      ingredient: data.ingredients.map(ing => ({
        id: String(ing.ingredient_id),
        num: String(ing.num),
        type: "1", // 1 for regular write-off
        comment: ing.comment || ''
      }))
    };

    return await posterApiFetch('storage.createWriteOff', 'POST', payload);
}
