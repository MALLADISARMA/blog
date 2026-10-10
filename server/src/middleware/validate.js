import { HttpError } from './errors.js';

export function validate(object, rules) {
  const values = {};
  for (const [key, rule] of Object.entries(rules)) {
    const value = object?.[key];
    if (rule.required && (typeof value !== 'string' || !value.trim())) {
      throw new HttpError(400, `${key} is required`);
    }
    if (value !== undefined && value !== null) {
      if (typeof value !== rule.type || (rule.type === 'string' && value.length > rule.max)) {
        throw new HttpError(400, `${key} is invalid`);
      }
      values[key] = rule.type === 'string' ? value.trim() : value;
    }
  }
  return values;
}
