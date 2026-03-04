import { profileResponseSchema, type Profile } from "@portfolio/schema";

const cmsBaseUrl = import.meta.env.CMS_API_BASE_URL;

const getCmsUrl = (path: string) => {
  if (!cmsBaseUrl) return null;
  return new URL(path, cmsBaseUrl).toString();
};

let profileCache: Promise<Profile | null> | null = null;

export const fetchPublicProfile = async (): Promise<Profile | null> => {
  if (profileCache) return profileCache;

  profileCache = (async () => {
    const url = getCmsUrl("/api/public/profile");
    if (!url) return null;

    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) return null;
      const json = await response.json();
      return profileResponseSchema.parse(json).profile;
    } catch (error) {
      console.warn("[cms] failed to fetch profile", error);
      return null;
    }
  })();

  return profileCache;
};
