import type { GlobalOpts } from "../types.js";
type ScanOptions = {
    slug?: string;
    version?: string;
    update?: boolean;
    output?: string;
    json?: boolean;
};
type ScanDownloadOptions = {
    kind?: "skill" | "plugin";
    version?: string;
    output?: string;
};
export declare function cmdScan(opts: GlobalOpts, pathArg: string | undefined, options: ScanOptions): Promise<void>;
export declare function cmdScanDownload(opts: GlobalOpts, nameArg: string, options: ScanDownloadOptions): Promise<void>;
export {};
