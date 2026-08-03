import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import JSON5 from "json5";
import { resolveHome } from "../homedir.js";
export async function resolveClawdbotDefaultWorkspace() {
    const config = await readClawdbotConfig();
    const openclawConfig = await readOpenclawConfig();
    if (!config && !openclawConfig)
        return null;
    const defaultsWorkspace = resolveUserPath(config?.agents?.defaults?.workspace ?? config?.agent?.workspace ?? "");
    if (defaultsWorkspace)
        return defaultsWorkspace;
    const listedAgents = getAgentList(config);
    const defaultAgent = listedAgents.find((entry) => entry.default) ??
        listedAgents.find((entry) => entry.id === "main");
    const listWorkspace = resolveUserPath(defaultAgent?.workspace ?? "");
    if (listWorkspace)
        return listWorkspace;
    if (!openclawConfig)
        return null;
    const openclawDefaults = resolveUserPath(openclawConfig.agents?.defaults?.workspace ?? openclawConfig.agent?.workspace ?? "");
    if (openclawDefaults)
        return openclawDefaults;
    const openclawAgents = getAgentList(openclawConfig);
    const openclawDefaultAgent = openclawAgents.find((entry) => entry.default) ??
        openclawAgents.find((entry) => entry.id === "main");
    const openclawWorkspace = resolveUserPath(openclawDefaultAgent?.workspace ?? "");
    return openclawWorkspace || null;
}
function resolveClawdbotStateDir() {
    const override = process.env.CLAWDBOT_STATE_DIR?.trim();
    if (override)
        return resolveUserPath(override);
    return join(resolveHome(), ".clawdbot");
}
function resolveClawdbotConfigPath() {
    const override = process.env.CLAWDBOT_CONFIG_PATH?.trim();
    if (override)
        return resolveUserPath(override);
    return join(resolveClawdbotStateDir(), "clawdbot.json");
}
function resolveOpenclawStateDir() {
    const override = process.env.OPENCLAW_STATE_DIR?.trim();
    if (override)
        return resolveUserPath(override);
    return join(resolveHome(), ".openclaw");
}
function resolveOpenclawConfigPath() {
    const override = process.env.OPENCLAW_CONFIG_PATH?.trim();
    if (override)
        return resolveUserPath(override);
    return join(resolveOpenclawStateDir(), "openclaw.json");
}
function resolveUserPath(input) {
    if (typeof input !== "string")
        return "";
    const trimmed = input.trim();
    if (!trimmed)
        return "";
    if (trimmed.startsWith("~")) {
        return resolve(trimmed.replace(/^~(?=$|[\\/])/, resolveHome()));
    }
    return resolve(trimmed);
}
function getAgentList(config) {
    const list = config?.agents?.list;
    return Array.isArray(list) ? list.filter(isRecord) : [];
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function readClawdbotConfig() {
    return readConfigFile(resolveClawdbotConfigPath());
}
async function readOpenclawConfig() {
    return readConfigFile(resolveOpenclawConfigPath());
}
async function readConfigFile(path) {
    try {
        const raw = await readFile(path, "utf8");
        const parsed = JSON5.parse(raw);
        if (!parsed || typeof parsed !== "object")
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=clawdbotConfig.js.map