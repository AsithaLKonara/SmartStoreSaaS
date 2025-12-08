import { NextRequest, NextResponse } from 'next/server';
import { Session } from 'next-auth';
import { Prisma } from '@prisma/client';

export interface ApiErrorContext {
  route: string;
  method: string;
  session?: Session | null;
  error: Error | unknown;
  timestamp: string;
  organizationId?: string | null;
  userId?: string | null;
}

/**
 * Format error for logging
 */
function formatError(error: unknown): { message: string; stack?: string; type: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
    };
  }
  return {
    message: String(error),
    type: typeof error,
  };
}

/**
 * Check if error is a Prisma error
 */
function isPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    'meta' in error &&
    'clientVersion' in error
  );
}

/**
 * Check if error is a connection error
 */
function isConnectionError(error: unknown): boolean {
  if (isPrismaError(error)) {
    return error.code === 'P1001' || error.code === 'P1002' || error.code === 'P1008';
  }
  if (error instanceof Error) {
    return (
      error.message.includes('connection') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('timeout')
    );
  }
  return false;
}

/**
 * Check if error is an authentication error
 */
function isAuthError(error: unknown, session: Session | null | undefined): boolean {
  // If no session, it's an auth error
  if (!session) {
    return true;
  }
  
  // Check for missing organizationId
  if (!session.user?.organizationId) {
    return true;
  }
  
  return false;
}

/**
 * Get appropriate HTTP status code for error
 */
function getStatusCode(error: unknown, session: Session | null | undefined): number {
  // Auth errors should return 401
  if (isAuthError(error, session)) {
    return 401;
  }
  
  // Connection errors might be temporary
  if (isConnectionError(error)) {
    return 503; // Service Unavailable
  }
  
  // Prisma validation errors
  if (isPrismaError(error)) {
    if (error.code === 'P2002') {
      return 409; // Conflict
    }
    if (error.code === 'P2025') {
      return 404; // Not Found
    }
  }
  
  // Default to 500
  return 500;
}

/**
 * Log error with context
 */
function logError(context: ApiErrorContext): void {
  const { route, method, session, error, timestamp, organizationId, userId } = context;
  const errorDetails = formatError(error);
  
  const logData = {
    timestamp,
    route: `${method} ${route}`,
    error: {
      type: errorDetails.type,
      message: errorDetails.message,
      ...(process.env.NODE_ENV === 'development' && { stack: errorDetails.stack }),
    },
    session: {
      userId: userId || session?.user?.id || 'none',
      email: session?.user?.email || 'none',
      role: session?.user?.role || 'none',
      organizationId: organizationId || session?.user?.organizationId || 'none',
    },
    ...(isPrismaError(error) && {
      prisma: {
        code: error.code,
        meta: error.meta,
      },
    }),
  };
  
  console.error('[API Error]', JSON.stringify(logData, null, 2));
}

/**
 * Handle API errors with proper logging and response
 */
export function handleApiError(
  error: unknown,
  request: NextRequest,
  session: Session | null | undefined
): NextResponse {
  const context: ApiErrorContext = {
    route: request.url,
    method: request.method,
    session,
    error,
    timestamp: new Date().toISOString(),
    organizationId: session?.user?.organizationId,
    userId: session?.user?.id,
  };
  
  // Log the error
  logError(context);
  
  // Determine status code
  const statusCode = getStatusCode(error, session);
  
  // Format error message
  const errorDetails = formatError(error);
  let errorMessage = 'Internal server error';
  
  if (process.env.NODE_ENV === 'development') {
    errorMessage = errorDetails.message;
  } else {
    // In production, provide generic messages based on error type
    if (statusCode === 401) {
      errorMessage = 'Unauthorized';
    } else if (statusCode === 503) {
      errorMessage = 'Service temporarily unavailable';
    } else if (statusCode === 404) {
      errorMessage = 'Resource not found';
    } else if (statusCode === 409) {
      errorMessage = 'Conflict';
    }
  }
  
  return NextResponse.json(
    {
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && {
        error: errorDetails.message,
        type: errorDetails.type,
      }),
    },
    { status: statusCode }
  );
}

/**
 * Validate session and organizationId
 */
export function validateSession(
  session: Session | null | undefined
): { valid: boolean; error?: string } {
  if (!session) {
    return { valid: false, error: 'No session found' };
  }
  
  if (!session.user) {
    return { valid: false, error: 'No user in session' };
  }
  
  if (!session.user.organizationId) {
    return { valid: false, error: 'No organizationId in session' };
  }
  
  return { valid: true };
}

/**
 * Wrapper for API route handlers with error handling
 */
export function withErrorHandling<T>(
  handler: (request: NextRequest, session: Session | null | undefined) => Promise<T>,
  getSession: (request: NextRequest) => Promise<Session | null | undefined>
) {
  return async (request: NextRequest): Promise<NextResponse | T> => {
    try {
      const session = await getSession(request);
      return await handler(request, session);
    } catch (error) {
      const session = await getSession(request).catch(() => null);
      return handleApiError(error, request, session);
    }
  };
}

