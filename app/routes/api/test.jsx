export const loader = async ({ request }) => {
  console.log("[test] hit:", request.url);
  return new Response(JSON.stringify({ ok: true, message: "TEST API working!" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};