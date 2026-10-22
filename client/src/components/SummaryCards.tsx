import React from 'react';
import { LoanSummary } from '../types';
import { formatCurrency } from '../data/mockData';

interface SummaryCardsProps {
  summary: LoanSummary;
  totalLoansCount: number;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary, totalLoansCount }) => {
  const isOverdueAlert = parseFloat(summary.overdueAmount) > 0;

  return (
    <section className="summary-section" aria-label="Ledger financial summary">
      <div className="summary-grid">
        {/* Total Lent Card */}
        <div className="card summary-card summary-card-lent">
          <div className="summary-card-header">
            <span className="summary-label">Total Lent</span>
            <div className="summary-icon icon-lent" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
          </div>
          <div className="summary-amount">{formatCurrency(summary.totalLent)}</div>
          <div className="summary-footer">
            <span className="summary-subtext">Across {totalLoansCount} recorded loan{totalLoansCount === 1 ? '' : 's'}</span>
          </div>
        </div>

        {/* Total Repaid Card */}
        <div className="card summary-card summary-card-repaid">
          <div className="summary-card-header">
            <span className="summary-label">Total Repaid</span>
            <div className="summary-icon icon-repaid" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
          </div>
          <div className="summary-amount text-success">{formatCurrency(summary.totalRepaid)}</div>
          <div className="summary-footer">
            <span className="summary-subtext">Recovered funds</span>
          </div>
        </div>

        {/* Overdue Amount Card */}
        <div className={`card summary-card summary-card-overdue ${isOverdueAlert ? 'alert-active' : ''}`}>
          <div className="summary-card-header">
            <span className="summary-label">Overdue Amount</span>
            <div className={`summary-icon ${isOverdueAlert ? 'icon-overdue-alert' : 'icon-overdue'}`} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
          </div>
          <div className={`summary-amount ${isOverdueAlert ? 'text-danger' : 'text-neutral'}`}>
            {formatCurrency(summary.overdueAmount)}
          </div>
          <div className="summary-footer">
            {isOverdueAlert ? (
              <span className="badge badge-danger">Requires attention</span>
            ) : (
              <span className="summary-subtext">All active loans on schedule</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
