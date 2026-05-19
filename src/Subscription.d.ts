type SubscriptionCallback = (id: string, updateCounter?: number) => void;
type SubscriptionTuple = [id: string, updateCounter: number, callback: SubscriptionCallback];

export default class Subscription {
  static init(address?: string): void;

  static subscribe(ref: object, subscription: SubscriptionTuple): void;
  static release(ref: object): void;
  static unsubscribe(id: string): void;

  static _getSubscriptionCount(): number;
  static _getRefCount(id: string): number;
}
