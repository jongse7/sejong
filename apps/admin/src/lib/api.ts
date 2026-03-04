import {
  adminPostResponseSchema,
  adminPostsResponseSchema,
  createPostInputSchema,
  createTagInputSchema,
  profileResponseSchema,
  tagSchema,
  tagsResponseSchema,
  updatePostInputSchema,
  upsertProfileInputSchema,
  type CreatePostInput,
  type CreateTagInput,
  type Post,
  type Profile,
  type Tag,
  type UpdatePostInput,
  type UpsertProfileInput,
} from "@portfolio/schema";
import { http } from "@/lib/http";

const asJson = async <T>(promise: Promise<T>) => promise;

export const api = {
  getProfile: async () => {
    const json = await asJson(
      http.get("api/admin/profile").json<unknown>()
    );
    return profileResponseSchema.parse(json).profile;
  },

  saveProfile: async (input: UpsertProfileInput) => {
    const payload = upsertProfileInputSchema.parse(input);
    const json = await asJson(
      http.put("api/admin/profile", { json: payload }).json<unknown>()
    );
    return profileResponseSchema.parse(json).profile;
  },

  listTags: async () => {
    const json = await asJson(http.get("api/admin/tags").json<unknown>());
    return tagsResponseSchema.parse(json).tags;
  },

  createTag: async (input: CreateTagInput) => {
    const payload = createTagInputSchema.parse(input);
    const json = await asJson(
      http.post("api/admin/tags", { json: payload }).json<unknown>()
    );
    return tagSchema.parse(json) as Tag;
  },

  updateTag: async (id: string, input: Partial<CreateTagInput>) => {
    const payload = createTagInputSchema.partial().parse(input);
    const json = await asJson(
      http.patch(`api/admin/tags/${id}`, { json: payload }).json<unknown>()
    );
    return tagSchema.parse(json) as Tag;
  },

  deleteTag: async (id: string) => {
    await http.delete(`api/admin/tags/${id}`);
  },

  listPosts: async (status?: "draft" | "published") => {
    const searchParams = status ? { status } : undefined;
    const json = await asJson(
      http.get("api/admin/posts", { searchParams }).json<unknown>()
    );
    return adminPostsResponseSchema.parse(json).posts;
  },

  getPost: async (id: string) => {
    const json = await asJson(
      http.get(`api/admin/posts/${id}`).json<unknown>()
    );
    return adminPostResponseSchema.parse(json).post;
  },

  createPost: async (input: CreatePostInput) => {
    const payload = createPostInputSchema.parse(input);
    const json = await asJson(
      http.post("api/admin/posts", { json: payload }).json<unknown>()
    );
    return adminPostResponseSchema.parse(json).post as Post;
  },

  updatePost: async (id: string, input: UpdatePostInput) => {
    const payload = updatePostInputSchema.parse(input);
    const json = await asJson(
      http.patch(`api/admin/posts/${id}`, { json: payload }).json<unknown>()
    );
    return adminPostResponseSchema.parse(json).post as Post;
  },

  deletePost: async (id: string) => {
    await http.delete(`api/admin/posts/${id}`);
  },
};

export type { Post, Profile, Tag };
