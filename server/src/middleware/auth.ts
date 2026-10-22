import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';

const DEFAULT_JWT_EXPIRY = '7d';

/**
 * Retrieves the JWT Secret from environment variables.
 * Throws an error if JWT_SECRET is not configured.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not defined.');
  }
  return secret;
}

/**
 * Signs a JWT with the user's ID as the subject.
 */
export function generateToken(
  user: { id: string; phone?: string },
  expiresIn: string | number = DEFAULT_JWT_EXPIRY
): string {
  const secret = getJwtSecret();
  const options: SignOptions = {
    subject: user.id,
    expiresIn: expiresIn as any,
  };

  return jwt.sign({ phone: user.phone }, secret, options);
}

/**
 * Express middleware to authenticate JWT bearer tokens.
 * Attaches the verified user ID and phone to `req.user`.
 */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token is required',
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Malformed authorization header. Expected "Bearer <token>"',
    });
    return;
  }

  const token = parts[1];

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as JwtPayload;

    if (!decoded || !decoded.sub) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token payload: missing subject identifier',
      });
      return;
    }

    // Attach verified user identity to request context
    req.user = {
      id: decoded.sub,
      phone: typeof decoded.phone === 'string' ? decoded.phone : undefined,
    };

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Token has expired. Please log in again.',
      });
      return;
    }

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authentication token',
    });
    return;
  }
}
