/**
 * GitHub Device Flow authentication for headless environments.
 *
 * Implements RFC 8628 / GitHub's Device Flow:
 * https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 *
 * This allows CLI authentication without a browser redirect to localhost,
 * enabling headless agents and remote servers to authenticate.
 */
type DeviceCodeResponse = {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
};
type DeviceTokenResponse = {
    access_token: string;
    token_type: string;
    scope: string;
};
type DeviceFlowConfig = {
    /** The ClawHub API URL that exposes device flow endpoints */
    apiUrl: string;
    /** The ClawHub site URL that hosts the verification page */
    siteUrl: string;
    /** Token label to show during approval and store on the created token */
    label?: string;
    /** Client ID for the OAuth app (provided by ClawHub) */
    clientId?: string;
    /** Scope to request */
    scope?: string;
};
/**
 * Request a device code from the ClawHub device flow endpoint.
 */
export declare function requestDeviceCode(config: DeviceFlowConfig): Promise<DeviceCodeResponse>;
/**
 * Poll for the device flow token until the user completes authorization,
 * the code expires, or an unrecoverable error occurs.
 */
export declare function pollForDeviceToken(config: DeviceFlowConfig, deviceCode: string, options: {
    interval: number;
    expiresIn: number;
}): Promise<DeviceTokenResponse>;
export {};
