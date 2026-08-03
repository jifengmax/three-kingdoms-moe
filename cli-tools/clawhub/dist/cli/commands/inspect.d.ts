import type { GlobalOpts } from "../types.js";
type InspectOptions = {
    version?: string;
    tag?: string;
    versions?: boolean;
    limit?: number;
    files?: boolean;
    file?: string;
    json?: boolean;
};
type VerifySkillOptions = {
    version?: string;
    tag?: string;
    card?: boolean;
};
export declare function cmdInspect(opts: GlobalOpts, slug: string, options?: InspectOptions): Promise<void>;
export declare function cmdVerifySkill(opts: GlobalOpts, slug: string, options?: VerifySkillOptions): Promise<void>;
export {};
