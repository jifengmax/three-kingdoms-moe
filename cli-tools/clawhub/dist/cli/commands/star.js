import { apiRequest, registryUrl } from "../../http.js";
import { ApiRoutes, ApiV1StarResponseSchema } from "../../schema/index.js";
import { requireAuthToken } from "../authToken.js";
import { getRegistry } from "../registry.js";
import { createCrabLoader, fail, formatError, isInteractive, promptConfirm } from "../ui.js";
function parseSkillRef(skillArg) {
    const value = skillArg.trim().toLowerCase();
    if (!value)
        fail("Skill required");
    const slashIndex = value.indexOf("/");
    if (slashIndex < 0)
        return { slug: value, ownerHandle: undefined };
    if (value.indexOf("/", slashIndex + 1) >= 0)
        fail(`Invalid skill ref: ${skillArg}`);
    const ownerHandle = value.slice(0, slashIndex).replace(/^@+/, "");
    const slug = value.slice(slashIndex + 1);
    if (!ownerHandle || !slug)
        fail(`Invalid skill ref: ${skillArg}`);
    return { slug, ownerHandle };
}
function starRequestArgs(registry, slug, ownerHandle, token) {
    const path = `${ApiRoutes.stars}/${encodeURIComponent(slug)}`;
    if (!ownerHandle)
        return { method: "POST", path, token };
    const url = registryUrl(path, registry);
    url.searchParams.set("ownerHandle", ownerHandle);
    return { method: "POST", url: url.toString(), token };
}
export async function cmdStarSkill(opts, slugArg, options, inputAllowed) {
    const requested = parseSkillRef(slugArg);
    const slug = requested.slug;
    const allowPrompt = isInteractive() && inputAllowed !== false;
    if (!options.yes) {
        if (!allowPrompt)
            fail("Pass --yes (no input)");
        const ok = await promptConfirm(`Star ${slug}?`);
        if (!ok)
            return undefined;
    }
    const token = await requireAuthToken();
    const registry = await getRegistry(opts, { cache: true });
    const spinner = createCrabLoader(`Starring ${slug}`);
    try {
        const result = await apiRequest(registry, starRequestArgs(registry, slug, requested.ownerHandle, token), ApiV1StarResponseSchema);
        spinner.succeed(result.alreadyStarred ? `OK. ${slug} already starred.` : `OK. Starred ${slug}`);
        return result;
    }
    catch (error) {
        spinner.fail(formatError(error));
        throw error;
    }
}
//# sourceMappingURL=star.js.map