type ClawPackEntry = {
    path: string;
    bytes: Uint8Array;
};
type ParsedClawPack = {
    packageName: string;
    packageVersion: string;
    entries: ClawPackEntry[];
    packageJson: Record<string, unknown>;
    pluginManifest: Record<string, unknown>;
};
export declare function parseClawPack(bytes: Uint8Array): ParsedClawPack;
export {};
