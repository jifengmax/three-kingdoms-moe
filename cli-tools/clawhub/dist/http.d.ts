import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { ArkValidator } from "./schema/index.js";
export type HttpRuntime = "node" | "bun";
type RequestArgs = {
    method: "GET" | "POST" | "DELETE";
    path: string;
    token?: string;
    body?: unknown;
    retryCount?: number;
    acceptedStatuses?: number[];
} | {
    method: "GET" | "POST" | "DELETE";
    url: string;
    token?: string;
    body?: unknown;
    retryCount?: number;
    acceptedStatuses?: number[];
};
type FormRequestArgs = {
    method: "POST";
    path: string;
    token?: string;
    form: FormData;
    retryCount?: number;
} | {
    method: "POST";
    url: string;
    token?: string;
    form: FormData;
    retryCount?: number;
};
type TextRequestArgs = {
    path: string;
    token?: string;
} | {
    url: string;
    token?: string;
};
type BinaryUploadArgs = {
    url: string;
    bytes: Uint8Array;
    contentType?: string;
    retryCount?: number;
};
type DownloadZipArgs = {
    slug: string;
    ownerHandle?: string;
    version?: string;
    token?: string;
};
type HttpClientDeps = {
    runtime: HttpRuntime;
    fetchImpl: typeof fetch;
    setTimeoutImpl: typeof setTimeout;
    clearTimeoutImpl: typeof clearTimeout;
    spawnSyncImpl: typeof spawnSync;
    mkdirImpl: typeof mkdir;
    mkdtempImpl: typeof mkdtemp;
    readFileImpl: typeof readFile;
    rmImpl: typeof rm;
    writeFileImpl: typeof writeFile;
    tmpdirPath: string;
    now: () => number;
    random: () => number;
    env: NodeJS.ProcessEnv;
    configureDispatcher: boolean;
};
export type HttpClientOptions = Partial<Omit<HttpClientDeps, "runtime">> & {
    runtime?: HttpRuntime;
};
type HttpClient = {
    apiRequest<T>(registry: string, args: RequestArgs): Promise<T>;
    apiRequest<T>(registry: string, args: RequestArgs, schema: ArkValidator<T>): Promise<T>;
    apiRequestForm<T>(registry: string, args: FormRequestArgs): Promise<T>;
    apiRequestForm<T>(registry: string, args: FormRequestArgs, schema: ArkValidator<T>): Promise<T>;
    fetchText(registry: string, args: TextRequestArgs): Promise<string>;
    fetchBinary(registry: string, args: TextRequestArgs): Promise<Uint8Array>;
    uploadBinary<T>(args: BinaryUploadArgs, schema?: ArkValidator<T>): Promise<T>;
    downloadZip(registry: string, args: DownloadZipArgs): Promise<Uint8Array>;
};
export declare function detectHttpRuntime(processVersions?: NodeJS.ProcessVersions | undefined): HttpRuntime;
export declare function shouldUseProxyFromEnv(env?: NodeJS.ProcessEnv): boolean;
export declare function registryUrl(path: string, registry: string): URL;
export declare function createHttpClient(options?: HttpClientOptions): HttpClient;
export declare function apiRequest<T>(registry: string, args: RequestArgs): Promise<T>;
export declare function apiRequest<T>(registry: string, args: RequestArgs, schema: ArkValidator<T>): Promise<T>;
export declare function apiRequestForm<T>(registry: string, args: FormRequestArgs): Promise<T>;
export declare function apiRequestForm<T>(registry: string, args: FormRequestArgs, schema: ArkValidator<T>): Promise<T>;
export declare function fetchText(registry: string, args: TextRequestArgs): Promise<string>;
export declare function fetchBinary(registry: string, args: TextRequestArgs): Promise<Uint8Array>;
export declare function uploadBinary<T>(args: BinaryUploadArgs): Promise<T>;
export declare function uploadBinary<T>(args: BinaryUploadArgs, schema: ArkValidator<T>): Promise<T>;
export declare function downloadZip(registry: string, args: DownloadZipArgs): Promise<Uint8Array<ArrayBufferLike>>;
export {};
