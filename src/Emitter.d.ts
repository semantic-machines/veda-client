type EmitterClass<T = any> = new (...args: any[]) => T;

export default function Emitter<T extends EmitterClass>(Class?: T): {
  new (...args: any[]): InstanceType<T> & EmitterInstance;
} & T;

export interface EmitterInstance {
  on(events: string, fn: (...args: any[]) => void): this;
  off(events: string, fn?: (...args: any[]) => void): this;
  one(name: string, fn: (...args: any[]) => void): this;
  once(name: string, fn: (...args: any[]) => void): this;
  emit(name: string, ...args: any[]): this;
  trigger(name: string, ...args: any[]): this;
}

