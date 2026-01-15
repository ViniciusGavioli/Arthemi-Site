// ===========================================================
// ERRORS - Re-exports centralizados
// ===========================================================

// Códigos e tipos
export { 
  BusinessErrorCode, 
  ErrorCodeToStatus, 
  DefaultErrorMessages 
} from './error-codes';

// Classe base
export { 
  BusinessError, 
  isBusinessError,
  type ErrorDetails,
} from './business-error';

// Handler principal
export {
  errorToHttpResponse,
  respondError,
  businessError,
  type ErrorResponse,
  type ParsedError,
  type LogContext,
} from './error-handler';

// Prisma
export {
  isPrismaError,
  prismaErrorToBusinessError,
  isOverbookingPrismaError,
  PrismaErrorCodes,
} from './prisma-errors';
