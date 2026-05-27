/**
 * Published @httptoolkit/accounts@3.1.0 types omit subscription helpers that exist
 * in newer @httptoolkit/accounts builds. The UI expects these on every User instance.
 */
import '@httptoolkit/accounts';

declare module '@httptoolkit/accounts' {
    interface User {
        isStatusUnexpired(): boolean;
        isPaidUser(): boolean;
        isPastDueUser(): boolean;
        userHasSubscription(): boolean;
    }
}
