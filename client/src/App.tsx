import React, { useState, useEffect, useCallback } from 'react';
import { User, Loan, LoanSummary, NewLoanInput } from './types';
import { api, authStorage, ApiError } from './services/api';
import { Navbar } from './components/Navbar';
import { SummaryCards } from './components/SummaryCards';
import { LoanList } from './components/LoanList';
import { EmptyState } from './components/EmptyState';
import { AddLoanModal } from './components/AddLoanModal';
import { LoginScreen } from './components/LoginScreen';
import { BackgroundVideo } from './components/BackgroundVideo';

const defaultEmptySummary: LoanSummary = {
  totalLent: '0.00',
  totalRepaid: '0.00',
  overdueAmount: '0.00',
};

export const App: React.FC = () => {
  // Session & user state
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);

  // Loans & summary state
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<LoanSummary>(defaultEmptySummary);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Modal & Feedback state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [globalMessage, setGlobalMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Clear global feedback message after 4 seconds
  useEffect(() => {
    if (globalMessage) {
      const timer = setTimeout(() => setGlobalMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [globalMessage]);

  // Load real loans and summary from backend
  const loadLedgerData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [fetchedLoans, fetchedSummary] = await Promise.all([
        api.getLoans(),
        api.getLoanSummary(),
      ]);

      setLoans(fetchedLoans);
      setSummary(fetchedSummary);
    } catch (err: any) {
      console.error('Failed to load ledger data:', err);
      if (err instanceof ApiError && err.status === 401) {
        // Token expired or invalid
        api.logout();
        setIsAuthenticated(false);
        setUser(null);
        setGlobalMessage({ text: 'Session expired. Please log in again.', type: 'error' });
      } else {
        setGlobalMessage({
          text: err.message || 'Failed to fetch ledger data from server.',
          type: 'error',
        });
      }
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  // Restore existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const existingToken = authStorage.getToken();
      if (!existingToken) {
        setIsCheckingSession(false);
        setIsAuthenticated(false);
        return;
      }

      try {
        const verifiedUser = await api.getCurrentUser();
        setUser(verifiedUser);
        setIsAuthenticated(true);
      } catch (err) {
        // Token invalid or network issue
        api.logout();
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  // Fetch loans when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadLedgerData();
    }
  }, [isAuthenticated, loadLedgerData]);

  // Handle Login success
  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsAuthenticated(true);
    setGlobalMessage({ text: 'Signed in successfully!', type: 'success' });
  };

  // Handle Logout
  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
    setUser(null);
    setLoans([]);
    setSummary(defaultEmptySummary);
    setGlobalMessage({ text: 'Signed out successfully.', type: 'success' });
  };

  // Handle Add Loan via Real API
  const handleAddLoan = async (input: NewLoanInput) => {
    try {
      await api.createLoan(input);
      setGlobalMessage({
        text: `Loan of $${input.amount} to ${input.friendName} recorded successfully!`,
        type: 'success',
      });
      // Refresh real list & summary
      await loadLedgerData();
    } catch (err: any) {
      console.error('Failed to create loan:', err);
      if (err instanceof ApiError && err.status === 401) {
        handleLogout();
        setGlobalMessage({ text: 'Session expired. Please log in again.', type: 'error' });
        return;
      }
      setGlobalMessage({
        text: err.message || 'Failed to record loan.',
        type: 'error',
      });
    }
  };

  // Handle Mark as Repaid via Real API
  const handleRepayLoan = async (loanId: string) => {
    try {
      await api.repayLoan(loanId);
      setGlobalMessage({
        text: 'Loan marked as repaid successfully!',
        type: 'success',
      });
      // Refresh real list & summary
      await loadLedgerData();
    } catch (err: any) {
      console.error('Failed to mark loan as repaid:', err);
      if (err instanceof ApiError && err.status === 401) {
        handleLogout();
        setGlobalMessage({ text: 'Session expired. Please log in again.', type: 'error' });
        return;
      }
      setGlobalMessage({
        text: err.message || 'Failed to update repayment status.',
        type: 'error',
      });
    }
  };

  return (
    <>
      {/* Shared animated background across login, loading, and dashboard */}
      <BackgroundVideo />

      {isCheckingSession ? (
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Connecting to MiniLedger...</p>
        </div>
      ) : !isAuthenticated || !user ? (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      ) : (
        <div className="app-layout">
          {/* Top Navigation */}
          <Navbar
            user={user}
            onLogout={handleLogout}
            onOpenAddModal={() => setIsAddModalOpen(true)}
          />

          {/* Main Content Area */}
          <main className="main-content">
            <div className="content-container">
              {/* Global feedback message toast */}
              {globalMessage && (
                <div
                  className={`alert ${globalMessage.type === 'success' ? 'alert-success' : 'alert-danger'} mb-4`}
                  role="alert"
                >
                  <span>{globalMessage.text}</span>
                </div>
              )}

              {/* Welcome & Action Header */}
              <div className="page-header">
                <div>
                  <h1 className="page-title">Ledger Overview</h1>
                  <p className="page-subtitle">
                    Real-time loan balances and repayment tracking connected to your personal ledger.
                  </p>
                </div>

                <div className="header-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={loadLedgerData}
                    disabled={isLoadingData}
                    title="Refresh loans and summary from server"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={isLoadingData ? 'spin-icon' : ''}
                      aria-hidden="true"
                    >
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <polyline points="1 20 1 14 7 14"></polyline>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    <span>{isLoadingData ? 'Refreshing...' : 'Refresh'}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsAddModalOpen(true)}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>Record Loan</span>
                  </button>
                </div>
              </div>

              {/* Financial Summary Cards */}
              <SummaryCards summary={summary} totalLoansCount={loans.length} />

              {/* Loan List or Empty State */}
              {isLoadingData && loans.length === 0 ? (
                <div className="card loading-card">
                  <div className="spinner"></div>
                  <p>Loading your loans from database...</p>
                </div>
              ) : loans.length === 0 ? (
                <EmptyState onAddLoan={() => setIsAddModalOpen(true)} />
              ) : (
                <LoanList
                  loans={loans}
                  onRepayLoan={handleRepayLoan}
                  onOpenAddModal={() => setIsAddModalOpen(true)}
                />
              )}
            </div>
          </main>
        </div>
      )}

      {/* Add Loan Modal Dialog */}
      <AddLoanModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddLoan}
      />
    </>
  );
};

export default App;
