import { z } from "zod";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { createClient } from "@supabase/supabase-js";
import {
  adminPostResponseSchema,
  adminPostsResponseSchema,
  createPostInputSchema,
  createTagInputSchema,
  healthResponseSchema,
  postSchema,
  postStatusSchema,
  profileResponseSchema,
  profileSchema,
  publicPostResponseSchema,
  publicPostsResponseSchema,
  publicPostsWithMarkdownResponseSchema,
  tagSchema,
  tagsResponseSchema,
  updatePostInputSchema,
  updateTagInputSchema,
  upsertProfileInputSchema,
  type CreatePostInput,
  type CreateTagInput,
  type Post,
  type Profile,
  type Tag,
  type UpdatePostInput,
  type UpdateTagInput,
  type UpsertProfileInput,
} from "@portfolio/schema";

const app = new Hono({
  getPath: req => {
    const pathname = new URL(req.url).pathname;
    if (pathname === "/") return pathname;
    if (pathname === "/api" || pathname.startsWith("/api/")) return pathname;
    return pathname.startsWith("/") ? `/api${pathname}` : `/api/${pathname}`;
  },
});

app.use("/api/*", cors());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ADMIN_KEY =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const WEB_DEPLOY_HOOK_URL = process.env.WEB_DEPLOY_HOOK_URL;

const supabase =
  SUPABASE_URL && SUPABASE_ADMIN_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ADMIN_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const missingConfigMessage =
  "Missing SUPABASE_URL or SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in apps/server environment.";

const postSelect = `
  id,
  slug,
  title,
  excerpt,
  markdown,
  cover_image,
  status,
  featured,
  published_at,
  created_at,
  updated_at,
  post_tags (
    tags (
      id,
      name,
      slug,
      created_at
    )
  )
`;

const profileSelect = `
  id,
  display_name,
  headline,
  bio,
  avatar_url,
  location,
  email,
  website_url,
  socials,
  updated_at
`;

const tagSelect = `
  id,
  name,
  slug,
  created_at
`;

const postIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const slugParamsSchema = z.object({
  slug: z.string().min(1),
});

const publicPostsQuerySchema = z.object({
  tag: z.string().optional(),
  q: z.string().optional(),
  includeMarkdown: z
    .enum(["true", "false"])
    .optional()
    .transform((v: "true" | "false" | undefined) => v === "true"),
});

const adminPostsQuerySchema = z.object({
  status: postStatusSchema.optional(),
});

const adminAuthHeaderSchema = z.object({
  "x-admin-key": z.string().min(1).optional(),
});

const normalizeSlug = (value: string) =>
  value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toNullableUrlString = (value: unknown): string | null => {
  const trimmed = toNullableString(value);
  if (!trimmed) return null;

  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
};

const toStatusCode = (status?: number) => {
  switch (status) {
    case 400:
      return 400 as const;
    case 401:
      return 401 as const;
    case 403:
      return 403 as const;
    case 404:
      return 404 as const;
    case 422:
      return 422 as const;
    default:
      return 500 as const;
  }
};

