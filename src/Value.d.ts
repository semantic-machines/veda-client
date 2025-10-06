import Model from './Model.js';

export type ValueType = 'String' | 'Uri' | 'Integer' | 'Decimal' | 'Boolean' | 'Datetime';

export interface ValueData {
  data: string | number | boolean;
  type: ValueType;
  lang?: string;
}

export type PrimitiveValue = string | number | boolean | Date | Model;

export default class Value implements ValueData {
  data: string | number | boolean;
  type: ValueType;
  lang?: string;

  constructor(data: any, type?: ValueType | null, lang?: string | null);

  static parse(value: ValueData): PrimitiveValue;
  static serialize(value: PrimitiveValue): Value | undefined;
  static areEqual(first: Value, second: Value): boolean;
  
  isEqual(value: Value): boolean;
}

