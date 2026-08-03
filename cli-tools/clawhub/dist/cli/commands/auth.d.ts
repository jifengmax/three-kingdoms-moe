import type { GlobalOpts } from "../types.js";
export declare function cmdLoginFlow(opts: GlobalOpts, options: {
    token?: string;
    label?: string;
    browser?: boolean;
    device?: boolean;
}, inputAllowed: boolean): Promise<void>;
export declare function cmdLogout(opts: GlobalOpts): Promise<void>;
export declare function cmdWhoami(opts: GlobalOpts): Promise<void>;
export declare function cmdToken(): Promise<void>;
/**
 * Device Flow login for headless environments.
 * Requests a device code, displays it to the user, then polls until authorized.
 */
export declare function cmdDeviceLogin(opts: GlobalOpts, options?: {
    label?: string;
}): Promise<void>;