const triggerWebRebuild = async (reason: string) => {
  if (!WEB_DEPLOY_HOOK_URL) return;
  try {
    await fetch(WEB_DEPLOY_HOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        trigger: "server-cms",
        reason,
        at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.warn("[deploy-hook] failed to trigger web rebuild", error);
  }
};

const normalizeTag = (row: any): Tag =>
  tagSchema.parse({
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at,
  });

const normalizeProfile = (row: any): Profile =>
  profileSchema.parse({
    id: row.id,
    displayName: row.display_name,
    intro: (() => {
      const source =
        row.socials && typeof row.socials === "object"
          ? (row.socials as Record<string, unknown>)
          : {};
      const value = source.intro;
      return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
    })(),
    headline: row.headline,
    bio: row.bio,
    achievements: (() => {
      const source =
        row.socials && typeof row.socials === "object"
          ? (row.socials as Record<string, unknown>)
          : {};
      if (!Array.isArray(source.achievements)) return [];
      return source.achievements
        .filter((item: unknown): item is string => typeof item === "string")
        .map(item => item.trim())
        .filter(Boolean);
    })(),
    avatarUrl: row.avatar_url,
    location: row.location,
    email: row.email,
    websiteUrl: row.website_url,
    socials: (() => {
      const source =
        row.socials && typeof row.socials === "object"
          ? (row.socials as Record<string, unknown>)
          : {};
      const instagramSource =
        typeof source.instagram === "string"
          ? source.instagram
          : typeof source.x === "string"
            ? source.x
            : null;

      // Prevent malformed legacy socials data from breaking the profile response.
      // Non-URL values are normalized to null.
      return {
        github: toNullableUrlString(source.github),
        linkedin: toNullableUrlString(source.linkedin),
        facebook: toNullableUrlString(source.facebook),
        telegram: toNullableUrlString(source.telegram),
        youtube: toNullableUrlString(source.youtube),
        instagram: toNullableUrlString(instagramSource),
      };
    })(),
    updatedAt: row.updated_at,
  });

const normalizePost = (row: any): Post => {
  const tags = Array.isArray(row.post_tags)
    ? row.post_tags
        .map((pt: any) => pt?.tags)
        .filter(Boolean)
        .map(normalizeTag)
    : [];

  return postSchema.parse({
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    markdown: row.markdown,
    coverImage: row.cover_image,
    status: row.status,
    featured: row.featured ?? false,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags,
  });
};

const ensureDb = () => {
  if (!supabase) {
    throw new Error(missingConfigMessage);
  }
  return supabase;
};

const getProfile = async () => {
  const db = ensureDb();
  const { data, error } = await db
    .from("profiles")
    .select(profileSelect)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return normalizeProfile(data);
};

const saveProfile = async (input: UpsertProfileInput) => {
  const db = ensureDb();
  const current = await getProfile();
  const nextIntro =
    typeof input.intro === "undefined"
      ? current?.intro ?? null
      : toNullableString(input.intro);
  const nextAchievements = input.achievements ?? current?.achievements ?? [];

  const payload = {
    display_name: input.displayName,
    headline: toNullableString(input.headline),
    bio: toNullableString(input.bio),
    avatar_url: toNullableString(input.avatarUrl),
    location: toNullableString(input.location),
    email: toNullableString(input.email),
    website_url: toNullableString(input.websiteUrl),
    socials: {
      ...(current?.socials ?? {}),
      ...(input.socials ?? {}),
      intro: nextIntro,
      achievements: nextAchievements,
    },
  };

  if (!current) {
    const { data, error } = await db
      .from("profiles")
      .insert(payload)
      .select(profileSelect)
      .single();
    if (error) throw error;
    return normalizeProfile(data);
  }

  const { data, error } = await db
    .from("profiles")
    .update(payload)
    .eq("id", current.id)
    .select(profileSelect)
    .single();
  if (error) throw error;
  return normalizeProfile(data);
};

const listTags = async () => {
  const db = ensureDb();
  const { data, error } = await db.from("tags").select(tagSelect).order("name");
  if (error) throw error;
  return (data ?? []).map(normalizeTag);
};

const createTag = async (input: CreateTagInput) => {
  const db = ensureDb();
  const normalizedName = input.name.trim();
  const slug = input.slug ? normalizeSlug(input.slug) : normalizeSlug(normalizedName);

  const { data, error } = await db
    .from("tags")
    .insert({
      name: normalizedName,
      slug,
    })
    .select(tagSelect)
    .single();

  if (error) throw error;
  return normalizeTag(data);
};

const updateTag = async (id: string, input: UpdateTagInput) => {
  const db = ensureDb();

  const payload: Record<string, unknown> = {};
  if (typeof input.name === "string") payload.name = input.name.trim();
  if (typeof input.slug === "string") payload.slug = normalizeSlug(input.slug);

  const { data, error } = await db
    .from("tags")
    .update(payload)
    .eq("id", id)
    .select(tagSelect)
    .single();

  if (error) throw error;
  return normalizeTag(data);
};

const deleteTag = async (id: string) => {
  const db = ensureDb();
  const { error } = await db.from("tags").delete().eq("id", id);
  if (error) throw error;
};

const ensureTagsByName = async (tagNames: string[]) => {
  const db = ensureDb();
  const uniqueNames = [...new Set(tagNames.map(name => name.trim()).filter(Boolean))];

  if (uniqueNames.length === 0) return [] as Tag[];

  const slugs = uniqueNames.map(normalizeSlug);

  const { data: existingRows, error: existingError } = await db
    .from("tags")
    .select(tagSelect)
    .in("slug", slugs);

  if (existingError) throw existingError;

  const existing = (existingRows ?? []).map(normalizeTag);
  const existingBySlug = new Map(existing.map(tag => [tag.slug, tag]));
  const missing = uniqueNames.filter(name => !existingBySlug.has(normalizeSlug(name)));

  let created: Tag[] = [];
  if (missing.length > 0) {
    const { data: insertedRows, error: insertError } = await db
      .from("tags")
      .insert(
        missing.map(name => ({
          name,
          slug: normalizeSlug(name),
        }))
      )
      .select(tagSelect);

    if (insertError) throw insertError;
    created = (insertedRows ?? []).map(normalizeTag);
  }

  return [...existing, ...created];
};

const listPosts = async (status?: "draft" | "published") => {
  const db = ensureDb();
  let query = db
    .from("posts")
    .select(postSelect)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map(normalizePost);
};

const getPostById = async (id: string) => {
  const db = ensureDb();
  const { data, error } = await db
    .from("posts")
    .select(postSelect)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return normalizePost(data);
};

const getPublishedPostBySlug = async (slug: string) => {
  const db = ensureDb();
  const { data, error } = await db
    .from("posts")
    .select(postSelect)
    .eq("slug", normalizeSlug(slug))
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return normalizePost(data);
};

const syncPostTags = async (postId: string, tags: Tag[]) => {
  const db = ensureDb();
  const { error: deleteError } = await db
    .from("post_tags")
    .delete()
    .eq("post_id", postId);
  if (deleteError) throw deleteError;

  if (tags.length === 0) return;

  const { error: insertError } = await db.from("post_tags").insert(
    tags.map(tag => ({
      post_id: postId,
      tag_id: tag.id,
    }))
  );
  if (insertError) throw insertError;
};

const createPost = async (input: CreatePostInput) => {
  const db = ensureDb();
  const nowIso = new Date().toISOString();
  const slug = normalizeSlug(input.slug ?? input.title);
  const nextStatus = input.status ?? "draft";
  const shouldPublish = nextStatus === "published";

  const { data, error } = await db
    .from("posts")
    .insert({
      slug,
      title: input.title.trim(),
      excerpt: toNullableString(input.excerpt),
      markdown: input.markdown,
      cover_image: toNullableString(input.coverImage),
      status: nextStatus,
      featured: input.featured ?? false,
      published_at: shouldPublish
        ? toNullableString(input.publishedAt) ?? nowIso
        : null,
    })
    .select(postSelect)
    .single();

  if (error) throw error;

  const tags = await ensureTagsByName(input.tags ?? []);
  await syncPostTags(data.id, tags);
  const saved = await getPostById(data.id);
  if (!saved) throw new Error("Post created but could not be reloaded.");
  return saved;
};

const updatePost = async (id: string, input: UpdatePostInput) => {
  const db = ensureDb();
  const current = await getPostById(id);
  if (!current) return null;

  const payload: Record<string, unknown> = {};
  if (typeof input.title === "string") payload.title = input.title.trim();
  if (typeof input.slug === "string")
    payload.slug = normalizeSlug(input.slug || input.title || current.slug);
  if (typeof input.excerpt === "string" || input.excerpt === null)
    payload.excerpt = toNullableString(input.excerpt);
  if (typeof input.markdown === "string") payload.markdown = input.markdown;
  if (typeof input.coverImage === "string" || input.coverImage === null)
    payload.cover_image = toNullableString(input.coverImage);
  if (typeof input.featured === "boolean") payload.featured = input.featured;
  if (input.status) payload.status = input.status;

  const nextStatus = (payload.status as string | undefined) ?? current.status;
  if (nextStatus === "published") {
    payload.published_at =
      toNullableString(input.publishedAt) ??
      current.publishedAt ??
      new Date().toISOString();
  }
  if (nextStatus === "draft") {
    payload.published_at = null;
  }

  const { error } = await db.from("posts").update(payload).eq("id", id);
  if (error) throw error;

  if (Array.isArray(input.tags)) {
    const tags = await ensureTagsByName(input.tags);
    await syncPostTags(id, tags);
  }

  return getPostById(id);
};

const deletePost = async (id: string) => {
  const db = ensureDb();
  const { error } = await db.from("posts").delete().eq("id", id);
  if (error) throw error;
};

const withErrorHandling = async <T>(
  run: () => Promise<T>,
  onError: (message: string, status?: number) => Response
) => {
  try {
    return await run();
  } catch (error: any) {
    const message =
      typeof error?.message === "string" ? error.message : "Unexpected server error";
    const status = message.includes("Missing SUPABASE_") ? 500 : 400;
    return onError(message, status);
  }
};

const requireAdmin = zValidator("header", adminAuthHeaderSchema, (result, c) => {
  if (!result.success) {
    return c.json({ message: "Missing x-admin-key header." }, 401);
  }

  if (!ADMIN_API_KEY) {
    return c.json({ message: "Missing ADMIN_API_KEY in server environment." }, 500);
  }

  const token = result.data["x-admin-key"];
  if (token !== ADMIN_API_KEY) {
    return c.json({ message: "Unauthorized." }, 401);
  }
});

app.get("/", c => c.redirect("/api/health", 302));

app.get("/api/health", c => {
  const payload = healthResponseSchema.parse({ ok: true, service: "api" });
  return c.json(payload);
});

app.get("/api/public/profile", async c => {
  const result = await withErrorHandling(
    async () => {
      const profile = await getProfile();
      return c.json(profileResponseSchema.parse({ profile }));
    },
    (message, status = 500) => c.json({ message }, toStatusCode(status))
  );

  return result;
});

app.get("/api/public/tags", async c => {
  const result = await withErrorHandling(
    async () => {
      const tags = await listTags();
      return c.json(tagsResponseSchema.parse({ tags }));
    },
    (message, status = 500) => c.json({ message }, toStatusCode(status))
  );

  return result;
});

app.get("/api/public/posts", zValidator("query", publicPostsQuerySchema), async c => {
  const query = c.req.valid("query");
  const includeMarkdown = query.includeMarkdown ?? false;
  const tagFilter = query.tag?.toLowerCase();
  const textFilter = query.q?.toLowerCase().trim();

  const result = await withErrorHandling(
    async () => {
      const posts = await listPosts("published");
      const filtered = posts.filter(post => {
        const matchTag = tagFilter
          ? post.tags.some(tag => tag.slug === tagFilter)
          : true;
        const matchText = textFilter
          ? [post.title, post.excerpt ?? "", post.markdown]
              .join("\n")
              .toLowerCase()
              .includes(textFilter)
          : true;
        return matchTag && matchText;
      });

      if (includeMarkdown) {
        return c.json(publicPostsWithMarkdownResponseSchema.parse({ posts: filtered }));
      }

      const listItems = filtered.map(post => {
        const { markdown, ...rest } = post;
        return rest;
      });

      return c.json(publicPostsResponseSchema.parse({ posts: listItems }));
    },
    (message, status = 500) => c.json({ message }, toStatusCode(status))
  );

  return result;
});

app.get("/api/public/posts/:slug", zValidator("param", slugParamsSchema), async c => {
  const { slug } = c.req.valid("param");

  const result = await withErrorHandling(
    async () => {
      const post = await getPublishedPostBySlug(slug);
      return c.json(publicPostResponseSchema.parse({ post }));
    },
    (message, status = 500) => c.json({ message }, toStatusCode(status))
  );

  return result;
});

app.get("/api/admin/profile", requireAdmin, async c => {
  const result = await withErrorHandling(
    async () => {
      const profile = await getProfile();
      return c.json(profileResponseSchema.parse({ profile }));
    },
    (message, status = 500) => c.json({ message }, toStatusCode(status))
  );

  return result;
});

app.put(
  "/api/admin/profile",
  requireAdmin,
  zValidator("json", upsertProfileInputSchema),
  async c => {
    const input = c.req.valid("json");
    const result = await withErrorHandling(
      async () => {
        const profile = await saveProfile(input);
        await triggerWebRebuild("profile-updated");
        return c.json(profileResponseSchema.parse({ profile }));
      },
      (message, status = 500) => c.json({ message }, toStatusCode(status))
    );

    return result;
  }
);

app.get(
  "/api/admin/posts",
  requireAdmin,
  zValidator("query", adminPostsQuerySchema),
  async c => {
    const { status } = c.req.valid("query");
    const result = await withErrorHandling(
      async () => {
        const posts = await listPosts(status);
        return c.json(adminPostsResponseSchema.parse({ posts }));
      },
      (message, statusCode = 500) => c.json({ message }, toStatusCode(statusCode))
    );

    return result;
  }
);

app.get("/api/admin/posts/:id", requireAdmin, zValidator("param", postIdParamsSchema), async c => {
  const { id } = c.req.valid("param");
  const result = await withErrorHandling(
    async () => {
      const post = await getPostById(id);
      return c.json(adminPostResponseSchema.parse({ post }));
    },
    (message, statusCode = 500) => c.json({ message }, toStatusCode(statusCode))
  );

  return result;
});

app.post(
  "/api/admin/posts",
  requireAdmin,
  zValidator("json", createPostInputSchema),
  async c => {
    const input = c.req.valid("json");
    const result = await withErrorHandling(
      async () => {
        const post = await createPost(input);
        await triggerWebRebuild(`post-created:${post.id}`);
        return c.json(adminPostResponseSchema.parse({ post }), 201);
      },
      (message, statusCode = 500) => c.json({ message }, toStatusCode(statusCode))
    );

    return result;
  }
);

app.patch(
  "/api/admin/posts/:id",
  requireAdmin,
  zValidator("param", postIdParamsSchema),
  zValidator("json", updatePostInputSchema),
  async c => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    const result = await withErrorHandling(
      async () => {
        const post = await updatePost(id, input);
        await triggerWebRebuild(`post-updated:${id}`);
        return c.json(adminPostResponseSchema.parse({ post }));
      },
      (message, statusCode = 500) => c.json({ message }, toStatusCode(statusCode))
    );

    return result;
  }
);

