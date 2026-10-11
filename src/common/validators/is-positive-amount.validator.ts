import { type ValidationOptions, registerDecorator } from 'class-validator';
import { isPositiveAmount } from '../money';

// Keeps the "greater than zero" rule next to the decimal parsing, so a value
// like "0.00" is rejected without converting it to a number.
export function IsPositiveAmount(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isPositiveAmount',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be greater than zero`,
        ...options,
      },
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isPositiveAmount(value),
      },
    });
  };
}
