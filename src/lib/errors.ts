/**
 * Typed error classes for structured error handling across the pipeline.
 * Inngest's onFailure handler receives these and routes to correct alert format.
 */

export class DocumentProcessingError extends Error {
  readonly documentId: string;
  readonly step: string;

  constructor(message: string, documentId: string, step: string) {
    super(message);
    this.name = 'DocumentProcessingError';
    this.documentId = documentId;
    this.step = step;
    // Maintain correct prototype chain in transpiled environments
    Object.setPrototypeOf(this, DocumentProcessingError.prototype);
  }
}

export class EmbeddingError extends Error {
  readonly chunkCount: number;

  constructor(message: string, chunkCount: number) {
    super(message);
    this.name = 'EmbeddingError';
    this.chunkCount = chunkCount;
    Object.setPrototypeOf(this, EmbeddingError.prototype);
  }
}

export class RerankError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RerankError';
    Object.setPrototypeOf(this, RerankError.prototype);
  }
}

export class ExtractionError extends Error {
  readonly sourceType: string;

  constructor(message: string, sourceType: string) {
    super(message);
    this.name = 'ExtractionError';
    this.sourceType = sourceType;
    Object.setPrototypeOf(this, ExtractionError.prototype);
  }
}

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds = 60) {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class AuthorizationError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}
