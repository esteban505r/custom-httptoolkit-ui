import type { User } from '@httptoolkit/accounts';

/**
 * Local fork override: when true, every User reports Pro access without a real
 * subscription. Flip to false to use real subscription state.
 */
export const PRO_FOR_TESTING = true;

/**
 * Adds subscription helper methods expected by the UI. Mirrors logic from
 * @httptoolkit/accounts addSubscriptionHelpers (not yet in published 3.1.0).
 */
export function enrichUser(userData: User): User {
    const user = { ...userData } as User;

    user.isStatusUnexpired = function isStatusUnexpired() {
        const subscriptionExpiry = userData.subscription?.expiry;
        const subscriptionStatus = userData.subscription?.status;

        const expiryMargin = subscriptionStatus === 'active'
            ? 1000 * 60 * 60 * 24 * 7 // one week offline slack for active subs
            : 0;

        return !!subscriptionExpiry &&
            subscriptionExpiry.valueOf() + expiryMargin > Date.now();
    };

    user.isPaidUser = function isPaidUser() {
        return userData.subscription?.status !== 'past_due' &&
            user.isStatusUnexpired();
    };

    user.isPastDueUser = function isPastDueUser() {
        return userData.subscription?.status === 'past_due' &&
            user.isStatusUnexpired();
    };

    user.userHasSubscription = function userHasSubscription() {
        return user.isPaidUser() || user.isPastDueUser();
    };

    if (PRO_FOR_TESTING) {
        user.isStatusUnexpired = () => true;
        user.isPaidUser = () => true;
        user.userHasSubscription = () => true;
        user.isPastDueUser = () => false;
    }

    return user;
}
