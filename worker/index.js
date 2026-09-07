// Cloudflare Workers girişi: /api/* CMS oturum uçları, kalan her şey statik site.
import { onRequest as auth } from "../functions/api/auth.js";
import { onRequest as callback } from "../functions/api/callback.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/auth") return auth({ request, env });
    if (pathname === "/api/callback") return callback({ request, env });
    return env.ASSETS.fetch(request);
  }
};
