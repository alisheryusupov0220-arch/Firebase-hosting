
const API_URL = process.env.POSTER_API_URL;
const API_KEY = process.env.POSTER_API_KEY;

async function posterApiFetch(method: string, params: Record<string, any> = {}) {
  if (!API_URL || !API_KEY) {
    console.error('Poster API URL or Key is not configured in .env.local');
    throw new Error('Poster API URL or Key is not configured.');
  }

  const url = new URL(`${API_URL}/${method}`);
  url.searchParams.append('token', API_KEY);
  url.searchParams.append('format', 'json');

  for (const key in params) {
    url.searchParams.append(key, params[key]);
  }

  const response = await fetch(url.toString());

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
    console.error(`Poster API error for method ${method}:`, data.error);
    throw new Error(`Poster API error: ${data.error.message} (code: ${data.error.code})`);
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
  const response = await posterApiFetch('storage.getSupplies', params);
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
    const response = await posterApiFetch('storage.getStorages');
    return Array.isArray(response) ? response : [];
}

export async function getPosterSuppliers(): Promise<PosterSupplier[]> {
    const response = await posterApiFetch('storage.getSuppliers');
    return Array.isArray(response) ? response : [];
}

export async function getIngredients(): Promise<Ingredient[]> {
    const response = await posterApiFetch('menu.getIngredients');
    return Array.isArray(response) ? response : [];
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
