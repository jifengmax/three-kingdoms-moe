import type { GlobalOpts } from "../types.js";
type PublisherCreateOptions = {
    displayName?: string;
    json?: boolean;
};
export declare function cmdCreatePublisher(opts: GlobalOpts, handle: string, options?: PublisherCreateOptions): Promise<void>;
export {};
