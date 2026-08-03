export declare function reportInstalledSkillsTelemetryIfEnabled(params: {
    token: string | undefined;
    registry: string;
    slug: string;
    version?: string | null;
}): Promise<void>;
