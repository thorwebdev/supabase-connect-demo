import "https://deno.land/std@0.194.0/dotenv/load.ts";
import { Application, Router } from "https://deno.land/x/oak@v11.1.0/mod.ts";
import {
  Session,
  CookieStore,
} from "https://deno.land/x/oak_sessions@v4.1.9/mod.ts";
import { OAuth2Client } from "https://deno.land/x/oauth2_client@v1.0.2/mod.ts";

const oauth2Client = new OAuth2Client({
  clientId: Deno.env.get("SUPA_CONNECT_CLIENT_ID")!,
  clientSecret: Deno.env.get("SUPA_CONNECT_CLIENT_SECRET")!,
  authorizationEndpointUri: "https://api.supabase.com/v1/oauth/authorize",
  tokenUri: "https://api.supabase.com/v1/oauth/token",
  redirectUri: "https://supabase-connect-demo.deno.dev/oauth2/callback",
  defaults: {
    scope: "all",
  },
});

type AppState = {
  session: Session;
};

const router = new Router<AppState>();
// Note: path should be prefixed with function name
router.get("/", (ctx) => {
  ctx.cookies.set("thors_little_hacker_test", "test", {
    domain: "supabase-connect-demo-k7aajmne3eq0.deno.dev",
  });
  ctx.response.body =
    "This is an example of implementing https://supabase.com/docs/guides/integrations/oauth-apps/authorize-an-oauth-app . Navigate to /login to start the OAuth flow.";
});
router.get("/login", async (ctx) => {
  // Construct the URL for the authorization redirect and get a PKCE codeVerifier
  const { uri, codeVerifier } = await oauth2Client.code.getAuthorizationUri();
  console.log({ uri, codeVerifier });

  // Store both the state and codeVerifier in the user session
  ctx.state.session.flash("codeVerifier", codeVerifier);

  // Redirect the user to the authorization endpoint
  ctx.response.redirect(uri);
});
router.get("/oauth2/callback", async (ctx) => {
  // Make sure the codeVerifier is present for the user's session
  const codeVerifier = ctx.state.session.get("codeVerifier") as string;
  console.log("codeVerifier", codeVerifier);

  // Exchange the authorization code for an access token
  const tokens = await oauth2Client.code.getToken(ctx.request.url, {
    codeVerifier,
  });
  console.log("tokens", tokens);
  // Make sure to store the tokens in your DB

  // Use the access token to make an authenticated API request
  const projects = await fetch("https://api.supabase.com/v1/projects", {
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
    },
  }).then((res) => res.json());

  ctx.response.body = `Hello, these are your projects ${JSON.stringify(
    projects
  )}!`;
});

const app = new Application<AppState>();
// cookie name for the store is configurable, default is: {sessionDataCookieName: 'session_data'}
const store = new CookieStore("very-secret-key");
// @ts-ignore TODO: open issue at https://github.com/jcs224/oak_sessions
app.use(Session.initMiddleware(store));
app.use(router.routes());
app.use(router.allowedMethods());
console.log("Listening on http://localhost:8000");
await app.listen({ port: 8000 });
