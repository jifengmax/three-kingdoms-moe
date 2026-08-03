import { readdir, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { resolveHome } from "../homedir.js";
import { sanitizeSlug, titleCase } from "./slug.js";
export async function findSkillFolders(root) {
    const absRoot = resolve(root);
    const rootStat = await stat(absRoot).catch(() => null);
    if (!rootStat || !rootStat.isDirectory())
        return [];
    const direct = await isSkillFolder(absRoot);
    if (direct)
        return [direct];
    const entries = await readdir(absRoot, { withFileTypes: true }).catch(() => []);
    const folders = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(absRoot, entry.name));
    const results = [];
    for (const folder of folders) {
        const found = await isSkillFolder(folder);
        if (found)
            results.push(found);
    }
    return results.sort((a, b) => a.slug.localeCompare(b.slug));
}
export function getFallbackSkillRoots(workdir) {
    const home = resolveHome();
    const roots = [
        resolve(workdir, "..", "openclaw", "skills"),
        resolve(workdir, "..", "openclaw", "Skills"),
        resolve(home, ".openclaw", "skills"),
        resolve(home, ".openclaw", "Skills"),
        resolve(home, "openclaw", "skills"),
        resolve(home, "openclaw", "Skills"),
        resolve(home, "Library", "Application Support", "openclaw", "skills"),
        resolve(home, "Library", "Application Support", "openclaw", "Skills"),
    ];
    return Array.from(new Set(roots));
}
async function isSkillFolder(folder) {
    const marker = await findSkillMarker(folder);
    if (!marker)
        return null;
    const base = basename(folder);
    const slug = sanitizeSlug(base);
    if (!slug)
        return null;
    const displayName = titleCase(base);
    return { folder, slug, displayName };
}
async function findSkillMarker(folder) {
    const candidates = ["SKILL.md", "skill.md"];
    for (const name of candidates) {
        const path = join(folder, name);
        const st = await stat(path).catch(() => null);
        if (st?.isFile())
            return path;
    }
    return null;
}
//# sourceMappingURL=scanSkills.js.map