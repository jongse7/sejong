import ky from "ky";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";
const adminApiKey = import.meta.env.VITE_ADMIN_API_KEY ?? "";

export const http = ky.create({
  prefixUrl: apiBaseUrl,
  hooks: {
    beforeRequest: [
      request => {
        if (adminApiKey) {
          request.headers.set("x-admin-key", adminApiKey);
        }
      },
    ],
  },
});
