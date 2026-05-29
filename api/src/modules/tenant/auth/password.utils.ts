import { AppError } from '../../../shared/errors.js';

/** Validates tenant password policy: 8+ chars, letter and number */
export function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Senha deve ter no mínimo 8 caracteres');
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Senha deve conter ao menos uma letra e um número',
    );
  }
}