app.delete(
  "/api/admin/posts/:id",
  requireAdmin,
  zValidator("param", postIdParamsSchema),
  async c => {
    const { id } = c.req.valid("param");
    const result = await withErrorHandling(
      async () => {
        await deletePost(id);
        await triggerWebRebuild(`post-deleted:${id}`);
        return c.body(null, 204);
      },
      (message, statusCode = 500) => c.json({ message }, toStatusCode(statusCode))
    );

    return result;
  }
);

app.get("/api/admin/tags", requireAdmin, async c => {
  const result = await withErrorHandling(
    async () => {
      const tags = await listTags();
      return c.json(tagsResponseSchema.parse({ tags }));
    },
    (message, statusCode = 500) => c.json({ message }, toStatusCode(statusCode))
  );

  return result;
});

app.post(
  "/api/admin/tags",
  requireAdmin,
  zValidator("json", createTagInputSchema),
  async c => {
    const input = c.req.valid("json");
    const result = await withErrorHandling(
      async () => {
        const tag = await createTag(input);
        await triggerWebRebuild(`tag-created:${tag.id}`);
        return c.json(tagSchema.parse(tag), 201);
      },
      (message, statusCode = 500) => c.json({ message }, toStatusCode(statusCode))
    );

    return result;
  }
);

app.patch(
  "/api/admin/tags/:id",
  requireAdmin,
  zValidator("param", postIdParamsSchema),
  zValidator("json", updateTagInputSchema),
  async c => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    const result = await withErrorHandling(
      async () => {
        const tag = await updateTag(id, input);
        await triggerWebRebuild(`tag-updated:${id}`);
        return c.json(tagSchema.parse(tag));
      },
      (message, statusCode = 500) => c.json({ message }, toStatusCode(statusCode))
    );

    return result;
  }
);

app.delete(
  "/api/admin/tags/:id",
  requireAdmin,
  zValidator("param", postIdParamsSchema),
  async c => {
    const { id } = c.req.valid("param");
    const result = await withErrorHandling(
      async () => {
        await deleteTag(id);
        await triggerWebRebuild(`tag-deleted:${id}`);
        return c.body(null, 204);
      },
      (message, statusCode = 500) => c.json({ message }, toStatusCode(statusCode))
    );

    return result;
  }
);

export default app;
