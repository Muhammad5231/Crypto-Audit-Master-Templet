'use client'

const TOKEN_KEY = 'crypto_audit_token'

class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

function handle401() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY)
    // Only redirect if not already on the page
    if (!window.location.search.includes('unauthorized')) {
      window.location.reload()
    }
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {},
  tokenOverride?: string
): Promise<T> {
  const token = tokenOverride || getToken()

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Don't set Content-Type for FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    handle401()
    throw new ApiError('Unauthorized', 401)
  }

  if (!response.ok) {
    let errorData: unknown
    try {
      errorData = await response.json()
    } catch {
      errorData = await response.text()
    }
    // ── Extract error message from standard API error envelope ──
    // Backend returns: { success: false, error: string, errors?: string[] }
    const message =
      (errorData as { error?: string })?.error ||
      (errorData as { message?: string })?.message ||
      (errorData as { errors?: string[] })?.errors?.join(', ') ||
      `Request failed with status ${response.status}`
    throw new ApiError(message, response.status, errorData)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  const json = await response.json()

  // ── Unwrap the standard API response envelope ──
  // Backend returns: { success: true, data: T, message? }
  // We extract just the `data` field for convenience.
  // If the response doesn't follow the standard envelope, return as-is.
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T
  }

  return json as T
}

export async function apiGet<T>(url: string, tokenOverride?: string): Promise<T> {
  return request<T>(url, { method: 'GET' }, tokenOverride)
}

export async function apiPost<T>(url: string, data?: unknown, tokenOverride?: string): Promise<T> {
  return request<T>(
    url,
    {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    },
    tokenOverride
  )
}

export async function apiPatch<T>(url: string, data?: unknown, tokenOverride?: string): Promise<T> {
  return request<T>(
    url,
    {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    },
    tokenOverride
  )
}

export async function apiDelete<T>(url: string, tokenOverride?: string): Promise<T> {
  return request<T>(url, { method: 'DELETE' }, tokenOverride)
}

export async function apiUpload<T>(url: string, file: File, fieldName: string = 'file', extraFields?: Record<string, string>): Promise<T> {
  const formData = new FormData()
  formData.append(fieldName, file)

  if (extraFields) {
    Object.entries(extraFields).forEach(([key, value]) => {
      formData.append(key, value)
    })
  }

  return request<T>(url, {
    method: 'POST',
    body: formData,
  })
}

export { ApiError }
