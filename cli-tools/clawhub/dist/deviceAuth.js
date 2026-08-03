/**
 * GitHub Device Flow authentication for headless environments.
 *
 * Implements RFC 8628 / GitHub's Device Flow:
 * https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 *
 * This allows CLI authentication without a browser redirect to localhost,
 * enabling headless agents and remote servers to authenticate.
 */
const DEFAULT_SCOPE = "read write";
/**
 * Request a device code from the ClawHub device flow endpoint.
 */
export async function requestDeviceCode(config) {
    const url = new URL("/api/cli/device/code", config.apiUrl);
    const body = {
        scope: config.scope ?? DEFAULT_SCOPE,
        site_url: config.siteUrl,
    };
    if (config.label) {
        body.label = config.label;
    }
    if (config.clientId) {
        body.client_id = config.clientId;
    }
    const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Device code request failed (${response.status}): ${text || response.statusText}`);
    }
    const data = await response.json().catch(() => null);
    if (!isDeviceCodeResponse(data)) {
        throw new Error("Invalid device code response from server");
    }
    return data;
}
/**
 * Poll for the device flow token until the user completes authorization,
 * the code expires, or an unrecoverable error occurs.
 */
export async function pollForDeviceToken(config, deviceCode, options) {
    const url = new URL("/api/cli/device/token", config.apiUrl);
    const deadline = Date.now() + options.expiresIn * 1000;
    const expirationMessage = "Device code expired (timeout). Please try again.";
    let interval = options.interval * 1000;
    const body = {
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    };
    if (config.clientId) {
        body.client_id = config.clientId;
    }
    while (Date.now() < deadline) {
        await sleep(interval);
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
            break;
        }
        const controller = new AbortController();
        let timeout;
        let response;
        try {
            response = await new Promise((resolve, reject) => {
                timeout = setTimeout(() => {
                    controller.abort();
                    reject(new Error(expirationMessage));
                }, remainingMs);
                void fetch(url.toString(), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify(body),
                    signal: controller.signal,
                }).then(resolve, reject);
            });
        }
        catch (error) {
            if (controller.signal.aborted) {
                throw new Error(expirationMessage, { cause: error });
            }
            throw error;
        }
        finally {
            if (timeout !== undefined) {
                clearTimeout(timeout);
            }
        }
        // Parse JSON once to avoid "body already read" errors
        const data = await response.json().catch(() => null);
        if (response.ok) {
            if (!isDeviceTokenResponse(data)) {
                throw new Error("Invalid device token response from server");
            }
            return data;
        }
        if (!isRecord(data)) {
            throw new Error("Invalid device token response from server");
        }
        const errorData = data;
        switch (errorData.error) {
            case "authorization_pending":
                // User hasn't completed auth yet — keep polling
                break;
            case "slow_down":
                // Server requests longer interval
                interval = (errorData.interval ?? Math.ceil(interval / 1000) + 5) * 1000;
                break;
            case "expired_token":
                throw new Error("Device code expired. Please try again.");
            case "access_denied":
                throw new Error("Authorization denied by user.");
            default:
                throw new Error(`Device flow error: ${errorData.error_description || errorData.error || "unknown error"}`);
        }
    }
    throw new Error(expirationMessage);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function isPositiveFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function isDeviceCodeResponse(value) {
    return (isRecord(value) &&
        isNonEmptyString(value.device_code) &&
        isNonEmptyString(value.user_code) &&
        isNonEmptyString(value.verification_uri) &&
        isPositiveFiniteNumber(value.expires_in) &&
        isPositiveFiniteNumber(value.interval));
}
function isDeviceTokenResponse(value) {
    return (isRecord(value) &&
        isNonEmptyString(value.access_token) &&
        isNonEmptyString(value.token_type) &&
        isNonEmptyString(value.scope));
}
//# sourceMappingURL=deviceAuth.js.map