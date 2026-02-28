
import { format } from 'date-fns';

const API_URL = process.env.POSTER_API_URL;
const API_KEY = process.env.POSTER_API_KEY;

/**
 * A robust function to interact with the Poster API, modeled after the official documentation.
 * It handles GET and POST requests, authentication, and various error scenarios.
 * @param method The API method to call (e.g., 'storage.getStorages').
 * @param httpMethod The HTTP method to use ('GET' or 'POST').
 * @param payload The JSON payload for POST requests or query parameters for GET requests.
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

  // Start with mandatory parameters
  const params = new URLSearchParams({
    token: API_KEY,
    format: 'json',
  });

  // For GET requests, append payload as query parameters
  if (httpMethod === 'GET') {
    for (const key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        params.append(key, String(payload[key]));
      }
    }
  }

  const url = `${API_URL}/${method}?${params.toString()}`;

  const options: RequestInit = {
    method: httpMethod,
    headers: {},
    // Disable caching for all API calls to ensure data is always fresh.
    cache: 'no-store',
  };

  // For POST requests, the payload goes into the body
  if (httpMethod === 'POST' && Object.keys(payload).length > 0) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(payload);
  }

  try {
    const response = await fetch(url, options);
    
    const data = await response.json().catch(() => {
      throw new Error(`Poster API returned a non-JSON response. Status: ${response.status}`);
    });

    if (data && data.error && (data.error.message || data.error.code)) {
      const errorMessage = `Poster API error: ${data.error.message || 'Unknown error'} (code: ${data.error.code || 'N/A'})`;
      throw new Error(errorMessage);
    }
    
    if (!response.ok) {
        throw new Error(`Poster API request failed with status ${response.status}`);
    }

    return data.response === undefined ? data : data.response;

  } catch (error) {
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
    price?: { [key: string]: string };
    composition?: TechCardIngredient[];
    type: string;
    unit?: string;
    ingredient_id?: string;
};

export async function getProducts(options?: { with_composition: number }): Promise<Product[]> {
    try {
        const payload = options || {};
        const response = await posterApiFetch('menu.getProducts', 'GET', payload);
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
        supplier_id: String(data.supplier_id),
        storage_id: String(data.storage_id),
        date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        comment: data.comment,
      },
      ingredient: data.ingredients.map(ing => ({
        id: String(ing.ingredient_id),
        num: ing.count.toFixed(2),
        type: '4', 
        price: ing.price.toFixed(2)
      }))
    };
    
    const response = await posterApiFetch('storage.createSupply', 'POST', payload);
    // On success, Poster API returns the new supply_id
    return response;
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
        storage_id: String(data.storage_id),
        reason: data.comment,
        date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      },
      ingredient: data.ingredients.map(ing => ({
        id: String(ing.ingredient_id),
        type: '4', 
        weight: ing.num.toFixed(3),
      }))
    };

    const response = await posterApiFetch('storage.createWriteOff', 'POST', payload);
    // On success, Poster API returns the new write_off_id
    return response;
}


// Get Write-offs
export type WriteOff = {
    write_off_id: string;
    date_created: string; // YYYY-MM-DD HH:mm:ss
    user_id: string;
    storage_id: string;
    storage_name: string;
    sum: string; // in cents
    comment: string;
};

export async function getWriteOffs(): Promise<WriteOff[]> {
    try {
        const response = await posterApiFetch('storage.getWriteOffs', 'GET');
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error("Failed to get write-offs:", error);
        return [];
    }
}
