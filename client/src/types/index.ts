export interface User {
  id: string;
  phone: string;
  createdAt: string;
}

export interface Loan {
  id: string;
  friendName: string;
  amount: string; // e.g. "1500.00"
  dueDate: string; // ISO 8601 string
  isRepaid: boolean;
  repaidAt: string | null;
  createdAt: string;
}

export interface LoanSummary {
  totalLent: string;
  totalRepaid: string;
  overdueAmount: string;
}

export interface NewLoanInput {
  friendName: string;
  amount: string;
  dueDate: string;
}
