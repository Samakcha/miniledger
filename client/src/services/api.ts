import { User, Loan, LoanSummary, NewLoanInput } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001').replace(/\/$/, '');

const TOKEN_STORAGE_KEY = 'miniledger_auth_token';

export class ApiError extends Error {
  public status: number;
  public errorType?: string;

  constructor(message: string, status: number, errorType?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorType = errorType;
  }
}

/**
 * Token storage helpers
 */
export const authStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // Storage unavailable / blocked
    }
  },
  clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Ignore
    }
  },
};

/**
 * Generic fetch wrapper with automatic Authorization header and JSON parsing
 */
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const token = authStorage.getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new ApiError(
      'Unable to connect to the backend server. Please verify the API server is running on ' + API_BASE_URL,
      0,
      'NetworkError'
    );
  }

  // Parse JSON response
  let data: any;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    if (response.status === 401) {
      authStorage.clearToken();
    }
    const errorMsg =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      `Request failed with status ${response.status}`;
    const errorType = data && typeof data === 'object' ? data.error : undefined;

    throw new ApiError(errorMsg, response.status, errorType);
  }

  return data as T;
}

/**
 * Real API methods
 */
export const api = {
  // --- Auth APIs ---
  async requestOtp(phone: string): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>('/api/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  async verifyOtp(phone: string, otp: string): Promise<{ token: string; user: User }> {
    const res = await apiFetch<{ token: string; user: User }>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    });

    if (res.token) {
      authStorage.setToken(res.token);
    }
    return res;
  },

  async getCurrentUser(): Promise<User> {
    const res = await apiFetch<{ user: User }>('/api/auth/me', {
      method: 'GET',
    });
    return res.user;
  },

  logout(): void {
    authStorage.clearToken();
  },

  // --- Loan APIs ---
  async getLoans(): Promise<Loan[]> {
    const res = await apiFetch<{ loans: Loan[] }>('/api/loans', {
      method: 'GET',
    });
    return res.loans || [];
  },

  async getLoanSummary(): Promise<LoanSummary> {
    return apiFetch<LoanSummary>('/api/loans/summary', {
      method: 'GET',
    });
  },

  async createLoan(input: NewLoanInput): Promise<Loan> {
    const res = await apiFetch<any>('/api/loans', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return (res.loan || res) as Loan;
  },

  async repayLoan(loanId: string): Promise<Loan> {
    const res = await apiFetch<any>(`/api/loans/${loanId}/repay`, {
      method: 'PATCH',
    });
    return (res.loan || res) as Loan;
  },
};
