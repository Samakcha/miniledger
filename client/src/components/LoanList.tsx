import React, { useState } from 'react';
import { Loan } from '../types';
import { formatCurrency, formatDate, isLoanOverdue } from '../data/mockData';

interface LoanListProps {
  loans: Loan[];
  onRepayLoan: (loanId: string) => void;
  onOpenAddModal: () => void;
}

type FilterType = 'all' | 'pending' | 'overdue' | 'repaid';

export const LoanList: React.FC<LoanListProps> = ({ loans, onRepayLoan, onOpenAddModal }) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered loans
  const filteredLoans = loans.filter((loan) => {
    // Search query matching friend name
    if (searchQuery.trim() && !loan.friendName.toLowerCase().includes(searchQuery.toLowerCase().trim())) {
      return false;
    }

    if (filter === 'repaid') return loan.isRepaid;
    if (filter === 'pending') return !loan.isRepaid && !isLoanOverdue(loan);
    if (filter === 'overdue') return isLoanOverdue(loan);
    return true; // 'all'
  });

  return (
    <div className="card loans-card">
      <div className="loans-header">
        <div className="loans-header-title">
          <h2>Recorded Loans</h2>
          <span className="count-badge">{loans.length}</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onOpenAddModal}
            title="Record a new loan"
          >
            + Add Loan
          </button>
        </div>

        <div className="loans-controls">
          {/* Search Input */}
          <div className="search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search by friend..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              aria-label="Search loans by friend name"
            />
          </div>

          {/* Filter Pills */}
          <div className="filter-group" role="tablist" aria-label="Filter loans">
            <button
              type="button"
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
              onClick={() => setFilter('pending')}
            >
              Pending
            </button>
            <button
              type="button"
              className={`filter-btn ${filter === 'overdue' ? 'active' : ''}`}
              onClick={() => setFilter('overdue')}
            >
              Overdue
            </button>
            <button
              type="button"
              className={`filter-btn ${filter === 'repaid' ? 'active' : ''}`}
              onClick={() => setFilter('repaid')}
            >
              Repaid
            </button>
          </div>
        </div>
      </div>

      {filteredLoans.length === 0 ? (
        <div className="empty-filter-state">
          <p>No loans match the selected filter criteria.</p>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setFilter('all');
              setSearchQuery('');
            }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="loans-table">
            <thead>
              <tr>
                <th scope="col">Friend Name</th>
                <th scope="col">Amount</th>
                <th scope="col">Due Date</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLoans.map((loan) => {
                const overdue = isLoanOverdue(loan);

                return (
                  <tr
                    key={loan.id}
                    className={`loan-row ${overdue ? 'row-overdue' : ''} ${loan.isRepaid ? 'row-repaid' : ''}`}
                  >
                    {/* Friend Name */}
                    <td className="cell-friend">
                      <div className="friend-info">
                        <div className="avatar-circle" aria-hidden="true">
                          {loan.friendName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="friend-name">{loan.friendName}</span>
                          <span className="loan-date-created">Added {formatDate(loan.createdAt)}</span>
                        </div>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="cell-amount">
                      <span className="amount-value">{formatCurrency(loan.amount)}</span>
                    </td>

                    {/* Due Date */}
                    <td className="cell-due-date">
                      <div className="date-wrapper">
                        <span className={`due-date ${overdue ? 'text-danger font-medium' : ''}`}>
                          {formatDate(loan.dueDate)}
                        </span>
                        {overdue && (
                          <span className="overdue-tag">Past Due</span>
                        )}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="cell-status">
                      {loan.isRepaid ? (
                        <span className="badge badge-success">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          Repaid
                        </span>
                      ) : overdue ? (
                        <span className="badge badge-danger">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                          Overdue
                        </span>
                      ) : (
                        <span className="badge badge-pending">Pending</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="cell-action text-right">
                      {loan.isRepaid ? (
                        <span className="repaid-note" title={loan.repaidAt ? `Repaid on ${formatDate(loan.repaidAt)}` : 'Repaid'}>
                          ✓ Settled
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-repay"
                          onClick={() => onRepayLoan(loan.id)}
                          title={`Mark loan to ${loan.friendName} as repaid`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          Mark Repaid
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
