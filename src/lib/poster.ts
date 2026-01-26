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
  return posterApiFetch('storage.getSupplies', params);
}
