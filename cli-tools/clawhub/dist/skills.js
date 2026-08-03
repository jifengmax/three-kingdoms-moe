import { createHash } from "node:crypto";
import { access, mkdir, open, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { unzipSync } from "fflate";
import ignore from "ignore";
import mime from "mime";
import { LockfileSchema, parseArk, TEXT_FILE_EXTENSION_SET, } from "./schema/index.js";
const DOT_DIR = ".clawhub";
const LEGACY_DOT_DIR = ".clawdhub";
const DOT_IGNORE = ".clawhubignore";
const LEGACY_DOT_IGNORE = ".clawdhubignore";
const TEXT_SAMPLE_BYTES = 4096;
export async function extractZipToDir(zipBytes, targetDir) {
    const entries = unzipSync(zipBytes);
    await mkdir(targetDir, { recursive: true });
    for (const [rawPath, data] of Object.entries(entries)) {
        const safePath = sanitizeRelPath(rawPath);
        if (!safePath)
            continue;
        const outPath = join(targetDir, safePath);
        await mkdir(dirname(outPath), { recursive: true });
        await writeFile(outPath, data);
    }
}
export async function extractGitHubZipPathToDir(zipBytes, targetDir, sourcePath) {
    const entries = unzipSync(zipBytes);
    const normalizedSourcePath = normalizeGitHubSourcePath(sourcePath);
    let wroteFile = false;
    await mkdir(targetDir, { recursive: true });
    for (const [rawPath, data] of Object.entries(entries)) {
        const safeZipPath = sanitizeRelPath(rawPath);
        if (!safeZipPath)
            continue;
        const repoRelativePath = stripGitHubZipRoot(safeZipPath);
        if (repoRelativePath === null)
            continue;
        const targetRelativePath = getGitHubSourceRelativePath(repoRelativePath, normalizedSourcePath);
        if (!targetRelativePath)
            continue;
        const safeTargetPath = sanitizeRelPath(targetRelativePath);
        if (!safeTargetPath)
            continue;
        const outPath = join(targetDir, safeTargetPath);
        await mkdir(dirname(outPath), { recursive: true });
        await writeFile(outPath, data);
        wroteFile = true;
    }
    if (!wroteFile) {
        throw new Error(`GitHub zip did not contain ${sourcePath}`);
    }
}
export async function listTextFiles(root) {
    const files = [];
    const absRoot = resolve(root);
    const ig = ignore();
    ig.add([".git/", "node_modules/", `${DOT_DIR}/`, `${LEGACY_DOT_DIR}/`]);
    await addIgnoreFile(ig, join(absRoot, ".gitignore"));
    await addIgnoreFile(ig, join(absRoot, DOT_IGNORE));
    await addIgnoreFile(ig, join(absRoot, LEGACY_DOT_IGNORE));
    await walk(absRoot, async (absPath) => {
        const relPath = normalizePath(relative(absRoot, absPath));
        if (!relPath)
            return;
        if (ig.ignores(relPath))
            return;
        if (hasDotPathSegment(relPath))
            return;
        const ext = getFileExtension(relPath);
        if (ext && !TEXT_FILE_EXTENSION_SET.has(ext))
            return;
        if (!ext && !(await isLikelyTextFile(absPath)))
            return;
        const buffer = await readFile(absPath);
        const contentType = mime.getType(relPath) ?? "text/plain";
        files.push({ relPath, bytes: new Uint8Array(buffer), contentType });
    });
    return files;
}
export function sha256Hex(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}
export function buildSkillFingerprint(files) {
    const normalized = files
        .filter((file) => Boolean(file.path) && Boolean(file.sha256))
        .map((file) => ({ path: file.path, sha256: file.sha256 }))
        .sort((a, b) => a.path.localeCompare(b.path));
    const payload = normalized.map((file) => `${file.path}:${file.sha256}`).join("\n");
    return createHash("sha256").update(payload).digest("hex");
}
export function hashSkillFiles(files) {
    const hashed = files.map((file) => ({
        path: file.relPath,
        sha256: sha256Hex(file.bytes),
        size: file.bytes.byteLength,
    }));
    return { files: hashed, fingerprint: buildSkillFingerprint(hashed) };
}
export function hashSkillZip(zipBytes) {
    const entries = unzipSync(zipBytes);
    const hashed = Object.entries(entries)
        .map(([rawPath, bytes]) => {
        const safePath = sanitizeZipPath(rawPath);
        if (!safePath)
            return null;
        if (hasDotPathSegment(safePath))
            return null;
        const ext = getFileExtension(safePath);
        if (ext && !TEXT_FILE_EXTENSION_SET.has(ext))
            return null;
        if (!ext && !isLikelyTextBytes(bytes))
            return null;
        return { path: safePath, sha256: sha256Hex(bytes), size: bytes.byteLength };
    })
        .filter(Boolean);
    return { files: hashed, fingerprint: buildSkillFingerprint(hashed) };
}
export async function readLockfile(workdir) {
    const paths = [join(workdir, DOT_DIR, "lock.json"), join(workdir, LEGACY_DOT_DIR, "lock.json")];
    for (const path of paths) {
        try {
            const raw = await readFile(path, "utf8");
            const parsed = JSON.parse(raw);
            return parseArk(LockfileSchema, parsed, "Lockfile");
        }
        catch {
            // try next
        }
    }
    return { version: 1, skills: {} };
}
export async function writeLockfile(workdir, lock) {
    const path = join(workdir, DOT_DIR, "lock.json");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
}
export async function readSkillOrigin(skillFolder) {
    const paths = [
        join(skillFolder, DOT_DIR, "origin.json"),
        join(skillFolder, LEGACY_DOT_DIR, "origin.json"),
    ];
    for (const path of paths) {
        try {
            const raw = await readFile(path, "utf8");
            const parsed = JSON.parse(raw);
            if (parsed.version !== 1)
                return null;
            if (!parsed.registry || !parsed.slug || !parsed.installedVersion)
                return null;
            if (typeof parsed.installedAt !== "number" || !Number.isFinite(parsed.installedAt)) {
                return null;
            }
            return {
                version: 1,
                registry: parsed.registry,
                slug: parsed.slug,
                ownerHandle: typeof parsed.ownerHandle === "string" ? parsed.ownerHandle : undefined,
                installedVersion: parsed.installedVersion,
                installedAt: parsed.installedAt,
                fingerprint: typeof parsed.fingerprint === "string" ? parsed.fingerprint : undefined,
            };
        }
        catch {
            // try next
        }
    }
    return null;
}
export async function writeSkillOrigin(skillFolder, origin) {
    const path = join(skillFolder, DOT_DIR, "origin.json");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(origin, null, 2)}\n`, "utf8");
}
function normalizePath(path) {
    return path
        .split(sep)
        .join("/")
        .replace(/^\.\/+/, "");
}
function getFileExtension(path) {
    const name = path.split("/").at(-1) ?? path;
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}
function hasDotPathSegment(path) {
    return path.split("/").some((segment) => segment.startsWith("."));
}
async function isLikelyTextFile(path) {
    const handle = await open(path, "r");
    try {
        const sample = new Uint8Array(TEXT_SAMPLE_BYTES);
        const { bytesRead } = await handle.read(sample, 0, sample.byteLength, 0);
        return isLikelyTextBytes(sample.subarray(0, bytesRead));
    }
    finally {
        await handle.close();
    }
}
function isLikelyTextBytes(bytes) {
    const sample = bytes.slice(0, TEXT_SAMPLE_BYTES);
    if (sample.includes(0))
        return false;
    try {
        new TextDecoder("utf-8", { fatal: true }).decode(sample);
        return true;
    }
    catch {
        return false;
    }
}
function sanitizeRelPath(path) {
    const normalized = path.replace(/^\.\/+/, "").replace(/^\/+/, "");
    if (!normalized || normalized.endsWith("/"))
        return null;
    if (normalized.includes("\\"))
        return null;
    const segments = normalized.split("/");
    if (segments.some((segment) => !segment || segment === "." || segment === ".."))
        return null;
    return normalized;
}
function sanitizeZipPath(path) {
    return sanitizeRelPath(path);
}
function normalizeGitHubSourcePath(path) {
    return path.replace(/^\.\/+/, "").replace(/^\/+|\/+$/g, "");
}
function stripGitHubZipRoot(path) {
    const slash = path.indexOf("/");
    if (slash < 0)
        return null;
    return path.slice(slash + 1);
}
function getGitHubSourceRelativePath(repoRelativePath, sourcePath) {
    if (!sourcePath)
        return repoRelativePath;
    if (repoRelativePath === sourcePath)
        return null;
    if (!repoRelativePath.startsWith(`${sourcePath}/`))
        return null;
    return repoRelativePath.slice(sourcePath.length + 1);
}
async function walk(dir, onFile) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith("."))
            continue;
        if (entry.name === "node_modules")
            continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            await walk(full, onFile);
            continue;
        }
        if (!entry.isFile())
            continue;
        await onFile(full);
    }
}
async function addIgnoreFile(ig, path) {
    try {
        const raw = await readFile(path, "utf8");
        ig.add(raw.split(/\r?\n/));
    }
    catch {
        // optional
    }
}
export async function listManualSkills(skillsDir, lockedSlugs) {
    const manual = [];
    let entries;
    try {
        entries = await readdir(skillsDir, { withFileTypes: true });
    }
    catch (error) {
        if (isMissingPathError(error))
            return manual;
        throw error;
    }
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        if (entry.name.startsWith("."))
            continue;
        if (lockedSlugs.has(entry.name))
            continue;
        if (await hasSkillMetadata(join(skillsDir, entry.name))) {
            manual.push(entry.name);
        }
    }
    return manual.sort((a, b) => a.localeCompare(b));
}
async function hasSkillMetadata(skillDir) {
    const candidates = [
        join(skillDir, "SKILL.md"),
        join(skillDir, DOT_DIR, "origin.json"),
        join(skillDir, LEGACY_DOT_DIR, "origin.json"),
    ];
    for (const path of candidates) {
        try {
            await access(path);
            return true;
        }
        catch (error) {
            if (!isMissingPathError(error))
                throw error;
        }
    }
    return false;
}
function isMissingPathError(error) {
    const code = error?.code;
    return code === "ENOENT" || code === "ENOTDIR";
}
//# sourceMappingURL=skills.js.map