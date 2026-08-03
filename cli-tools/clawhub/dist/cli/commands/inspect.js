import { apiRequest, fetchText, registryUrl } from "../../http.js";
import { ApiRoutes, PLATFORM_SKILL_LICENSE, PLATFORM_SKILL_LICENSE_SUMMARY, ApiV1SkillModerationResponseSchema, ApiV1SkillResponseSchema, ApiV1SkillVerifyResponseSchema, ApiV1SkillVersionListResponseSchema, ApiV1SkillVersionResponseSchema, } from "../../schema/index.js";
import { getOptionalAuthToken } from "../authToken.js";
import { getRegistry } from "../registry.js";
import { createCrabLoader, fail, formatError, styleText } from "../ui.js";
export async function cmdInspect(opts, slug, options = {}) {
    const requested = parseSkillRef(slug);
    const trimmed = requested.slug;
    if (!trimmed)
        fail("Skill required");
    if (options.version && options.tag)
        fail("Use either --version or --tag");
    const token = await getOptionalAuthToken();
    const registry = await getRegistry(opts, { cache: true });
    const spinner = createCrabLoader("Fetching skill");
    try {
        let skillResult = null;
        let moderationDiagnostics = null;
        try {
            skillResult = await fetchSkillDetail(registry, trimmed, requested.ownerHandle, token);
        }
        catch (error) {
            moderationDiagnostics = await fetchModerationDiagnostics(registry, trimmed, requested.ownerHandle, token);
            if (moderationDiagnostics?.moderation) {
                spinner.stop();
                const output = {
                    skill: null,
                    latestVersion: null,
                    owner: null,
                    moderation: moderationDiagnostics.moderation,
                    version: null,
                    versions: null,
                    file: null,
                };
                if (options.json) {
                    console.log(JSON.stringify(output, null, 2));
                    return;
                }
                printHiddenSkillModeration(trimmed, moderationDiagnostics.moderation, formatError(error));
                return;
            }
            throw error;
        }
        if (!skillResult.skill) {
            spinner.fail("Skill not found");
            return;
        }
        moderationDiagnostics = await fetchModerationDiagnostics(registry, trimmed, requested.ownerHandle, token);
        const skill = skillResult.skill;
        const tags = normalizeTags(skill.tags);
        const latestVersion = skillResult.latestVersion?.version ?? tags.latest ?? null;
        const taggedVersion = options.tag ? (tags[options.tag] ?? null) : null;
        if (options.tag && !taggedVersion) {
            spinner.fail(`Unknown tag "${options.tag}"`);
            return;
        }
        const requestedVersion = options.version ?? taggedVersion ?? null;
        let versionResult = null;
        if (options.files || options.file || options.version || options.tag) {
            const targetVersion = requestedVersion ?? latestVersion;
            if (!targetVersion)
                fail("Could not resolve latest version");
            spinner.text = `Fetching ${trimmed}@${targetVersion}`;
            versionResult = await apiRequest(registry, {
                method: "GET",
                url: ownerScopedUrl(registry, `${ApiRoutes.skills}/${encodeURIComponent(trimmed)}/versions/${encodeURIComponent(targetVersion)}`, requested.ownerHandle),
                token,
            }, ApiV1SkillVersionResponseSchema);
        }
        let versionsList = null;
        if (options.versions) {
            const limit = clampLimit(options.limit ?? 25, 25);
            const url = registryUrl(`${ApiRoutes.skills}/${encodeURIComponent(trimmed)}/versions`, registry);
            if (requested.ownerHandle)
                url.searchParams.set("ownerHandle", requested.ownerHandle);
            url.searchParams.set("limit", String(limit));
            spinner.text = `Fetching versions (${limit})`;
            versionsList = await apiRequest(registry, { method: "GET", url: url.toString(), token }, ApiV1SkillVersionListResponseSchema);
        }
        let fileContent = null;
        if (options.file) {
            const url = registryUrl(`${ApiRoutes.skills}/${encodeURIComponent(trimmed)}/file`, registry);
            if (requested.ownerHandle)
                url.searchParams.set("ownerHandle", requested.ownerHandle);
            url.searchParams.set("path", options.file);
            if (options.version) {
                url.searchParams.set("version", options.version);
            }
            else if (options.tag) {
                url.searchParams.set("tag", options.tag);
            }
            else if (latestVersion) {
                url.searchParams.set("version", latestVersion);
            }
            spinner.text = `Fetching ${options.file}`;
            fileContent = await fetchText(registry, { url: url.toString(), token });
        }
        spinner.stop();
        const output = {
            skill: skillResult.skill,
            latestVersion: skillResult.latestVersion,
            owner: skillResult.owner,
            moderation: moderationDiagnostics?.moderation ?? skillResult.moderation ?? null,
            version: versionResult?.version ?? null,
            versions: versionsList?.items ?? null,
            file: options.file ? { path: options.file, content: fileContent } : null,
        };
        if (options.json) {
            console.log(JSON.stringify(output, null, 2));
            return;
        }
        const shouldPrintMeta = !options.file || options.files || options.versions || options.version;
        if (shouldPrintMeta) {
            printSkillSummary({
                skill,
                latestVersion: skillResult.latestVersion,
                versionLicense: versionResult?.version?.license ?? null,
                owner: skillResult.owner,
            });
            printModerationSummary(moderationDiagnostics?.moderation ?? skillResult.moderation ?? null);
        }
        if (shouldPrintMeta && versionResult?.version) {
            printVersionSummary(versionResult.version);
            printSecuritySummary(versionResult.version);
        }
        if (shouldPrintMeta)
            printInspectFooter();
        if (versionsList?.items && Array.isArray(versionsList.items)) {
            if (versionsList.items.length === 0) {
                console.log("No versions found.");
            }
            else {
                console.log("Versions:");
                for (const item of versionsList.items) {
                    console.log(formatVersionLine(item));
                }
            }
        }
        if (versionResult?.version) {
            const files = normalizeFiles(versionResult.version.files);
            if (options.files) {
                if (files.length === 0) {
                    console.log("No files found.");
                }
                else {
                    console.log("Files:");
                    for (const file of files) {
                        console.log(formatFileLine(file));
                    }
                }
            }
        }
        if (options.file && fileContent !== null) {
            if (shouldPrintMeta)
                console.log(`\n${options.file}:\n`);
            process.stdout.write(fileContent);
            if (!fileContent.endsWith("\n"))
                process.stdout.write("\n");
        }
    }
    catch (error) {
        spinner.fail(formatError(error));
        throw error;
    }
}
export async function cmdVerifySkill(opts, slug, options = {}) {
    const requested = parseSkillRef(slug);
    const trimmed = requested.slug;
    if (!trimmed)
        fail("Skill required");
    if (options.version && options.tag)
        fail("Use either --version or --tag");
    const token = await getOptionalAuthToken();
    const registry = await getRegistry(opts, { cache: true });
    const spinner = createCrabLoader("Fetching skill verification");
    try {
        const url = registryUrl(`${ApiRoutes.skills}/${encodeURIComponent(trimmed)}/verify`, registry);
        if (requested.ownerHandle)
            url.searchParams.set("ownerHandle", requested.ownerHandle);
        if (options.version) {
            url.searchParams.set("version", options.version);
        }
        else if (options.tag) {
            url.searchParams.set("tag", options.tag);
        }
        const result = await apiRequest(registry, { method: "GET", url: url.toString(), token }, ApiV1SkillVerifyResponseSchema);
        if (options.card) {
            const cardUrl = readSkillCardUrl(result);
            if (!cardUrl)
                fail("Skill Card is not available");
            spinner.text = "Fetching Skill Card";
            const card = await fetchText(registry, { url: cardUrl, token });
            spinner.stop();
            process.stdout.write(card);
            if (!card.endsWith("\n"))
                process.stdout.write("\n");
            if (!readBoolean(result, "ok"))
                process.exitCode = 1;
            return;
        }
        spinner.stop();
        console.log(JSON.stringify(result, null, 2));
        if (!readBoolean(result, "ok"))
            process.exitCode = 1;
    }
    catch (error) {
        spinner.fail(formatError(error));
        throw error;
    }
}
function parseSkillRef(raw) {
    const value = raw.trim();
    if (!value)
        fail("Skill required");
    const slashIndex = value.indexOf("/");
    if (slashIndex < 0)
        return { slug: value };
    if (value.indexOf("/", slashIndex + 1) >= 0)
        fail(`Invalid skill: ${value}`);
    const ownerHandle = value.slice(0, slashIndex).trim().replace(/^@+/, "");
    const slug = value.slice(slashIndex + 1).trim();
    if (!ownerHandle || !slug)
        fail(`Invalid skill: ${value}`);
    return { slug, ownerHandle };
}
function ownerScopedUrl(registry, path, ownerHandle) {
    const url = registryUrl(path, registry);
    if (ownerHandle)
        url.searchParams.set("ownerHandle", ownerHandle);
    return url.toString();
}
function fetchSkillDetail(registry, slug, ownerHandle, token) {
    return apiRequest(registry, {
        method: "GET",
        url: ownerScopedUrl(registry, `${ApiRoutes.skills}/${encodeURIComponent(slug)}`, ownerHandle),
        token,
    }, ApiV1SkillResponseSchema);
}
async function fetchModerationDiagnostics(registry, slug, ownerHandle, token) {
    if (!token)
        return null;
    try {
        return await apiRequest(registry, {
            method: "GET",
            url: ownerScopedUrl(registry, `${ApiRoutes.skills}/${encodeURIComponent(slug)}/moderation`, ownerHandle),
            token,
        }, ApiV1SkillModerationResponseSchema);
    }
    catch {
        return null;
    }
}
function printHiddenSkillModeration(slug, moderation, detailError) {
    console.log(`${slug} is not publicly visible.`);
    console.log(`Detail: ${detailError}`);
    printModerationSummary(moderation);
}
function printSkillSummary(result) {
    const { skill } = result;
    console.log("");
    console.log(`${inspectRail("┌─")} ${styleText("inspect", "brand")} ${styleText("─".repeat(43), "muted")}`);
    console.log(`${inspectRail("│")} ${styleText(skill.slug, "brand")}  ${styleText(skill.displayName, "strong")}`);
    const owner = formatOwner(result.owner);
    const tags = normalizeTags(skill.tags);
    const tagEntries = Object.entries(tags);
    const compactMeta = [
        owner,
        result.latestVersion?.version ? `v${result.latestVersion.version}` : null,
        tagEntries.map(([tag, version]) => `${tag}=${version}`).join(", "),
    ]
        .filter(Boolean)
        .join(" · ");
    if (compactMeta)
        console.log(`${inspectRail("│")} ${styleText(compactMeta, "muted")}`);
    console.log(inspectRail("│"));
    if (skill.summary)
        printInspectRow("Summary", skill.summary);
    if (owner)
        printInspectRow("Owner", owner);
    if (result.latestVersion?.version) {
        printInspectRow("Latest", result.latestVersion.version);
    }
    printInspectRow("License", `${result.versionLicense ?? result.latestVersion?.license ?? PLATFORM_SKILL_LICENSE} (${PLATFORM_SKILL_LICENSE_SUMMARY})`);
    printInspectRow("Updated", formatTimestamp(skill.updatedAt));
    printInspectRow("Created", formatTimestamp(skill.createdAt));
    if (tagEntries.length > 0) {
        printInspectRow("Tags", tagEntries.map(([tag, version]) => `${tag}=${version}`).join(", "));
    }
}
function printInspectRow(label, value) {
    console.log(`${inspectRail("│")} ${styleText(label.padEnd(8), "brand")} ${value}`);
}
function printInspectFooter() {
    console.log(`${inspectRail("└")}${styleText("─".repeat(54), "muted")}`);
}
function inspectRail(value) {
    return styleText(value, "brand");
}
function formatOwner(owner) {
    if (owner?.handle)
        return `@${owner.handle}`;
    return owner?.displayName ?? null;
}
function printVersionSummary(version) {
    if (!version || typeof version !== "object")
        return;
    const entry = version;
    const value = typeof entry.version === "string" ? entry.version : null;
    if (!value)
        return;
    printInspectRow("Selected", value);
    if (typeof entry.createdAt === "number") {
        printInspectRow("Sel Time", formatTimestamp(entry.createdAt));
    }
    if (typeof entry.changelog === "string" && entry.changelog.trim()) {
        printInspectRow("Change", truncate(entry.changelog, 120));
    }
}
function printModerationSummary(moderation) {
    const status = normalizeModeration(moderation);
    if (!status)
        return;
    const label = status.isMalwareBlocked
        ? "MALICIOUS"
        : status.isSuspicious
            ? "SUSPICIOUS"
            : (status.verdict ?? "clean").toUpperCase();
    printInspectRow("Moderate", label);
    if (status.reasonCodes?.length) {
        printInspectRow("Reasons", status.reasonCodes.join(", "));
    }
    if (status.legacyReason) {
        printInspectRow("Reason", status.legacyReason);
    }
    if (typeof status.updatedAt === "number") {
        printInspectRow("Mod Time", formatTimestamp(status.updatedAt));
    }
    if (status.engineVersion) {
        printInspectRow("Engine", status.engineVersion);
    }
    if (status.summary) {
        printInspectRow("Mod Note", truncate(status.summary, 160));
    }
    if (status.legacyReason === "quality.low") {
        printInspectRow("Guidance", "Visibility Guidance: publish a substantive update that passes quality assessment, then re-run inspect.");
    }
}
function normalizeModeration(moderation) {
    if (!moderation || typeof moderation !== "object")
        return null;
    const value = moderation;
    if (typeof value.isSuspicious !== "boolean")
        return null;
    if (typeof value.isMalwareBlocked !== "boolean")
        return null;
    const verdict = value.verdict === "clean" || value.verdict === "suspicious" || value.verdict === "malicious"
        ? value.verdict
        : undefined;
    const reasonCodes = Array.isArray(value.reasonCodes)
        ? value.reasonCodes.filter((reason) => typeof reason === "string")
        : undefined;
    return {
        isSuspicious: value.isSuspicious,
        isMalwareBlocked: value.isMalwareBlocked,
        verdict,
        reasonCodes,
        updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : null,
        engineVersion: typeof value.engineVersion === "string" ? value.engineVersion : null,
        summary: typeof value.summary === "string" && value.summary.trim() ? value.summary : null,
        legacyReason: typeof value.legacyReason === "string" ? value.legacyReason : null,
    };
}
function normalizeTags(tags) {
    if (!tags || typeof tags !== "object")
        return {};
    const entries = Object.entries(tags);
    const resolved = {};
    for (const [tag, version] of entries) {
        if (typeof version === "string")
            resolved[tag] = version;
    }
    return resolved;
}
function readRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function readString(record, key) {
    const value = record?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function readBoolean(value, key) {
    const record = readRecord(value);
    return record?.[key] === true;
}
function readSkillCardUrl(result) {
    const root = readRecord(result);
    const card = readRecord(root?.["card"]);
    if (!readBoolean(card, "available"))
        return null;
    return readString(card, "url");
}
function normalizeFiles(files) {
    if (!Array.isArray(files))
        return [];
    return files
        .map((file) => {
        if (!file || typeof file !== "object")
            return null;
        const entry = file;
        if (typeof entry.path !== "string")
            return null;
        const size = typeof entry.size === "number" ? entry.size : Number(entry.size);
        const sha256 = typeof entry.sha256 === "string" ? entry.sha256 : null;
        const contentType = typeof entry.contentType === "string" ? entry.contentType : null;
        return {
            path: entry.path,
            size: Number.isFinite(size) ? size : null,
            sha256,
            contentType,
        };
    })
        .filter((entry) => Boolean(entry));
}
function formatVersionLine(item) {
    if (!item || typeof item !== "object")
        return "-";
    const entry = item;
    const version = typeof entry.version === "string" ? entry.version : "?";
    const createdAt = typeof entry.createdAt === "number" ? formatTimestamp(entry.createdAt) : "unknown";
    const changelog = typeof entry.changelog === "string" ? entry.changelog : "";
    const snippet = changelog ? `  ${truncate(changelog, 80)}` : "";
    return `${version}  ${createdAt}${snippet}`;
}
function printSecuritySummary(version) {
    if (!version || typeof version !== "object")
        return;
    const sec = normalizeSecurity(version.security);
    if (!sec)
        return;
    printInspectRow("Security", sec.status.toUpperCase());
    if (sec.hasWarnings) {
        printInspectRow("Warnings", "yes");
    }
    if (typeof sec.checkedAt === "number") {
        printInspectRow("Checked", formatTimestamp(sec.checkedAt));
    }
    if (sec.model) {
        printInspectRow("Model", sec.model);
    }
}
function normalizeSecurity(security) {
    if (!security || typeof security !== "object")
        return null;
    const value = security;
    if (value.status !== "clean" &&
        value.status !== "suspicious" &&
        value.status !== "malicious" &&
        value.status !== "pending" &&
        value.status !== "error") {
        return null;
    }
    if (typeof value.hasWarnings !== "boolean")
        return null;
    const checkedAt = typeof value.checkedAt === "number" ? value.checkedAt : null;
    const model = typeof value.model === "string" ? value.model : null;
    return {
        status: value.status,
        hasWarnings: value.hasWarnings,
        checkedAt,
        model,
    };
}
function formatFileLine(file) {
    const size = file.size === null ? "?" : formatBytes(file.size);
    const sha = file.sha256 ?? "?";
    const type = file.contentType ? `  ${file.contentType}` : "";
    return `${file.path}  ${size}  ${sha}${type}`;
}
function formatTimestamp(timestamp) {
    if (!Number.isFinite(timestamp))
        return "unknown";
    const date = new Date(timestamp);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}
function formatBytes(bytes) {
    if (!Number.isFinite(bytes))
        return "?";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
        value /= 1024;
        index += 1;
    }
    const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${rounded}${units[index]}`;
}
function clampLimit(limit, fallback) {
    if (!Number.isFinite(limit))
        return fallback;
    return Math.min(Math.max(1, Math.round(limit)), 200);
}
function truncate(str, maxLen) {
    if (str.length <= maxLen)
        return str;
    return `${str.slice(0, maxLen - 3)}...`;
}
//# sourceMappingURL=inspect.js.map