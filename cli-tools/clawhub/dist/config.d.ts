import { type GlobalConfig } from "./schema/index.js";
export declare function readGlobalConfig(): Promise<GlobalConfig | null>;
export declare function writeGlobalConfig(config: GlobalConfig): Promise<void>;
