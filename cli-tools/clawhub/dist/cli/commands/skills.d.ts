import { type SkillReportFinalAction, type SkillReportListStatus, type SkillReportStatus } from "../../schema/index.js";
import type { GlobalOpts } from "../types.js";
type SkillReportOptions = {
    version?: string;
    reason?: string;
    json?: boolean;
};
type SkillReportListOptions = {
    status?: SkillReportListStatus;
    cursor?: string;
    limit?: number;
    json?: boolean;
};
type SkillReportTriageOptions = {
    status?: SkillReportStatus;
    action?: SkillReportFinalAction;
    finalAction?: SkillReportFinalAction;
    note?: string;
    json?: boolean;
    yes?: boolean;
};
export declare function cmdSearch(opts: GlobalOpts, query: string, limit?: number): Promise<void>;
export declare function cmdInstall(opts: GlobalOpts, slug: string, versionFlag?: string, force?: boolean, forceInstall?: boolean): Promise<void>;
export declare function cmdUpdate(opts: GlobalOpts, slugArg: string | undefined, options: {
    all?: boolean;
    version?: string;
    force?: boolean;
    forceInstall?: boolean;
}, inputAllowed: boolean): Promise<void>;
export declare function cmdList(opts: GlobalOpts): Promise<void>;
export declare function cmdPin(opts: GlobalOpts, slug: string, options?: {
    reason?: string;
}): Promise<void>;
export declare function cmdUnpin(opts: GlobalOpts, slug: string): Promise<void>;
export declare function cmdUninstall(opts: GlobalOpts, slug: string, options: {
    yes?: boolean;
} | undefined, inputAllowed: boolean): Promise<void>;
export declare function cmdExplore(opts: GlobalOpts, options?: {
    limit?: number;
    sort?: string;
    json?: boolean;
}): Promise<void>;
export declare function formatExploreLine(item: {
    slug: string;
    summary?: string | null;
    updatedAt: number;
    latestVersion?: {
        version: string;
    } | null;
}): string;
export declare function clampLimit(limit: number, fallback?: number): number;
export declare function cmdReportSkill(opts: GlobalOpts, slug: string, options?: SkillReportOptions): Promise<void>;
export declare function cmdListSkillReports(opts: GlobalOpts, options?: SkillReportListOptions): Promise<void>;
export declare function cmdTriageSkillReport(opts: GlobalOpts, reportId: string, options?: SkillReportTriageOptions): Promise<void>;
export {};
