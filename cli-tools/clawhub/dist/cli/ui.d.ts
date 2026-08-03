export declare function promptHidden(prompt: string): Promise<string>;
export declare function promptConfirm(prompt: string): Promise<boolean>;
export declare function openInBrowser(url: string): void;
export declare function isInteractive(): boolean;
type CrabLoader = {
    text: string;
    readonly isSpinning: boolean;
    start(text?: string): CrabLoader;
    stop(): CrabLoader;
    succeed(text?: string): CrabLoader;
    fail(text?: string): CrabLoader;
};
export declare function createCrabLoader(text: string): CrabLoader;
export declare function formatError(error: unknown): string;
declare const textStyles: {
    brand: string;
    strong: string;
    muted: string;
};
export declare function styleText(value: string, style: keyof typeof textStyles): string;
export declare function fail(message: string): never;
export {};
