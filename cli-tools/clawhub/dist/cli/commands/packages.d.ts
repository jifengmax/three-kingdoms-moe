import { type PackageFamily } from "../../schema/index.js";
import type { GlobalOpts } from "../types.js";
type PackageInspectOptions = {
    version?: string;
    tag?: string;
    versions?: boolean;
    limit?: number;
    files?: boolean;
    file?: string;
    json?: boolean;
};
type PackageExploreOptions = {
    family?: PackageFamily;
    official?: boolean;
    limit?: number;
    json?: boolean;
};
type PackagePublishOptions = {
    family?: "code-plugin" | "bundle-plugin";
    name?: string;
    displayName?: string;
    owner?: string;
    version?: string;
    changelog?: string;
    manualOverrideReason?: string;
    tags?: string;
    categories?: string;
    topics?: string;
    bundleFormat?: string;
    hostTargets?: string;
    sourceRepo?: string;
    sourceCommit?: string;
    sourceRef?: string;
    sourcePath?: string;
    dryRun?: boolean;
    json?: boolean;
};
type PackagePackOptions = {
    packDestination?: string;
    json?: boolean;
};
type PackageValidateOptions = {
    out?: string;
    openclaw?: string;
    runtime?: boolean;
    allowExecute?: boolean;
    mockSdk?: boolean;
    json?: boolean;
};
type PackageDownloadOptions = {
    version?: string;
    tag?: string;
    output?: string;
    force?: boolean;
    json?: boolean;
};
type PackageVerifyOptions = {
    packageName?: string;
    version?: string;
    tag?: string;
    sha256?: string;
    npmIntegrity?: string;
    npmShasum?: string;
    json?: boolean;
};
type PackageReportOptions = {
    version?: string;
    reason?: string;
    json?: boolean;
};
type PackageModerationStatusOptions = {
    json?: boolean;
};
type PackageReadinessOptions = {
    json?: boolean;
};
type PackageMigrationStatusOptions = PackageReadinessOptions;
type PackageTrustedPublisherGetOptions = {
    json?: boolean;
};
type PackageTrustedPublisherSetOptions = {
    repository?: string;
    workflowFilename?: string;
    environment?: string;
    json?: boolean;
};
type PackageTrustedPublisherDeleteOptions = {
    json?: boolean;
};
type PackageDeleteOptions = {
    yes?: boolean;
    json?: boolean;
    version?: string;
};
type PackageUndeleteOptions = Omit<PackageDeleteOptions, "version">;
type PackageTransferOptions = {
    to: string;
    reason?: string;
    json?: boolean;
};
export declare function cmdExplorePackages(opts: GlobalOpts, query: string, options?: PackageExploreOptions): Promise<void>;
export declare function cmdInspectPackage(opts: GlobalOpts, packageName: string, options?: PackageInspectOptions): Promise<void>;
export declare function cmdGetPackageTrustedPublisher(opts: GlobalOpts, packageName: string, options?: PackageTrustedPublisherGetOptions): Promise<void>;
export declare function cmdSetPackageTrustedPublisher(opts: GlobalOpts, packageName: string, options: PackageTrustedPublisherSetOptions): Promise<void>;
export declare function cmdDeletePackageTrustedPublisher(opts: GlobalOpts, packageName: string, options?: PackageTrustedPublisherDeleteOptions): Promise<void>;
export declare function cmdPackPackage(opts: GlobalOpts, sourceArg: string, options?: PackagePackOptions): Promise<void>;
export declare function cmdValidatePackage(opts: GlobalOpts, sourceArg: string, options?: PackageValidateOptions): Promise<void>;
export declare function cmdPublishPackage(opts: GlobalOpts, sourceArg: string, options?: PackagePublishOptions): Promise<void>;
export declare function cmdDownloadPackage(opts: GlobalOpts, packageName: string, options?: PackageDownloadOptions): Promise<void>;
export declare function cmdVerifyPackage(opts: GlobalOpts, filePath: string, options?: PackageVerifyOptions): Promise<void>;
export declare function cmdDeletePackage(opts: GlobalOpts, nameArg: string, options?: PackageDeleteOptions, inputAllowed?: boolean): Promise<{
    ok: true;
    slugReservedUntil?: number | undefined;
} | undefined>;
export declare function cmdUndeletePackage(opts: GlobalOpts, nameArg: string, options?: PackageUndeleteOptions, inputAllowed?: boolean): Promise<{
    ok: true;
    slugReservedUntil?: number | undefined;
} | undefined>;
export declare function cmdTransferPackage(opts: GlobalOpts, nameArg: string, options: PackageTransferOptions): Promise<{
    ok: true;
    packageId: string;
    name: string;
    ownerUserId: string;
    channel: "official" | "community" | "private";
    isOfficial: boolean;
    ownerPublisherId?: string | undefined;
}>;
export declare function cmdReportPackage(opts: GlobalOpts, packageName: string, options?: PackageReportOptions): Promise<void>;
export declare function cmdPackageModerationStatus(opts: GlobalOpts, packageName: string, options?: PackageModerationStatusOptions): Promise<void>;
export declare function cmdPackageReadiness(opts: GlobalOpts, packageName: string, options?: PackageReadinessOptions): Promise<void>;
export declare function cmdPackageMigrationStatus(opts: GlobalOpts, packageName: string, options?: PackageMigrationStatusOptions): Promise<void>;
export {};
