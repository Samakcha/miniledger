import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Enforce authentication on all loan endpoints
router.use(authenticateToken);

const MAX_FRIEND_NAME_LENGTH = 100;
const MAX_MONETARY_AMOUNT = new Prisma.Decimal('9999999999.99'); // Decimal(12, 2) maximum

/**
 * Standard serialization helper for loan objects
 */
function formatLoan(loan: {
  id: string;
  friendName: string;
  amount: Prisma.Decimal | any;
  dueDate: Date;
  isRepaid: boolean;
  repaidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}) {
  return {
    id: loan.id,
    friendName: loan.friendName,
    amount: typeof loan.amount?.toFixed === 'function' ? loan.amount.toFixed(2) : String(loan.amount),
    dueDate: loan.dueDate.toISOString(),
    isRepaid: loan.isRepaid,
    repaidAt: loan.repaidAt ? loan.repaidAt.toISOString() : null,
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
    userId: loan.userId,
  };
}

/**
 * POST /api/loans
 * Create a new loan record for the authenticated user
 */
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { friendName, amount, dueDate } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authenticated user context missing',
      });
      return;
    }

    // 1. Validate friendName
    if (typeof friendName !== 'string' || !friendName.trim()) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Friend name is required and cannot be empty',
      });
      return;
    }
    const trimmedName = friendName.trim();
    if (trimmedName.length > MAX_FRIEND_NAME_LENGTH) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Friend name cannot exceed ${MAX_FRIEND_NAME_LENGTH} characters`,
      });
      return;
    }

    // 2. Validate amount
    if (amount === undefined || amount === null || typeof amount === 'boolean') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Amount is required',
      });
      return;
    }

    const amountStr = String(amount).trim();
    // Validate positive decimal number format with at most 2 decimal digits
    if (!/^\d+(\.\d{1,2})?$/.test(amountStr)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Amount must be a positive number with at most 2 decimal places',
      });
      return;
    }

    let decimalAmount: Prisma.Decimal;
    try {
      decimalAmount = new Prisma.Decimal(amountStr);
    } catch {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid monetary amount format',
      });
      return;
    }

    if (decimalAmount.isZero() || decimalAmount.isNegative()) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Amount must be greater than zero',
      });
      return;
    }

    if (decimalAmount.greaterThan(MAX_MONETARY_AMOUNT)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Amount exceeds maximum supported limit of 9,999,999,999.99',
      });
      return;
    }

    // 3. Validate dueDate
    if (!dueDate) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Due date is required',
      });
      return;
    }

    const parsedDueDate = new Date(dueDate);
    if (isNaN(parsedDueDate.getTime())) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Due date must be a valid ISO 8601 date string',
      });
      return;
    }

    // 4. Persist loan (ignoring any client-supplied userId)
    const newLoan = await prisma.loan.create({
      data: {
        friendName: trimmedName,
        amount: decimalAmount,
        dueDate: parsedDueDate,
        userId,
      },
    });

    const formatted = formatLoan(newLoan);
    res.status(201).json({
      ...formatted,
      loan: formatted,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/loans/summary
 * Compute summary totals for the authenticated user
 */
router.get('/summary', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authenticated user context missing',
      });
      return;
    }

    const userLoans = await prisma.loan.findMany({
      where: { userId },
      select: {
        amount: true,
        isRepaid: true,
        dueDate: true,
      },
    });

    let totalLent = new Prisma.Decimal(0);
    let totalRepaid = new Prisma.Decimal(0);
    let overdueAmount = new Prisma.Decimal(0);

    const now = new Date();

    for (const loan of userLoans) {
      totalLent = totalLent.add(loan.amount);
      if (loan.isRepaid) {
        totalRepaid = totalRepaid.add(loan.amount);
      } else if (loan.dueDate < now) {
        overdueAmount = overdueAmount.add(loan.amount);
      }
    }

    res.status(200).json({
      totalLent: totalLent.toFixed(2),
      totalRepaid: totalRepaid.toFixed(2),
      overdueAmount: overdueAmount.toFixed(2),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/loans
 * List all loans belonging to the authenticated user
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authenticated user context missing',
      });
      return;
    }

    const loans = await prisma.loan.findMany({
      where: { userId },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const formattedLoans = loans.map(formatLoan);

    res.status(200).json({
      loans: formattedLoans,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/loans/:id/repay
 * Mark a loan as repaid for the authenticated user
 */
router.patch('/:id/repay', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authenticated user context missing',
      });
      return;
    }

    if (!id || typeof id !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Loan ID is required',
      });
      return;
    }

    // Find loan verifying BOTH id and userId
    const existingLoan = await prisma.loan.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingLoan) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Loan not found',
      });
      return;
    }

    // If already repaid, return clear idempotent response without altering timestamp
    if (existingLoan.isRepaid) {
      const formatted = formatLoan(existingLoan);
      res.status(200).json({
        message: 'Loan is already marked as repaid',
        ...formatted,
        loan: formatted,
      });
      return;
    }

    // Update loan to repaid
    const updatedLoan = await prisma.loan.update({
      where: { id: existingLoan.id },
      data: {
        isRepaid: true,
        repaidAt: new Date(),
      },
    });

    const formatted = formatLoan(updatedLoan);
    res.status(200).json({
      message: 'Loan marked as repaid successfully',
      ...formatted,
      loan: formatted,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
