import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async () => {
  const goatcounterCode = process.env.PUBLIC_GOATCOUNTER_CODE?.trim();
  const goatcounterTotalUrl = goatcounterCode
    ? `https://${goatcounterCode}.goatcounter.com/counter/TOTAL.json`
    : undefined;

  if (!goatcounterTotalUrl) {
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
