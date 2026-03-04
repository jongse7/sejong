import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { getPath } from "@/utils/getPath";
import getSortedPosts from "@/utils/getSortedPosts";
import { isProjectPost } from "@/utils/postGrouping";
import { SITE } from "@/config";

export async function GET() {
  const posts = await getCollection("blog");
  const blogPosts = getSortedPosts(posts).filter(post => !isProjectPost(post));
  return rss({
    title: SITE.title,
    description: SITE.desc,
    site: SITE.website,
    items: blogPosts.map(({ data, id, filePath }) => ({
      link: getPath(id, filePath),
      title: data.title,
      description: data.description,
      pubDate: new Date(data.modDatetime ?? data.pubDatetime),
    })),
  });
}
