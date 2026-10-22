import React from 'react';

interface EmptyStateProps {
  onAddLoan: () => void;
  onResetMockData?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onAddLoan, onResetMockData }) => {
  return (
    <div className="card empty-state-card">
      <div className="empty-state-icon" aria-hidden="true">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"></rect>
          <line x1="2" y1="10" x2="22" y2="10"></line>
        </svg>
      </div>
      <h3 className="empty-state-title">No loans recorded yet</h3>
      <p className="empty-state-description">
        Keep track of money lent to friends and track repayments easily. Start by recording your first loan.
      </p>
      <div className="empty-state-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onAddLoan}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Record a Loan
        </button>

        {onResetMockData && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={onResetMockData}
          >
            Load Sample Data
          </button>
        )}
      </div>
    </div>
  );
};
