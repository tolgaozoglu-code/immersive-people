// Decap CMS OAuth adim 2: kodu token'a cevir ve panele geri bildir.
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("Cookie") || "";
  const expected = (cookie.match(/cms_oauth_state=([^;]+)/) || [])[1];

  let payload, status;
  if (!code || !state || !expected || state !== expected) {
    status = "error";
    payload = { error: "Invalid OAuth state" };
  } else {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code
      })
    });
    const data = await res.json();
    if (data.access_token) {
      status = "success";
      payload = { token: data.access_token, provider: "github" };
    } else {
      status = "error";
      payload = { error: data.error_description || "Authentication failed" };
    }
  }

  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const html = `<!doctype html><html><body><script>
  (function () {
    function receive(e) {
      if (e.data !== "authorizing:github") return;
      window.removeEventListener("message", receive, false);
      window.opener.postMessage(${JSON.stringify(message)}, e.origin);
    }
    window.addEventListener("message", receive, false);
    window.opener.postMessage("authorizing:github", "*");
  })();
  </script><p>Signing you in…</p></body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": "cms_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
    }
  });
}
