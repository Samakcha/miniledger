import React, { useState, useEffect } from 'react';
import { NewLoanInput } from '../types';

interface AddLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewLoanInput) => void;
}

interface FormErrors {
  friendName?: string;
  amount?: string;
  dueDate?: string;
}

export const AddLoanModal: React.FC<AddLoanModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [friendName, setFriendName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default due date to 7 days from now
  useEffect(() => {
    if (isOpen) {
      setFriendName('');
      setAmount('');
      const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const yyyy = inSevenDays.getFullYear();
      const mm = String(inSevenDays.getMonth() + 1).padStart(2, '0');
      const dd = String(inSevenDays.getDate()).padStart(2, '0');
      setDueDate(`${yyyy}-${mm}-${dd}`);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    // 1. Friend Name
    const trimmedName = friendName.trim();
    if (!trimmedName) {
      newErrors.friendName = 'Friend name is required';
    } else if (trimmedName.length > 100) {
      newErrors.friendName = 'Name must be 100 characters or fewer';
    }

    // 2. Amount
    const trimmedAmount = amount.trim();
    if (!trimmedAmount) {
      newErrors.amount = 'Amount is required';
    } else if (!/^\d+(\.\d{1,2})?$/.test(trimmedAmount)) {
      newErrors.amount = 'Enter a valid positive number with up to 2 decimal places';
    } else {
      const num = parseFloat(trimmedAmount);
      if (isNaN(num) || num <= 0) {
        newErrors.amount = 'Amount must be greater than zero';
      } else if (num > 9999999999.99) {
        newErrors.amount = 'Amount exceeds maximum supported limit';
      }
    }

    // 3. Due Date
    if (!dueDate) {
      newErrors.dueDate = 'Due date is required';
    } else {
      const parsedDate = new Date(dueDate);
      if (isNaN(parsedDate.getTime())) {
        newErrors.dueDate = 'Please select a valid date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    // Format dueDate to ISO string at midnight UTC
    const dateObj = dueDate.includes('T') ? new Date(dueDate) : new Date(`${dueDate}T00:00:00.000Z`);
    const isoDueDate = isNaN(dateObj.getTime()) ? new Date(dueDate).toISOString() : dateObj.toISOString();

    // Format amount to 2 decimal places
    const formattedAmount = parseFloat(amount.trim()).toFixed(2);

    onSubmit({
      friendName: friendName.trim(),
      amount: formattedAmount,
      dueDate: isoDueDate,
    });

    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-text">
            <h2 id="modal-title" className="modal-title">Record a New Loan</h2>
            <p className="modal-subtitle">Log money lent to a friend with expected repayment terms.</p>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form" noValidate>
          <div className="modal-body">
            {/* Friend Name */}
            <div className="form-group">
              <label htmlFor="friendName" className="form-label">
                Friend's Name <span className="text-danger">*</span>
              </label>
              <input
                id="friendName"
                type="text"
                className={`form-input ${errors.friendName ? 'input-error' : ''}`}
                placeholder="e.g. Rahul Sharma"
                value={friendName}
                onChange={(e) => setFriendName(e.target.value)}
                maxLength={100}
                autoFocus
              />
              {errors.friendName && <span className="field-error">{errors.friendName}</span>}
            </div>

            {/* Amount */}
            <div className="form-group">
              <label htmlFor="amount" className="form-label">
                Amount ($) <span className="text-danger">*</span>
              </label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  className={`form-input pl-prefix ${errors.amount ? 'input-error' : ''}`}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              {errors.amount && <span className="field-error">{errors.amount}</span>}
              <span className="field-help">Up to 2 decimal places (e.g. 1500 or 1500.50)</span>
            </div>

            {/* Due Date */}
            <div className="form-group">
              <label htmlFor="dueDate" className="form-label">
                Due Date <span className="text-danger">*</span>
              </label>
              <input
                id="dueDate"
                type="date"
                className={`form-input ${errors.dueDate ? 'input-error' : ''}`}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              {errors.dueDate && <span className="field-error">{errors.dueDate}</span>}
              <span className="field-help">Can be today, future, or past (for recording overdue loans)</span>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
