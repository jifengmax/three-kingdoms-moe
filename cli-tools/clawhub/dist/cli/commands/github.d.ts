type ResolvedPublishSource = {
    kind: "local";
    path: string;
} | {
    kind: "github";
    owner: string;
    repo: string;
    ref?: string;
    path: string;
    url: string;
};
type LocalGitInfo = {
    root: string;
    path: string;
    repo?: string;
    commit?: string;
    ref?: string;
};
export declare function resolveSourceInput(input: string, options: {
    workdir: string;
    localWorkdirs?: string[];
}): Promise<ResolvedPublishSource>;
export declare function fetchGitHubSource(source: Extract<ResolvedPublishSource, {
    kind: "github";
}>): Promise<{
    dir: string;
    source: {
        kind: "github";
        url: string;
        repo: string;
        ref: string;
        commit: string;
        path: string;
        importedAt: number;
    };
    cleanup: () => Promise<void>;
}>;
export declare function resolveLocalGitInfo(folder: string): LocalGitInfo | null;
export declare function normalizeGitHubRepo(value: string): string | undefined;
export {};
