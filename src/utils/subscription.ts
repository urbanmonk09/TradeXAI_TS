export type Subscription = "Free" | "Pro";

let userSubscription: Subscription = "Free";

export const setSubscription = (sub: Subscription) => {
  userSubscription = sub;
};

export const getSubscription = (): Subscription => userSubscription;
