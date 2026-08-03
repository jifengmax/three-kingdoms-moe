import type { GlobalOpts } from "../types.js";
type SkillActionLabels = {
    verb: string;
    progress: string;
    past: string;
    promptSuffix?: string;
};
type SkillActionOptions = {
    yes?: boolean;
    reason?: string;
    note?: string;
};
type SkillDeleteOptions = SkillActionOptions & {
    version?: string;
};
export declare function cmdDeleteSkill(opts: GlobalOpts, slugArg: string, options: SkillDeleteOptions, inputAllowed: boolean, labels?: SkillActionLabels): Promise<{
    ok: true;
    slugReservedUntil?: number | undefined;
} | undefined>;
export declare function cmdUndeleteSkill(opts: GlobalOpts, slugArg: string, options: SkillActionOptions, inputAllowed: boolean, labels?: SkillActionLabels): Promise<{
    ok: true;
    slugReservedUntil?: number | undefined;
} | undefined>;
export declare function cmdHideSkill(opts: GlobalOpts, slugArg: string, options: SkillActionOptions, inputAllowed: boolean): Promise<{
    ok: true;
    slugReservedUntil?: number | undefined;
} | undefined>;
export declare function cmdUnhideSkill(opts: GlobalOpts, slugArg: string, options: SkillActionOptions, inputAllowed: boolean): Promise<{
    ok: true;
    slugReservedUntil?: number | undefined;
} | undefined>;
export {};
