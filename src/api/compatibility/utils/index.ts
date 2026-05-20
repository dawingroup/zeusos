/**
 * Utils Index
 * Export all compatibility utilities
 */

export {
  FieldMapper,
  PROGRAM_MAPPING,
  PROJECT_MAPPING,
  IPC_MAPPING,
  DEAL_MAPPING,
  REQUISITION_MAPPING,
} from './field-mapper';

export {
  TypeCoercer,
  typeCoercer,
  coerceToString,
  coerceToNumber,
  coerceToBoolean,
  coerceToDateString,
  coerceToArray,
  coerceToObject,
  formatCurrency,
  parseCurrency,
  formatPercentage,
  parsePercentage,
  normalizeStatus,
  denormalizeStatus,
  timestampToISO,
  deepCloneWithCoercion,
} from './type-coercer';
