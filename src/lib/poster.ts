
const API_URL = process.env.POSTER_API_URL;
const API_KEY = process.env.POSTER_API_KEY;

async function posterApiFetch(method: string, params: Record<string, any> = {}) {
  if (!API_URL || !API_KEY) {
    console.error('Poster API URL or Key is not configured in .env.local');
    throw new Error('Poster API URL or Key is not configured.');
  }

  const url = `${API_URL}/${method}`;
  
  const body = new URLSearchParams();
  body.append('token', API_KEY);
  body.append('format', 'json');

  for (const key in params) {
    body.append(key, params[key]);
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body,
  });

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

  if (data.error) {
    // Poster API sometimes returns an empty error object `{}` which is not a real error.
    if (Object.keys(data.error).length > 0) {
      console.error(`Poster API error for method ${method}:`, data.error);
      const message = data.error.message || 'No message provided.';
      const code = data.error.code || 'N/A';
      throw new Error(`Poster API error: ${message} (code: ${code})`);
    } else {
      // This handles the {"error": {}} case.
      console.warn(`Poster API for method ${method} returned an empty error object, treating as non-fatal.`);
      return false;
    }
  }


  if (data.response === false) {
    // This is often a valid response for "not found" or "empty list", not a hard error.
    return false;
  }
  
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


export async function getSupplies(params: { date_from?: string; date_to?: string } = {}): Promise<Supply[]> {
  try {
    const response = await posterApiFetch('storage.getSupplies', params);
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
        const response = await posterApiFetch('storage.getStorages');
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error("Failed to fetch storages:", error);
        return [];
    }
}

export async function getPosterSuppliers(): Promise<PosterSupplier[]> {
    try {
        const response = await posterApiFetch('storage.getSuppliers');
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error("Failed to fetch suppliers:", error);
        return [];
    }
}

export async function getIngredients(): Promise<Ingredient[]> {
    try {
        const response = await posterApiFetch('menu.getIngredients');
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error("Failed to fetch ingredients:", error);
        return [];
    }
}

export async function createSupply(data: CreateSupplyData) {
    const params: any = {
        supplier_id: data.supplier_id,
        storage_id: data.storage_id,
        supply_ingredients: JSON.stringify(data.ingredients),
    };

    if (data.comment) {
        params.comment = data.comment;
    }

    return posterApiFetch('storage.createSupply', params);
}
