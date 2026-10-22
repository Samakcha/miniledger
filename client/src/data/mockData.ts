import { User, Loan, LoanSummary } from '../types';

export const mockDefaultUser: User = {
  id: 'usr-demo-789456',
  phone: '+1 (555) 019-2834',
  createdAt: '2026-10-01T10:00:00.000Z',
};

// Generates dates relative to today for dynamic testing
const now = new Date();
const pastDate = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(); // 4 days ago (Overdue)
const futureDate1 = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString(); // 6 days in future
const futureDate2 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days in future
const repaidPastDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
const repaidAtDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

export const initialMockLoans: Loan[] = [
  {
    id: 'loan-001',
    friendName: 'Rahul Sharma',
    amount: '1500.00',
    dueDate: futureDate1,
    isRepaid: false,
    repaidAt: null,
    createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'loan-002',
    friendName: 'Priya Patel',
    amount: '850.00',
    dueDate: pastDate, // Overdue loan
    isRepaid: false,
    repaidAt: null,
    createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'loan-003',
    friendName: 'Ankit Verma',
    amount: '2200.00',
    dueDate: repaidPastDate,
    isRepaid: true,
    repaidAt: repaidAtDate,
    createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'loan-004',
    friendName: 'Sara Ali',
    amount: '450.00',
    dueDate: futureDate2,
    isRepaid: false,
    repaidAt: null,
    createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

/**
 * Calculates summary metrics dynamically across the current loans array.
 * Emulates the server-side aggregation rules without floating-point artifacts.
 */
export function calculateSummary(loans: Loan[]): LoanSummary {
  let lent = 0;
  let repaid = 0;
  let overdue = 0;
  const currentTime = new Date();

  for (const loan of loans) {
    const amt = parseFloat(loan.amount) || 0;
    // Scale by 100 for integer arithmetic to prevent float errors
    const cents = Math.round(amt * 100);

    lent += cents;

    if (loan.isRepaid) {
      repaid += cents;
    } else {
      const loanDueDate = new Date(loan.dueDate);
      if (loanDueDate < currentTime) {
        overdue += cents;
      }
    }
  }

  return {
    totalLent: (lent / 100).toFixed(2),
    totalRepaid: (repaid / 100).toFixed(2),
    overdueAmount: (overdue / 100).toFixed(2),
  };
}

/**
 * Helper to check if an unpaid loan is overdue.
 */
export function isLoanOverdue(loan: Loan): boolean {
  if (loan.isRepaid) return false;
  return new Date(loan.dueDate) < new Date();
}

/**
 * Formats ISO date string to a human-readable display date.
 */
export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

/**
 * Formats a decimal string into a standard currency string.
 */
export function formatCurrency(amountStr: string): string {
  const val = parseFloat(amountStr) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}
