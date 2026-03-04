import { z } from "zod";

export const idSchema = z.string().uuid();
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase kebab-case slug");
export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const absoluteOrRootRelativeUrlSchema = z.union([
  z.string().url(),
  z
    .string()
    .trim()
    .regex(/^\/[^\s]*$/, "Use absolute URL or root-relative path (e.g. /cover/image.webp)"),
]);

export const postStatusSchema = z.enum(["draft", "published"]);

export const tagSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(64),
  slug: slugSchema,
  createdAt: isoDateTimeSchema,
});

export const profileSocialsSchema = z
  .object({
    github: z.string().url().nullable().optional(),
    linkedin: z.string().url().nullable().optional(),
    facebook: z.string().url().nullable().optional(),
    telegram: z.string().url().nullable().optional(),
    youtube: z.string().url().nullable().optional(),
    instagram: z.string().url().nullable().optional(),
  })
  .default({});

export const profileSchema = z.object({
  id: idSchema,
  displayName: z.string().trim().min(1).max(120),
  intro: z.string().trim().max(180).nullable(),
  headline: z.string().trim().max(180).nullable(),
  bio: z.string().trim().max(5000).nullable(),
  achievements: z.array(z.string().trim().min(1).max(200)).default([]),
  avatarUrl: z.string().url().nullable(),
  location: z.string().trim().max(120).nullable(),
  email: z.string().email().nullable(),
  websiteUrl: z.string().url().nullable(),
  socials: profileSocialsSchema,
  updatedAt: isoDateTimeSchema,
});

export const upsertProfileInputSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  intro: z.string().trim().max(180).nullable().optional(),
  headline: z.string().trim().max(180).nullable().optional(),
  bio: z.string().trim().max(5000).nullable().optional(),
  achievements: z.array(z.string().trim().min(1).max(200)).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  email: z.string().email().nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  socials: profileSocialsSchema.optional(),
});

export const postSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  title: z.string().trim().min(1).max(180),
  excerpt: z.string().trim().max(500).nullable(),
  markdown: z.string().min(1),
  coverImage: absoluteOrRootRelativeUrlSchema.nullable(),
  status: postStatusSchema,
  featured: z.boolean(),
  publishedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  tags: z.array(tagSchema),
});

export const publicPostSchema = postSchema.extend({
  status: z.literal("published"),
});

export const publicPostListItemSchema = publicPostSchema.omit({
  markdown: true,
});

export const createPostInputSchema = z.object({
  title: z.string().trim().min(1).max(180),
  slug: slugSchema.optional(),
  excerpt: z.string().trim().max(500).nullable().optional(),
  markdown: z.string().min(1),
  coverImage: absoluteOrRootRelativeUrlSchema.nullable().optional(),
  status: postStatusSchema.default("draft"),
  featured: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(64)).default([]),
  publishedAt: isoDateTimeSchema.nullable().optional(),
});

export const updatePostInputSchema = createPostInputSchema.partial();

export const createTagInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
  slug: slugSchema.optional(),
});

export const updateTagInputSchema = createTagInputSchema.partial();

export const apiErrorSchema = z.object({
  message: z.string(),
  issues: z.array(z.string()).optional(),
});

export const profileResponseSchema = z.object({
  profile: profileSchema.nullable(),
});

export const tagsResponseSchema = z.object({
  tags: z.array(tagSchema),
});

export const publicPostsResponseSchema = z.object({
  posts: z.array(publicPostListItemSchema),
});

export const publicPostsWithMarkdownResponseSchema = z.object({
  posts: z.array(publicPostSchema),
});

export const publicPostResponseSchema = z.object({
  post: publicPostSchema.nullable(),
});

export const adminPostsResponseSchema = z.object({
  posts: z.array(postSchema),
});

export const adminPostResponseSchema = z.object({
  post: postSchema.nullable(),
});

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("api"),
});

export type PostStatus = z.infer<typeof postStatusSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type Post = z.infer<typeof postSchema>;
export type PublicPost = z.infer<typeof publicPostSchema>;
export type PublicPostListItem = z.infer<typeof publicPostListItemSchema>;
export type UpsertProfileInput = z.infer<typeof upsertProfileInputSchema>;
export type CreatePostInput = z.infer<typeof createPostInputSchema>;
export type UpdatePostInput = z.infer<typeof updatePostInputSchema>;
export type CreateTagInput = z.infer<typeof createTagInputSchema>;
export type UpdateTagInput = z.infer<typeof updateTagInputSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
