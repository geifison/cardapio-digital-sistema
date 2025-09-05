// Ajuste de cálculo de API_BASE para dev vs prod
const BASE = (import.meta as any).env?.BASE_URL || "/";
const isDev = (import.meta as any).env?.DEV === true;
// Em dev usamos proxy do Vite em "/api"; em prod calculamos caminho relativo ao diretório pai (irmão de admin)
const computeApiBase = () => {
  if (isDev) return "/api";
  try {
    const loc = (globalThis as any)?.location;
    const origin = loc?.origin || "http://localhost";
    const hostname: string | undefined = loc?.hostname;
    const port: string | undefined = loc?.port;
    // Preview local do Vite (porta 4173) serve apenas o admin; API está no PHP embutido (porta 8000)
    const isLocalPreview = hostname === "localhost" && port === "4173";
    if (isLocalPreview) return "http://localhost:8000/api";

    const baseAbs = new URL(BASE, origin);
    return new URL("../api/", baseAbs).pathname; // e.g., "/cardapio-digital-sistema/api/"
  } catch {
    const b = BASE.endsWith("/") ? BASE : BASE + "/";
    return b.replace(/\/admin\/$/, "/api/");
  }
};
const API_BASE = (computeApiBase() as string).replace(/\/+$/, "");

export type HttpError = { status: number; message?: string; data?: any };

async function request(path: string, init: RequestInit = {}) {
  const pathNormalized = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${pathNormalized}`;

  const isFormData = init.body instanceof FormData;
  const mergedHeaders: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (!isFormData && !("Content-Type" in mergedHeaders)) {
    mergedHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: mergedHeaders,
  });

  const contentType = res.headers.get("content-type") || "";
  let payload: any = null;
  try {
    if (contentType.includes("application/json")) {
      payload = await res.json();
    } else {
      payload = await res.text();
    }
  } catch (e) {
    payload = null;
  }

  if (!res.ok) {
    const error: HttpError = {
      status: res.status,
      message: (payload && (payload.message || payload.error)) || res.statusText,
      data: payload,
    };
    throw error;
  }

  return payload;
}

async function requestAnon(path: string, init: RequestInit = {}) {
  const pathNormalized = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${pathNormalized}`;

  const isFormData = init.body instanceof FormData;
  const mergedHeaders: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (!isFormData && !("Content-Type" in mergedHeaders)) {
    mergedHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...init,
    credentials: "omit",
    headers: mergedHeaders,
  });

  const contentType = res.headers.get("content-type") || "";
  let payload: any = null;
  try {
    if (contentType.includes("application/json")) {
      payload = await res.json();
    } else {
      payload = await res.text();
    }
  } catch (e) {
    payload = null;
  }

  if (!res.ok) {
    const error: HttpError = {
      status: res.status,
      message: (payload && (payload.message || payload.error)) || res.statusText,
      data: payload,
    };
    throw error;
  }

  return payload;
}

export const httpClientAnon = {
  get: <T = any>(path: string): Promise<T> => requestAnon(path, { method: "GET" }) as Promise<T>,
  post: <T = any, B = any>(path: string, body?: B): Promise<T> =>
    requestAnon(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }) as Promise<T>,
};

export const httpClient = {
  get: <T = any>(path: string): Promise<T> => request(path, { method: "GET" }) as Promise<T>,
  post: <T = any, B = any>(path: string, body?: B): Promise<T> =>
    request(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }) as Promise<T>,
  put: <T = any, B = any>(path: string, body?: B): Promise<T> =>
    request(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }) as Promise<T>,
  patch: <T = any, B = any>(path: string, body?: B): Promise<T> =>
    request(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }) as Promise<T>,
  delete: <T = any>(path: string): Promise<T> => request(path, { method: "DELETE" }) as Promise<T>,
  postFormData: <T = any>(path: string, formData: FormData): Promise<T> =>
    request(path, { method: "POST", body: formData }) as Promise<T>,
};