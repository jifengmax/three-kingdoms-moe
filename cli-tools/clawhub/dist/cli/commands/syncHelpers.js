import { realpath } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { isCancel, multiselect } from "@clack/prompts";
import semver from "semver";
import { resolveHome } from "../../homedir.js";
import { apiRequest } from "../../http.js";
import { ApiRoutes, ApiV1SkillResolveResponseSchema } from "../../schema/index.js";
import { findSkillFolders } from "../scanSkills.js";
import { fail, formatError } from "../ui.js";
export function buildScanRoots(opts, extraRoots) {
    const roots = [opts.workdir, opts.dir, ...(extraRoots ?? [])];
    return Array.from(new Set(roots.map((root) => resolveScanRoot(opts, root))));
}
function resolveScanRoot(opts, root) {
    return isAbsolute(root) ? resolve(root) : resolve(opts.workdir, root);
}
export function normalizeConcurrency(value) {
    const raw = typeof value === "number" ? value : 4;
    const rounded = Number.isFinite(raw) ? Math.round(raw) : 4;
    return Math.min(32, Math.max(1, rounded));
}
export async function mapWithConcurrency(items, limit, fn) {
    const results = Array.from({ length: items.length });
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(1, limit), items.length || 1);
    async function worker() {
        while (true) {
            const index = nextIndex;
            nextIndex += 1;
            if (index >= items.length)
                return;
            results[index] = await fn(items[index]);
        }
    }
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}
export async function checkRegistrySyncState(registry, skill, ownerHandle, token) {
    try {
        const params = new URLSearchParams({
            slug: skill.slug,
            hash: skill.fingerprint,
        });
        if (ownerHandle)
            params.set("ownerHandle", ownerHandle);
        const resolved = await apiRequest(registry, {
            method: "GET",
            path: `${ApiRoutes.resolve}?${params.toString()}`,
            token,
        }, ApiV1SkillResolveResponseSchema);
        const latestVersion = resolved.latestVersion?.version ?? null;
        const matchVersion = resolved.match?.version ?? null;
        if (!latestVersion) {
            return { ...skill, status: "new", matchVersion: null, latestVersion: null };
        }
        return {
            ...skill,
            status: matchVersion ? "synced" : "update",
            matchVersion,
            latestVersion,
        };
    }
    catch (error) {
        const message = formatError(error);
        if (/skill not found/i.test(message) || /HTTP 404/i.test(message)) {
            return { ...skill, status: "new", matchVersion: null, latestVersion: null };
        }
        throw error;
    }
}
export async function scanRootsWithLabels(roots) {
    const all = [];
    const rootsWithSkills = [];
    const uniqueRoots = await dedupeRoots(roots);
    const skillsByRoot = {};
    for (const root of uniqueRoots) {
        const found = await findSkillFolders(root);
        skillsByRoot[root] = found;
        if (found.length > 0)
            rootsWithSkills.push(root);
        all.push(...found);
    }
    const byFolder = new Map();
    for (const folder of all) {
        byFolder.set(folder.folder, folder);
    }
    return {
        roots: uniqueRoots,
        skillsByRoot,
        skills: Array.from(byFolder.values()),
        rootsWithSkills,
    };
}
async function dedupeRoots(roots) {
    const seen = new Set();
    const unique = [];
    for (const root of roots) {
        const resolved = resolve(root);
        const canonical = await realpath(resolved).catch(() => null);
        const key = canonical ?? resolved;
        if (seen.has(key))
            continue;
        seen.add(key);
        unique.push(key);
    }
    return unique;
}
export async function selectToUpload(candidates, params) {
    if (params.all || !params.allowPrompt)
        return candidates;
    const valueByKey = new Map();
    const choices = candidates.map((candidate) => {
        const key = candidate.folder;
        valueByKey.set(key, candidate);
        return {
            value: key,
            label: `${candidate.slug}  ${formatActionableStatus(candidate, params.bump)}`,
            hint: `${abbreviatePath(candidate.folder)} | ${candidate.fileCount} files`,
        };
    });
    const picked = await multiselect({
        message: "Select skills to publish",
        options: choices,
        initialValues: choices.map((choice) => choice.value),
        required: false,
    });
    if (isCancel(picked))
        fail("Canceled");
    return picked.map((key) => valueByKey.get(key)).filter(Boolean);
}
export function resolvePublishMeta(skill, params) {
    if (skill.status === "new") {
        return { publishVersion: "1.0.0", changelog: "" };
    }
    const latest = skill.latestVersion;
    if (!latest)
        fail(`Could not resolve latest version for ${skill.slug}`);
    const publishVersion = semver.inc(latest, params.bump);
    if (!publishVersion)
        fail(`Could not bump version for ${skill.slug}`);
    const fromFlag = params.changelogFlag?.trim();
    return { publishVersion, changelog: fromFlag ?? "" };
}
export function formatList(values, max) {
    if (values.length === 0)
        return "";
    const shown = values.map(abbreviatePath);
    if (shown.length <= max)
        return shown.join("\n");
    const head = shown.slice(0, Math.max(1, max - 1));
    const rest = values.length - head.length;
    return [...head, `... +${rest} more`].join("\n");
}
export function printSection(title, body) {
    const trimmed = body?.trim();
    if (!trimmed) {
        console.log(title);
        return;
    }
    if (trimmed.includes("\n")) {
        console.log(`\n${title}\n${trimmed}`);
        return;
    }
    console.log(`${title}: ${trimmed}`);
}
function abbreviatePath(value) {
    const home = resolveHome();
    if (value.startsWith(home))
        return `~${value.slice(home.length)}`;
    return value;
}
export function dedupeSkillsBySlug(skills) {
    const bySlug = new Map();
    for (const skill of skills) {
        const existing = bySlug.get(skill.slug);
        if (existing)
            existing.push(skill);
        else
            bySlug.set(skill.slug, [skill]);
    }
    const unique = [];
    const duplicates = [];
    for (const [slug, entries] of bySlug.entries()) {
        unique.push(entries[0]);
        if (entries.length > 1)
            duplicates.push(`${slug} (${entries.length})`);
    }
    return { skills: unique, duplicates };
}
function formatActionableStatus(candidate, bump) {
    if (candidate.status === "new")
        return "NEW (publish 1.0.0)";
    const latest = candidate.latestVersion;
    const next = latest ? semver.inc(latest, bump) : null;
    if (latest && next)
        return `LOCAL CHANGES latest ${latest}; publish ${next}`;
    return "LOCAL CHANGES";
}
export function formatActionableLine(candidate, bump) {
    return `${candidate.slug}  ${formatActionableStatus(candidate, bump)}  (${candidate.fileCount} files)`;
}
function formatSyncedLine(candidate) {
    const version = candidate.matchVersion ?? candidate.latestVersion ?? "unknown";
    return `${candidate.slug}  synced (${version})`;
}
export function formatSyncedSummary(candidate) {
    const version = candidate.matchVersion ?? candidate.latestVersion;
    return version ? `${candidate.slug}@${version}` : candidate.slug;
}
export function formatBulletList(lines, max) {
    if (lines.length <= max)
        return lines.map((line) => `- ${line}`).join("\n");
    const head = lines.slice(0, max);
    const rest = lines.length - head.length;
    return [...head, `... +${rest} more`].map((line) => `- ${line}`).join("\n");
}
export function formatSyncedDisplay(synced) {
    const lines = synced.map(formatSyncedLine);
    if (lines.length <= 12)
        return formatBulletList(lines, 12);
    return formatCommaList(synced.map(formatSyncedSummary), 24);
}
export function formatCommaList(values, max) {
    if (values.length === 0)
        return "";
    if (values.length <= max)
        return values.join(", ");
    const head = values.slice(0, Math.max(1, max - 1));
    const rest = values.length - head.length;
    return `${head.join(", ")}, ... +${rest} more`;
}
//# sourceMappingURL=syncHelpers.js.map