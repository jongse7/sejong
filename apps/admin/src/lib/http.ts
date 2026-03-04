import ky from "ky";
import { clearAdminApiKey, getAdminApiKey } from "@/lib/admin-auth";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";
const ADMIN_AUTH_REQUIRED_EVENT = "admin-auth-required";

export const http = ky.create({
  prefixUrl: apiBaseUrl,
  hooks: {
    beforeRequest: [
      request => {
        const adminApiKey = getAdminApiKey();
        if (adminApiKey) {
          request.headers.set("x-admin-key", adminApiKey);
        }
      },
    ],
    afterResponse: [
      (_request, _options, response) => {
        if (response.status !== 401) return response;

        clearAdminApiKey();

        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(ADMIN_AUTH_REQUIRED_EVENT));
        }

        return response;
      },
    ],
  },
});
