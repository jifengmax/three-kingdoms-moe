import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import pRetry, { AbortError } from "p-retry";
import { Agent, EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { ApiRoutes, parseArk } from "./schema/index.js";
const REQUEST_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_SECONDS = Math.ceil(REQUEST_TIMEOUT_MS / 1000);
const UPLOAD_TIMEOUT_SECONDS = Math.ceil(UPLOAD_TIMEOUT_MS / 1000);
const RETRY_COUNT = 2;
const RETRY_BACKOFF_BASE_MS = 300;
const RETRY_BACKOFF_MAX_MS = 5_000;
const RETRY_AFTER_JITTER_MS = 250;
const CURL_META_MARKER = "__CLAWHUB_CURL_META__";
const CURL_WRITE_OUT_FORMAT = [
    "",
    CURL_META_MARKER,
    "%{http_code}",
    "%{header:x-ratelimit-limit}",
    "%{header:x-ratelimit-remaining}",
    "%{header:x-ratelimit-reset}",
    "%{header:ratelimit-limit}",
    "%{header:ratelimit-remaining}",
    "%{header:ratelimit-reset}",
    "%{header:retry-after}",
].join("\n");
class HttpStatusError extends Error {
    status;
    rateLimit;
    constructor(status, message, rateLimit) {
        super(message);
        this.name = "HttpStatusError";
        this.status = status;
        this.rateLimit = rateLimit;
    }
}
export function detectHttpRuntime(processVersions = process.versions) {
    return processVersions?.bun ? "bun" : "node";
}
export function shouldUseProxyFromEnv(env = process.env) {
    return Boolean(env.HTTPS_PROXY || env.HTTP_PROXY || env.https_proxy || env.http_proxy);
}
export function registryUrl(path, registry) {
    const base = registry.endsWith("/") ? registry : `${registry}/`;
    const relative = path.startsWith("/") ? path.slice(1) : path;
    return new URL(relative, base);
}
export function createHttpClient(options = {}) {
    const deps = {
        runtime: options.runtime ?? detectHttpRuntime(),
        fetchImpl: options.fetchImpl ?? globalThis.fetch.bind(globalThis),
        setTimeoutImpl: options.setTimeoutImpl ?? globalThis.setTimeout.bind(globalThis),
        clearTimeoutImpl: options.clearTimeoutImpl ?? globalThis.clearTimeout.bind(globalThis),
        spawnSyncImpl: options.spawnSyncImpl ?? spawnSync,
        mkdirImpl: options.mkdirImpl ?? mkdir,
        mkdtempImpl: options.mkdtempImpl ?? mkdtemp,
        readFileImpl: options.readFileImpl ?? readFile,
        rmImpl: options.rmImpl ?? rm,
        writeFileImpl: options.writeFileImpl ?? writeFile,
        tmpdirPath: options.tmpdirPath ?? tmpdir(),
        now: options.now ?? Date.now,
        random: options.random ?? Math.random,
        env: options.env ?? process.env,
        configureDispatcher: options.configureDispatcher ?? true,
    };
    if (deps.runtime === "node" && deps.configureDispatcher) {
        configureNodeDispatcher(deps.env);
    }
    const runWithRetries = createRetryRunner(deps);
    async function apiRequest(registry, args, schema) {
        const url = "url" in args ? args.url : registryUrl(args.path, registry).toString();
        const json = await runWithRetries(async () => {
            if (deps.runtime === "bun") {
                return await fetchJsonViaCurl(deps, url, args);
            }
            const headers = { Accept: "application/json" };
            if (args.token)
                headers.Authorization = `Bearer ${args.token}`;
            let body;
            if (args.body !== undefined || args.method === "POST") {
                headers["Content-Type"] = "application/json";
                body = JSON.stringify(args.body ?? {});
            }
            const response = await fetchWithTimeout(deps, url, {
                method: args.method,
                headers,
                body,
            });
            if (!response.ok && !isAcceptedStatus(response.status, args.acceptedStatuses)) {
                throwHttpStatusError(response.status, await readResponseTextSafe(response), response.headers, deps.now);
            }
            return (await response.json());
        }, args.retryCount);
        if (schema)
            return parseArk(schema, json, "API response");
        return json;
    }
    async function apiRequestForm(registry, args, schema) {
        const url = "url" in args ? args.url : registryUrl(args.path, registry).toString();
        const json = await runWithRetries(async () => {
            if (deps.runtime === "bun") {
                return await fetchJsonFormViaCurl(deps, url, args);
            }
            const headers = { Accept: "application/json" };
            if (args.token)
                headers.Authorization = `Bearer ${args.token}`;
            const response = await fetchWithTimeout(deps, url, {
                method: args.method,
                headers,
                body: args.form,
            }, UPLOAD_TIMEOUT_MS);
            if (!response.ok) {
                throwHttpStatusError(response.status, await readResponseTextSafe(response), response.headers, deps.now);
            }
            return (await response.json());
        }, args.retryCount);
        if (schema)
            return parseArk(schema, json, "API response");
        return json;
    }
    async function fetchTextRequest(registry, args) {
        const url = "url" in args ? args.url : registryUrl(args.path, registry).toString();
        return await runWithRetries(async () => {
            if (deps.runtime === "bun") {
                return await fetchTextViaCurl(deps, url, args);
            }
            const headers = { Accept: "text/plain" };
            if (args.token)
                headers.Authorization = `Bearer ${args.token}`;
            const response = await fetchWithTimeout(deps, url, { method: "GET", headers });
            const text = await response.text();
            if (!response.ok) {
                throwHttpStatusError(response.status, text, response.headers, deps.now);
            }
            return text;
        });
    }
    async function fetchBinaryRequest(registry, args) {
        const url = "url" in args ? args.url : registryUrl(args.path, registry).toString();
        return await runWithRetries(async () => {
            if (deps.runtime === "bun") {
                return await fetchBinaryViaCurl(deps, url, args.token);
            }
            const headers = {};
            if (args.token)
                headers.Authorization = `Bearer ${args.token}`;
            const response = await fetchWithTimeout(deps, url, { method: "GET", headers });
            if (!response.ok) {
                throwHttpStatusError(response.status, await readResponseTextSafe(response), response.headers, deps.now);
            }
            return new Uint8Array(await response.arrayBuffer());
        });
    }
    async function uploadBinaryRequest(args, schema) {
        const json = await runWithRetries(async () => {
            if (deps.runtime === "bun") {
                return await uploadBinaryViaCurl(deps, args);
            }
            const headers = {};
            if (args.contentType)
                headers["Content-Type"] = args.contentType;
            const response = await fetchWithTimeout(deps, args.url, {
                method: "POST",
                headers,
                body: bytesToArrayBuffer(args.bytes),
            }, UPLOAD_TIMEOUT_MS);
            if (!response.ok) {
                throwHttpStatusError(response.status, await readResponseTextSafe(response), response.headers, deps.now);
            }
            return (await response.json());
        }, args.retryCount);
        if (schema)
            return parseArk(schema, json, "API response");
        return json;
    }
    async function downloadZipRequest(registry, args) {
        const url = registryUrl(ApiRoutes.download, registry);
        url.searchParams.set("slug", args.slug);
        if (args.ownerHandle)
            url.searchParams.set("ownerHandle", args.ownerHandle);
        if (args.version)
            url.searchParams.set("version", args.version);
        return await runWithRetries(async () => {
            if (deps.runtime === "bun") {
                return await fetchBinaryViaCurl(deps, url.toString(), args.token);
            }
            const headers = {};
            if (args.token)
                headers.Authorization = `Bearer ${args.token}`;
            const response = await fetchWithTimeout(deps, url.toString(), { method: "GET", headers });
            if (!response.ok) {
                throwHttpStatusError(response.status, await readResponseTextSafe(response), response.headers, deps.now);
            }
            return new Uint8Array(await response.arrayBuffer());
        });
    }
    return {
        apiRequest,
        apiRequestForm,
        fetchText: fetchTextRequest,
        fetchBinary: fetchBinaryRequest,
        uploadBinary: uploadBinaryRequest,
        downloadZip: downloadZipRequest,
    };
}
function configureNodeDispatcher(env) {
    if (!process.versions?.node)
        return;
    try {
        setGlobalDispatcher(shouldUseProxyFromEnv(env)
            ? new EnvHttpProxyAgent({
                connect: { timeout: REQUEST_TIMEOUT_MS },
            })
            : new Agent({
                connect: { timeout: REQUEST_TIMEOUT_MS },
            }));
    }
    catch {
        // Ignore dispatcher setup failures in environments that partially emulate Node APIs.
    }
}
const defaultHttpClient = createHttpClient();
export async function apiRequest(registry, args, schema) {
    if (schema) {
        return await defaultHttpClient.apiRequest(registry, args, schema);
    }
    return await defaultHttpClient.apiRequest(registry, args);
}
export async function apiRequestForm(registry, args, schema) {
    if (schema) {
        return await defaultHttpClient.apiRequestForm(registry, args, schema);
    }
    return await defaultHttpClient.apiRequestForm(registry, args);
}
export async function fetchText(registry, args) {
    return await defaultHttpClient.fetchText(registry, args);
}
export async function fetchBinary(registry, args) {
    return await defaultHttpClient.fetchBinary(registry, args);
}
export async function uploadBinary(args, schema) {
    return await defaultHttpClient.uploadBinary(args, schema);
}
export async function downloadZip(registry, args) {
    return await defaultHttpClient.downloadZip(registry, args);
}
function createRetryRunner(deps) {
    return async function runWithRetries(fn, retryCount = RETRY_COUNT) {
        return await pRetry(fn, {
            retries: retryCount,
            minTimeout: 0,
            maxTimeout: 0,
            factor: 1,
            randomize: false,
            onFailedAttempt: async (attemptError) => {
                const delayMs = getRetryDelayMs(attemptError, deps.random);
                if (delayMs <= 0)
                    return;
                await sleep(delayMs, deps.setTimeoutImpl);
            },
        });
    };
}
function bytesToArrayBuffer(bytes) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
}
async function fetchWithTimeout(deps, url, init, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutSeconds = Math.ceil(timeoutMs / 1000);
    const timeout = deps.setTimeoutImpl(() => controller.abort(new Error(`Request timed out after ${timeoutSeconds}s`)), timeoutMs);
    try {
        return await deps.fetchImpl(url, { ...init, signal: controller.signal });
    }
    catch (error) {
        if (error instanceof Error)
            throw error;
        const message = typeof error === "object" && error !== null && "message" in error
            ? String(error.message)
            : String(error);
        throw new Error(message, { cause: error });
    }
    finally {
        deps.clearTimeoutImpl(timeout);
    }
}
async function readResponseTextSafe(response) {
    return await response.text().catch(() => "");
}
function getRetryDelayMs(attemptError, random) {
    const failed = attemptError;
    const attemptNumber = Math.max(1, failed.attemptNumber ?? 1);
    const rootError = failed.cause ?? failed.error ?? attemptError;
    if (rootError instanceof HttpStatusError && rootError.rateLimit.retryAfterSeconds !== undefined) {
        return rootError.rateLimit.retryAfterSeconds * 1000 + jitterMs(RETRY_AFTER_JITTER_MS, random);
    }
    const baseMs = Math.min(RETRY_BACKOFF_MAX_MS, RETRY_BACKOFF_BASE_MS * 2 ** (attemptNumber - 1));
    return baseMs + jitterMs(RETRY_BACKOFF_BASE_MS, random);
}
function sleep(ms, setTimeoutImpl) {
    return new Promise((resolve) => {
        setTimeoutImpl(resolve, ms);
    });
}
function jitterMs(maxMs, random) {
    if (maxMs <= 0)
        return 0;
    return Math.floor(random() * maxMs);
}
function throwHttpStatusError(status, text, headers, now) {
    const rateLimit = parseRateLimitInfo(headers, now);
    const retryableTransientContention = isTransientConvexContention(text);
    const message = buildHttpErrorMessage(status, text, rateLimit);
    if (status === 429 || status >= 500 || retryableTransientContention) {
        throw new HttpStatusError(status, message, rateLimit);
    }
    throw new AbortError(message);
}
function buildHttpErrorMessage(status, text, rateLimit) {
    const base = normalizeHttpErrorBody(status, text);
    const details = [];
    if (rateLimit.retryAfterSeconds !== undefined) {
        details.push(`retry in ${rateLimit.retryAfterSeconds}s`);
    }
    if (rateLimit.remaining !== undefined && rateLimit.limit !== undefined) {
        details.push(`remaining: ${rateLimit.remaining}/${rateLimit.limit}`);
    }
    if (rateLimit.resetDelaySeconds !== undefined) {
        details.push(`reset in ${rateLimit.resetDelaySeconds}s`);
    }
    return details.length === 0 ? base : `${base} (${details.join(", ")})`;
}
function normalizeHttpErrorBody(status, text) {
    const body = cleanUserFacingErrorMessage(text);
    const formattedStructuredError = formatStructuredHttpError(body);
    if (formattedStructuredError)
        return formattedStructuredError;
    const lowered = body.toLowerCase();
    if (body && lowered !== "unauthorized" && lowered !== "forbidden") {
        if (isTransientConvexContention(body)) {
            return `Transient ClawHub write contention. The package artifact passed request validation; retrying usually succeeds. ${body}`;
        }
        if (status === 404 && lowered === "package not found") {
            return "Package not found or not visible to this account.";
        }
        if (status === 404 && lowered === "skill not found") {
            return "Skill not found or unavailable to this account.";
        }
        return body;
    }
    if (status === 401) {
        return "Authentication failed. Run `clawhub login` again. Deleted, banned, or disabled ClawHub accounts cannot use API tokens.";
    }
    if (status === 403) {
        return "Permission denied. This account does not have access to this operation, or the account is not in good standing.";
    }
    if (body)
        return body;
    return `HTTP ${status}`;
}
function formatStructuredHttpError(body) {
    if (!body.startsWith("{"))
        return null;
    let parsed;
    try {
        parsed = JSON.parse(body);
    }
    catch {
        return null;
    }
    if (!parsed || typeof parsed !== "object")
        return null;
    const error = parsed;
    if (error.code !== "AMBIGUOUS_SKILL_SLUG" || typeof error.message !== "string") {
        return null;
    }
    const lines = [error.message, ""];
    let index = 1;
    const matches = Array.isArray(error.matches) ? error.matches : [];
    for (const rawMatch of matches) {
        if (!rawMatch || typeof rawMatch !== "object")
            continue;
        const match = rawMatch;
        if (typeof match.ownerHandle !== "string" ||
            typeof match.slug !== "string" ||
            typeof match.ref !== "string" ||
            typeof match.url !== "string") {
            continue;
        }
        lines.push(`  ${index}.`, `     Skill: ${match.ownerHandle}/${match.slug}`, `     Page:  ${match.url}`, `     Run:   clawhub install ${match.ref}`, "");
        index += 1;
    }
    while (lines[lines.length - 1] === "")
        lines.pop();
    return lines.join("\n");
}
function cleanUserFacingErrorMessage(message) {
    let cleaned = message
        .replace(/\[CONVEX[^\]]*\]\s*/g, "")
        .replace(/\[Request ID:[^\]]*\]\s*/g, "")
        .replace(/^Server Error Called by client\s*/i, "")
        .trim();
    for (let i = 0; i < 3; i += 1) {
        const next = cleaned
            .replace(/^Error:\s*/i, "")
            .replace(/^(?:Uncaught\s+)?ConvexError:\s*/i, "")
            .trim();
        if (next === cleaned)
            break;
        cleaned = next;
    }
    return cleaned;
}
function isAcceptedStatus(status, acceptedStatuses) {
    return acceptedStatuses?.includes(status) ?? false;
}
function isTransientConvexContention(text) {
    const lowered = text.toLowerCase();
    return (lowered.includes("optimistic concurrency") ||
        lowered.includes("write conflict") ||
        (lowered.includes('documents read from or written to the "') &&
            lowered.includes("changed while this mutation was being run")));
}
function parseRateLimitInfo(headers, now) {
    if (!headers)
        return {};
    const limit = parseIntHeader(getHeader(headers, "x-ratelimit-limit") ?? getHeader(headers, "ratelimit-limit"));
    const remaining = parseIntHeader(getHeader(headers, "x-ratelimit-remaining") ?? getHeader(headers, "ratelimit-remaining"));
    const nowMs = now();
    const retryAfterSeconds = parseRetryAfterSeconds(getHeader(headers, "retry-after"), nowMs);
    const resetDelaySeconds = parseResetDelaySeconds(headers, nowMs, retryAfterSeconds);
    return { limit, remaining, resetDelaySeconds, retryAfterSeconds };
}
function parseResetDelaySeconds(headers, nowMs, retryAfterSeconds) {
    if (retryAfterSeconds !== undefined)
        return retryAfterSeconds;
    const standardized = parseIntHeader(getHeader(headers, "ratelimit-reset"));
    if (standardized !== undefined) {
        return Math.max(1, standardized);
    }
    const legacyEpochSeconds = parseIntHeader(getHeader(headers, "x-ratelimit-reset"));
    if (legacyEpochSeconds === undefined)
        return undefined;
    const nowSeconds = Math.floor(nowMs / 1000);
    return Math.max(1, legacyEpochSeconds - nowSeconds);
}
function parseRetryAfterSeconds(value, nowMs) {
    if (!value)
        return undefined;
    const trimmed = value.trim();
    if (!trimmed)
        return undefined;
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber) && asNumber >= 0) {
        if (asNumber > 31_536_000) {
            const nowSeconds = Math.floor(nowMs / 1000);
            return Math.max(1, Math.ceil(asNumber - nowSeconds));
        }
        return Math.max(1, Math.ceil(asNumber));
    }
    const asDateMs = Date.parse(trimmed);
    if (!Number.isFinite(asDateMs))
        return undefined;
    return Math.max(1, Math.ceil((asDateMs - nowMs) / 1000));
}
function parseIntHeader(value) {
    if (!value)
        return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function getHeader(headers, key) {
    if (!headers)
        return undefined;
    if (headers instanceof Headers) {
        const value = headers.get(key);
        return value === null ? undefined : value;
    }
    const normalizedKey = key.toLowerCase();
    const direct = headers[normalizedKey] ?? headers[key];
    if (typeof direct === "string" && direct.trim())
        return direct.trim();
    const match = Object.entries(headers).find(([entryKey, entryValue]) => entryKey.toLowerCase() === normalizedKey &&
        typeof entryValue === "string" &&
        entryValue.trim());
    return typeof match?.[1] === "string" ? match[1].trim() : undefined;
}
async function fetchJsonViaCurl(deps, url, args) {
    const headers = ["-H", "Accept: application/json"];
    if (args.token)
        headers.push("-H", `Authorization: Bearer ${args.token}`);
    const curlArgs = [
        "--silent",
        "--show-error",
        "--location",
        "--max-time",
        String(REQUEST_TIMEOUT_SECONDS),
        "--write-out",
        CURL_WRITE_OUT_FORMAT,
        "-X",
        args.method,
        ...headers,
        url,
    ];
    if (args.body !== undefined || args.method === "POST") {
        curlArgs.push("-H", "Content-Type: application/json");
        curlArgs.push("--data-binary", JSON.stringify(args.body ?? {}));
    }
    const result = deps.spawnSyncImpl("curl", curlArgs, { encoding: "utf8" });
    if (result.status !== 0) {
        throw new Error(result.stderr || "curl failed");
    }
    const { body, status, headers: responseHeaders } = parseCurlBodyAndMeta(result.stdout ?? "");
    if ((status < 200 || status >= 300) && !isAcceptedStatus(status, args.acceptedStatuses)) {
        throwHttpStatusError(status, body, responseHeaders, deps.now);
    }
    return JSON.parse(body || "null");
}
async function fetchJsonFormViaCurl(deps, url, args) {
    const headers = ["-H", "Accept: application/json"];
    if (args.token)
        headers.push("-H", `Authorization: Bearer ${args.token}`);
    const tempDir = await deps.mkdtempImpl(join(deps.tmpdirPath, "clawhub-upload-"));
    try {
        const formArgs = [];
        for (const [key, value] of args.form.entries()) {
            if (value instanceof Blob) {
                const filename = typeof value.name === "string" ? value.name : "file";
                const filePath = join(tempDir, filename);
                const bytes = new Uint8Array(await value.arrayBuffer());
                await deps.mkdirImpl(dirname(filePath), { recursive: true });
                await deps.writeFileImpl(filePath, bytes);
                formArgs.push("-F", `${key}=@${filePath};filename=${filename}`);
            }
            else {
                formArgs.push("-F", `${key}=${value}`);
            }
        }
        const curlArgs = [
            "--silent",
            "--show-error",
            "--location",
            "--max-time",
            String(UPLOAD_TIMEOUT_SECONDS),
            "--write-out",
            CURL_WRITE_OUT_FORMAT,
            "-X",
            args.method,
            ...headers,
            ...formArgs,
            url,
        ];
        const result = deps.spawnSyncImpl("curl", curlArgs, { encoding: "utf8" });
        if (result.status !== 0) {
            throw new Error(result.stderr || "curl failed");
        }
        const { body, status, headers: responseHeaders } = parseCurlBodyAndMeta(result.stdout ?? "");
        if (status < 200 || status >= 300) {
            throwHttpStatusError(status, body, responseHeaders, deps.now);
        }
        return JSON.parse(body || "null");
    }
    finally {
        await deps.rmImpl(tempDir, { recursive: true, force: true });
    }
}
async function uploadBinaryViaCurl(deps, args) {
    const tempDir = await deps.mkdtempImpl(join(deps.tmpdirPath, "clawhub-upload-"));
    try {
        const filePath = join(tempDir, "upload.bin");
        await deps.writeFileImpl(filePath, args.bytes);
        const curlArgs = [
            "--silent",
            "--show-error",
            "--location",
            "--max-time",
            String(UPLOAD_TIMEOUT_SECONDS),
            "--write-out",
            CURL_WRITE_OUT_FORMAT,
            "-X",
            "POST",
        ];
        if (args.contentType)
            curlArgs.push("-H", `Content-Type: ${args.contentType}`);
        curlArgs.push("--data-binary", `@${filePath}`, args.url);
        const result = deps.spawnSyncImpl("curl", curlArgs, { encoding: "utf8" });
        if (result.status !== 0) {
            throw new Error(result.stderr || "curl failed");
        }
        const { body, status, headers: responseHeaders } = parseCurlBodyAndMeta(result.stdout ?? "");
        if (status < 200 || status >= 300) {
            throwHttpStatusError(status, body, responseHeaders, deps.now);
        }
        return JSON.parse(body || "null");
    }
    finally {
        await deps.rmImpl(tempDir, { recursive: true, force: true });
    }
}
async function fetchTextViaCurl(deps, url, args) {
    const headers = ["-H", "Accept: text/plain"];
    if (args.token)
        headers.push("-H", `Authorization: Bearer ${args.token}`);
    const curlArgs = [
        "--silent",
        "--show-error",
        "--location",
        "--max-time",
        String(REQUEST_TIMEOUT_SECONDS),
        "--write-out",
        CURL_WRITE_OUT_FORMAT,
        "-X",
        "GET",
        ...headers,
        url,
    ];
    const result = deps.spawnSyncImpl("curl", curlArgs, { encoding: "utf8" });
    if (result.status !== 0) {
        throw new Error(result.stderr || "curl failed");
    }
    const { body, status, headers: responseHeaders } = parseCurlBodyAndMeta(result.stdout ?? "");
    if (status < 200 || status >= 300) {
        throwHttpStatusError(status, body, responseHeaders, deps.now);
    }
    return body;
}
async function fetchBinaryViaCurl(deps, url, token) {
    const tempDir = await deps.mkdtempImpl(join(deps.tmpdirPath, "clawhub-download-"));
    const filePath = join(tempDir, "payload.bin");
    try {
        const headers = [];
        if (token)
            headers.push("-H", `Authorization: Bearer ${token}`);
        const curlArgs = [
            "--silent",
            "--show-error",
            "--location",
            "--max-time",
            String(REQUEST_TIMEOUT_SECONDS),
            ...headers,
            "-o",
            filePath,
            "--write-out",
            CURL_WRITE_OUT_FORMAT,
            url,
        ];
        const result = deps.spawnSyncImpl("curl", curlArgs, { encoding: "utf8" });
        if (result.status !== 0) {
            throw new Error(result.stderr || "curl failed");
        }
        const { status, headers: responseHeaders } = parseCurlBodyAndMeta(result.stdout ?? "");
        if (status < 200 || status >= 300) {
            const body = await readFileSafe(deps.readFileImpl, filePath);
            throwHttpStatusError(status, body ? new TextDecoder().decode(body) : "", responseHeaders, deps.now);
        }
        const bytes = await readFileSafe(deps.readFileImpl, filePath);
        return bytes ? new Uint8Array(bytes) : new Uint8Array();
    }
    finally {
        await deps.rmImpl(tempDir, { recursive: true, force: true });
    }
}
function parseCurlBodyAndMeta(output) {
    const marker = `\n${CURL_META_MARKER}\n`;
    const markerIndex = output.lastIndexOf(marker);
    if (markerIndex === -1) {
        const splitAt = output.lastIndexOf("\n");
        if (splitAt === -1) {
            const statusOnly = Number(output.trim());
            if (!Number.isFinite(statusOnly))
                throw new Error("curl response missing status");
            return { body: "", status: statusOnly, headers: {} };
        }
        const body = output.slice(0, splitAt);
        const status = Number(output.slice(splitAt + 1).trim());
        if (!Number.isFinite(status))
            throw new Error("curl response missing status");
        return { body, status, headers: {} };
    }
    const body = output.slice(0, markerIndex);
    const meta = output.slice(markerIndex + marker.length).replace(/\r/g, "");
    const lines = meta.split("\n");
    const status = Number((lines[0] ?? "").trim());
    if (!Number.isFinite(status))
        throw new Error("curl response missing status");
    const [xRateLimitLimit, xRateLimitRemaining, xRateLimitReset, rateLimitLimit, rateLimitRemaining, rateLimitReset, retryAfter,] = lines.slice(1);
    const headers = {};
    setHeaderIfPresent(headers, "x-ratelimit-limit", xRateLimitLimit);
    setHeaderIfPresent(headers, "x-ratelimit-remaining", xRateLimitRemaining);
    setHeaderIfPresent(headers, "x-ratelimit-reset", xRateLimitReset);
    setHeaderIfPresent(headers, "ratelimit-limit", rateLimitLimit);
    setHeaderIfPresent(headers, "ratelimit-remaining", rateLimitRemaining);
    setHeaderIfPresent(headers, "ratelimit-reset", rateLimitReset);
    setHeaderIfPresent(headers, "retry-after", retryAfter);
    return { body, status, headers };
}
function setHeaderIfPresent(headers, key, value) {
    if (typeof value !== "string")
        return;
    const trimmed = value.trim();
    if (!trimmed)
        return;
    headers[key] = trimmed;
}
async function readFileSafe(readFileImpl, path) {
    try {
        return await readFileImpl(path);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=http.js.map