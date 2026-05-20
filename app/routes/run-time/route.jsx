export const action = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const { shop, run_time } = body;

  if (!shop || !run_time) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: "Missing shop or run_time in request body",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const apiRoot = process.env.VITE_API_ROOT || "";

  if (apiRoot) {
    try {
      const targetUrl = `${apiRoot.replace(/\/$/, "")}/run-time`;
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shop, run_time }),
      });

      const data = await response.json().catch(() => ({}));

      return new Response(
        JSON.stringify({
          ok: response.ok,
          message:
            data?.message ||
            (response.ok ? "Run time updated" : "Failed to update run time"),
        }),
        {
          status: response.ok ? 200 : response.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: error.message || "Unable to proxy run time request",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      message: `Run time ${run_time} minutes received for ${shop}`,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};
