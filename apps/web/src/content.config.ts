import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { publicPostsWithMarkdownResponseSchema } from "@portfolio/schema";
import { SITE } from "@/config";

export const BLOG_PATH = "src/data/blog";
const cmsBaseUrl = import.meta.env.CMS_API_BASE_URL;

const blogLoader = cmsBaseUrl
  ? async () => {
      try {
        const apiUrl = new URL("/api/public/posts?includeMarkdown=true", cmsBaseUrl);
        const response = await fetch(apiUrl, {
          headers: { accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`[cms] failed to load posts: ${response.status}`);
        }

        const json = await response.json();
        const posts = publicPostsWithMarkdownResponseSchema.parse(json).posts;

        return posts.map(post => ({
          id: post.slug,
          filePath: `${BLOG_PATH}/${post.slug}.md`,
          body: post.markdown,
          data: {
            author: SITE.author,
            pubDatetime: new Date(
              post.publishedAt ?? post.updatedAt ?? post.createdAt
            ),
            modDatetime: post.updatedAt ? new Date(post.updatedAt) : null,
            title: post.title,
            featured: post.featured,
            draft: post.status !== "published",
            tags: post.tags.map(tag => tag.name),
            ogImage: post.coverImage ?? undefined,
            description: post.excerpt ?? post.title,
            timezone: SITE.timezone,
          },
        }));
      } catch (error) {
        console.warn("[cms] failed to load posts. falling back to empty collection.", error);
        return [];
      }
    }
  : glob({ pattern: "**/[^_]*.md", base: `./${BLOG_PATH}` });

const blog = defineCollection({
  loader: blogLoader,
  schema: ({ image }) =>
    z.object({
      author: z.string().default(SITE.author),
      pubDatetime: z.date(),
      modDatetime: z.date().optional().nullable(),
      title: z.string(),
      featured: z.boolean().optional(),
      draft: z.boolean().optional(),
      tags: z.array(z.string()).default(["others"]),
      ogImage: image().or(z.string()).optional(),
      description: z.string(),
      canonicalURL: z.string().optional(),
      hideEditPost: z.boolean().optional(),
      timezone: z.string().optional(),
    }),
});

export const collections = { blog };
