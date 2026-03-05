import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const codeFromQuery = url.searchParams.get("code")?.trim();
  const codeFromEnv = process.env.PUBLIC_GOATCOUNTER_CODE?.trim();
  const goatcounterCode = codeFromQuery || codeFromEnv;
  const isValidCode = Boolean(
    goatcounterCode && /^[a-z0-9][a-z0-9-]{0,62}$/i.test(goatcounterCode)
  );
  const goatcounterTotalUrl = goatcounterCode
    ? `https://${goatcounterCode}.goatcounter.com/counter/TOTAL.json`
    : undefined;

  if (!goatcounterTotalUrl || !isValidCode) {
    return Response.json(
      { count: null },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  try {
    const response = await fetch(goatcounterTotalUrl, {
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch GoatCounter total.");
    }

    const payload = await response.json();
    const rawCount = payload?.count;
    const parsedCount =
      typeof rawCount === "number"
        ? rawCount
        : typeof rawCount === "string"
          ? Number.parseInt(rawCount, 10)
          : Number.NaN;
    const count = Number.isFinite(parsedCount) ? parsedCount : null;

    return Response.json(
      { count },
      {
        headers: {
          "Cache-Control": "public, max-age=60",
        },
      }
    );
  } catch {
    return Response.json(
      { count: null },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
};
