type ModerationPlanOptions = {
    json?: boolean;
    yes?: boolean;
};
type ModerationPlan = {
    subject: string;
    outcome: string;
    impacts: string[];
    requiresConfirmation: boolean;
    confirmPrompt: string;
};
export declare function reportModerationPlan(params: {
    entityLabel: "skill" | "package";
    reportId: string;
    status: "open" | "confirmed" | "dismissed";
    finalAction?: "none" | "hide" | "quarantine" | "revoke";
}): ModerationPlan;
export declare function presentModerationPlan(plan: ModerationPlan, options: ModerationPlanOptions): Promise<void>;
export {};
