const getApiUrl = (path: string): string => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  
  if (backendUrl) {
    const fullUrl = `${backendUrl}${path}`;
    console.log('[API] Usando backend:', fullUrl);
    return fullUrl;
  }
  
  console.log('[API] Usando proxy local:', path);
  return path;
};

const getApiHeaders = (): HeadersInit => {
  const headers: HeadersInit = {};
  
  const apiKey = import.meta.env.VITE_API_KEY;
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }
  
  return headers;
};

const fetchApi = async (path: string, options?: RequestInit): Promise<Response> => {
  const url = getApiUrl(path);
  const headers = {
    ...getApiHeaders(),
    ...options?.headers,
  };
  
  return fetch(url, {
    ...options,
    headers,
  });
};

export { getApiUrl, getApiHeaders, fetchApi };
