import { EmitterInstance } from './Emitter.js';
import { IndividualData } from './Backend.js';
import WeakCache from './WeakCache.js';
import { PrimitiveValue } from './Value.js';

export type ModelValue = PrimitiveValue;

export default class Model implements EmitterInstance {
  static cache: WeakCache<string, Model>;

  id: string;
  [property: string]: ModelValue | ModelValue[] | any;

  constructor(data?: string | IndividualData | null);

  apply(data: IndividualData): void;
  toJSON(): IndividualData;
  toString(): string;

  subscribe(): void;
  unsubscribe(): void;

  isNew(value?: boolean): boolean;
  isSync(value?: boolean): boolean;
  isLoaded(value?: boolean): boolean;

  hasValue(prop?: string, value?: any): boolean;
  addValue(prop: string, value: ModelValue): void;
  removeValue(prop?: string, value?: ModelValue): void;

  getPropertyChain(...props: string[]): Promise<ModelValue | ModelValue[] | undefined>;

  load(cache?: boolean): Promise<this>;
  reset(): Promise<this>;
  save(): Promise<this>;
  remove(): Promise<this>;

  toLabel(prop?: string, lang?: string[]): string;

  loadMemberships(): Promise<Model>;
  isMemberOf(id: string): Promise<boolean>;

  loadRight(): Promise<Model>;
  canCreate(): Promise<boolean>;
  canRead(): Promise<boolean>;
  canUpdate(): Promise<boolean>;
  canDelete(): Promise<boolean>;

  // Emitter interface
  on(events: string, fn: (...args: any[]) => void): this;
  off(events: string, fn?: (...args: any[]) => void): this;
  one(name: string, fn: (...args: any[]) => void): this;
  once(name: string, fn: (...args: any[]) => void): this;
  emit(name: string, ...args: any[]): this;
  trigger(name: string, ...args: any[]): this;
}

