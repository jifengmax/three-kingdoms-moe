import type { GlobalOpts } from "../types.js";
type ConfirmOptions = {
    yes?: boolean;
};
export declare function cmdRenameSkill(opts: GlobalOpts, slugArg: string, newSlugArg: string, options: ConfirmOptions, inputAllowed: boolean): Promise<{
    ok: true;
    slug: string;
    previousSlug: string;
} | undefined>;
export declare function cmdMergeSkill(opts: GlobalOpts, sourceSlugArg: string, targetSlugArg: string, options: ConfirmOptions, inputAllowed: boolean): Promise<{
    ok: true;
    sourceSlug: string;
    targetSlug: string;
} | undefined>;
export {};
