// api/src/errors.ts
export class NotFoundError extends Error {}
export class ValidationError extends Error {}
export class ConflictError extends Error {}
export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}