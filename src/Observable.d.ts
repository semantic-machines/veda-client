type ObservableClass<T = any> = new (...args: any[]) => T;

export default function Observable<T extends ObservableClass>(Class?: T): {
  new (...args: any[]): InstanceType<T>;
} & T;

