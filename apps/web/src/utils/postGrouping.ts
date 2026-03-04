import type { CollectionEntry } from "astro:content";
import { slugifyAll } from "./slugify";

const projectTagSlugs = new Set(["project", "projects"]);

export const isProjectPost = (post: CollectionEntry<"blog">) =>
  slugifyAll(post.data.tags ?? []).some(tag => projectTagSlugs.has(tag));

export const splitPostsByType = (posts: CollectionEntry<"blog">[]) => {
  const projects: CollectionEntry<"blog">[] = [];
  const blogs: CollectionEntry<"blog">[] = [];

  for (const post of posts) {
    if (isProjectPost(post)) {
      projects.push(post);
      continue;
    }
    blogs.push(post);
  }

  return { projects, blogs };
};
