import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { otpService, normalizePhoneNumber } from '../services/otp';
import { generateToken, authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/request-otp
 * Body: { "phone": string }
 */
router.post('/request-otp', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { phone } = req.body;

    if (!phone) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Phone number is required',
      });
      return;
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(phone);
    } catch (normErr: any) {
      res.status(400).json({
        error: 'Bad Request',
        message: normErr.message || 'Invalid phone number format',
      });
      return;
    }

    const result = otpService.requestOtp(normalizedPhone);

    if (!result.success) {
      res.status(result.status || 429).json({
        error: 'Too Many Requests',
        message: result.error,
      });
      return;
    }

    // Success response - never disclose OTP or whether user exists
    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/verify-otp
 * Body: { "phone": string, "otp": string }
 */
router.post('/verify-otp', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Both phone number and OTP are required',
      });
      return;
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(phone);
    } catch (normErr: any) {
      res.status(400).json({
        error: 'Bad Request',
        message: normErr.message || 'Invalid phone number format',
      });
      return;
    }

    // Verify OTP using constant-time check & attempt limits
    const verifyResult = otpService.verifyOtp(normalizedPhone, otp);

    if (!verifyResult.valid) {
      const statusCode = verifyResult.status || 400;
      res.status(statusCode).json({
        error: statusCode === 429 ? 'Too Many Requests' : 'Unauthorized',
        message: verifyResult.error,
      });
      return;
    }

    // Only create or fetch user AFTER successful OTP verification
    let user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { phone: normalizedPhone },
      });
    }

    // Issue JWT token
    const token = generateToken({
      id: user.id,
      phone: user.phone,
    });

    res.status(200).json({
      token,
      user: {
        id: user.id,
        phone: user.phone,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Protected endpoint to retrieve authenticated user details using JWT
 */
router.get('/me', authenticateToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication missing',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        error: 'Not Found',
        message: 'User account not found',
      });
      return;
    }

    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
