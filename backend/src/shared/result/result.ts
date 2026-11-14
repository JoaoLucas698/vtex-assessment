import type { AppError } from '@shared/errors/app-error';

export type ResultSuccess<T> = {
  readonly isSuccess: true;
  readonly isFailure: false;
  readonly value: T;
};
export type ResultError<E> = {
  readonly isSuccess: false;
  readonly isFailure: true;
  readonly error: E;
};
export type Result<T, E = AppError> = ResultSuccess<T> | ResultError<E>;

export const Result = {
  success: <T>(value: T): ResultSuccess<T> => ({
    isSuccess: true,
    isFailure: false,
    value,
  }),
  error: <E>(error: E): ResultError<E> => ({
    isSuccess: false,
    isFailure: true,
    error,
  }),
};
