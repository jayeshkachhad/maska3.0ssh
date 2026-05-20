export const loader = async ({ request }) => {
  const apiRoot = process.env.VITE_API_ROOT || "";
  const targetUrl = apiRoot
    ? `${apiRoot.replace(/\/$/, "")}/api/locations/sync-locations`
    : new URL("/api/locations/sync-locations", request.url).toString();

  const response = await fetch(targetUrl, {
    method: "GET",
    headers: {
      cookie: request.headers.get("cookie") || "",
    },
  });

  const data = await response
    .json()
    .catch(() => ({ message: "Unable to parse response from sync endpoint" }));

  return new Response(JSON.stringify({
    ok: response.ok,
    message: data?.message || (response.ok ? "Inventory sync started" : "Failed to start inventory sync"),
  }), {
    status: response.ok ? 200 : response.status,
    headers: { "Content-Type": "application/json" },
  });
};
