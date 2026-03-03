'use server';

import { format } from 'date-fns';

const API_URL = process.env.POSTER_API_URL;
const API_KEY = process.env.POSTER_API_KEY;

/**
 * A robust function to interact with the Poster API.
 * It handles GET and POST requests, authentication, and various error scenarios.
 * For POST requests, it sends data as 'application/x-www-form-urlencoded'.
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

  // Start with mandatory parameters for the query string
  const queryParams = new URLSearchParams({
    token: API_KEY,
    format: 'json',
  });

  // For GET requests, append payload to query parameters
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
    // Disable caching for all API calls to ensure data is always fresh.
    cache: 'no-store',
  };

  // For POST requests, the payload goes into the body as x-www-form-urlencoded
  if (httpMethod === 'POST' && Object.keys(payload).length > 0) {
    const postBody = new URLSearchParams();
     for (const key in payload) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
            const value = payload[key];
            if (Array.isArray(value)) {
                // Handle arrays of objects for Poster's form-urlencoded format
                value.forEach((item, index) => {
                    if (typeof item === 'object' && item !== null) {
                        for (const itemKey in item) {
                            postBody.append(`${key}[${index}][${itemKey}]`, String(item[itemKey]));
                        }
                    } else {
                         postBody.append(`${key}[${index}]`, String(item));
                    }
                });
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
      const errorMessage = `Poster API error: ${data.error.message || 'Unknown error'} (code: ${data.error.code || 'N/A'})`;
      // Log the detailed error and payload for debugging on the server.
      console.error(`Poster API Error for method [${method}]. URL: ${url}. Sent Payload: ${options.body?.toString()}`);
      throw new Error(errorMessage);
    }
    
    if (!response.ok) {
        const statusErrorMessage = `Poster API request failed with status ${response.status}`;
        console.error(`${statusErrorMessage} for method [${method}]. URL: ${url}. Sent Payload: ${options.body?.toString()}`);
        throw new Error(statusErrorMessage);
    }

    return data.response === undefined ? data : data.response;

  } catch (error) {
    // This catches fetch errors (e.g., network) or errors thrown above.
    const message = error instanceof Error ? error.message : String(error);
    // Add a general log here in case of network-level failures before a response is received.
    if (!message.startsWith('Poster API')) {
         console.error(`Network or fetch error during posterApiFetch for [${method}].`);
    }
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
    storage_id?: string;
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
    storage_id?: string;
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
    price: number; // This is COST PER UNIT
    type: number;
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
      // Flat structure
      supplier_id: Number(data.supplier_id),
      storage_id: Number(data.storage_id),
      date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      comment: data.comment,
      // Array with correct name and keys
      supply_ingredients: data.ingredients.map(ing => ({
        ingredient_id: Number(ing.ingredient_id),
        num: ing.count, // The key for quantity is 'num' in Poster
        cost: ing.price, // The key for price is 'cost' in Poster
        type: Number(ing.type),
      }))
    };
    
    console.log("--- Отправка данных в Poster API (createSupply) ---");
    console.log("Payload to be encoded:", JSON.stringify(payload, null, 2));

    const response = await posterApiFetch('storage.createSupply', 'POST', payload);
    // On success, Poster API returns the new supply_id
    return response;
}

// Create Write-off
export type NewWriteOffIngredient = {
    id: number;
    type: number;
    weight: number;
};

export type CreateWriteOffData = {
    storage_id: number;
    reason?: string;
    ingredients: NewWriteOffIngredient[];
};


/**
 * Creates a new write-off in Poster.
 */
export async function createWriteOff(data: CreateWriteOffData) {
    const payload = {
      write_off: {
        storage_id: data.storage_id,
        reason: data.reason,
        date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      },
      ingredient: data.ingredients.map(ing => ({
        id: ing.id,
        type: ing.type, 
        weight: ing.weight,
      }))
    };

    const response = await posterApiFetch('storage.createWriteOff', 'POST', payload);
    // On success, Poster API returns the new write_off_id
    return response;
}


// Get Wastes
export type Waste = {
    waste_id: string;
    date: string;
    reason_name: string;
    total_sum: string;
};

export async function getWastes(dateFrom?: string, dateTo?: string): Promise<Waste[]> {
    try {
        const payload: { [key: string]: string } = { '1c': 'true' };
        if (dateFrom) payload.dateFrom = dateFrom;
        if (dateTo) payload.dateTo = dateTo;
        
        const response = await posterApiFetch('storage.getWastes', 'GET', payload);
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error("Failed to get wastes:", error);
        return [];
    }
}
