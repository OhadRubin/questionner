# Deploying Your Israel Time MCP Server to Cloudflare Workers

A step-by-step guide to get your MCP server running and connected to Claude.ai.

---

## Prerequisites

Before starting, make sure you have:

- **Node.js** (v18 or later) — [Download here](https://nodejs.org/)
- **A Cloudflare account** (free tier works) — [Sign up here](https://dash.cloudflare.com/sign-up)

---

## Step 1: Set Up Your Local Environment

### 1.1 Unzip the project

```bash
unzip israel-time-mcp.zip
cd israel-time-mcp
```

### 1.2 Install dependencies

```bash
npm install
```

This will install:
- `@cloudflare/agents` — Cloudflare's MCP agent framework
- `wrangler` — Cloudflare's CLI tool for deploying Workers
- Other dependencies for the MCP server

---

## Step 2: Authenticate with Cloudflare

### 2.1 Log in to Cloudflare via Wrangler

Run:

```bash
npx wrangler login
```

This will:
1. Open your browser to Cloudflare's authorization page
2. Ask you to log in (if not already)
3. Request permission for Wrangler to manage your Workers

Click **"Allow"** to authorize.

You should see a success message in your terminal:

```
Successfully logged in.
```

### 2.2 Verify your login (optional)

```bash
npx wrangler whoami
```

This should display your Cloudflare account email and account ID.

---

## Step 3: Test Locally (Optional but Recommended)

Before deploying, you can test the server locally:

### 3.1 Start the local dev server

```bash
npm start
```

You should see output like:

```
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

### 3.2 Test with MCP Inspector

In a **new terminal window**, run:

```bash
npx @modelcontextprotocol/inspector@latest
```

This starts a web-based MCP client. Open the URL it provides (usually `http://localhost:5173`).

In the inspector:
1. Set **Transport Type** to `SSE`
2. Enter the URL: `http://localhost:8787/sse`
3. Click **Connect**
4. Click **List Tools** — you should see `get_israel_time` and `is_before_hour`
5. Try invoking `get_israel_time` to verify it works

Press `Ctrl+C` in the terminal running `npm start` when done testing.

---

## Step 4: Deploy to Cloudflare

### 4.1 Deploy your Worker

```bash
npm run deploy
```

Or equivalently:

```bash
npx wrangler deploy
```

**First-time deployment:** Wrangler may ask you to confirm creating a new Worker. Type `y` and press Enter.

You'll see output like:

```
Uploading israel-time-mcp...
Published israel-time-mcp (1.23 sec)
  https://israel-time-mcp.YOUR-SUBDOMAIN.workers.dev
```

**Save this URL!** You'll need it for the next step.

### 4.2 Verify deployment

Visit your Worker URL in a browser:

```
https://israel-time-mcp.YOUR-SUBDOMAIN.workers.dev
```

You should see:

```
Israel Time MCP Server. Connect via /sse or /mcp
```

You can also test with the MCP Inspector again, this time using your deployed URL:

```
https://israel-time-mcp.YOUR-SUBDOMAIN.workers.dev/sse
```

---

## Step 5: Connect to Claude.ai

Now let's add your MCP server to Claude.ai so I can use it.

### 5.1 Open Claude.ai Settings

1. Go to [claude.ai](https://claude.ai)
2. Click your profile icon (bottom-left)
3. Click **Settings**
4. Navigate to **Integrations** or **MCP Servers** (depending on UI version)

### 5.2 Add your MCP server

1. Click **Add Integration** or **Add MCP Server**
2. Enter a name: `Israel Time` (or whatever you prefer)
3. Enter the URL: `https://israel-time-mcp.YOUR-SUBDOMAIN.workers.dev/sse`
4. Click **Save** or **Connect**

### 5.3 Verify the connection

Start a new conversation with Claude and ask:

> "What time is it in Israel right now?"

If everything is working, Claude will call the `get_israel_time` tool and give you the actual current time.

---

## Step 6: Update Your Memory Instruction

Now that the MCP server is connected, you may want to update the accountability-coach rule to reference the tool:

> "Before triggering accountability-coach, use the `is_before_hour` tool with hour=18 to check if it's before 6pm Israel time. Only trigger if `is_before` is true."

---

## Troubleshooting

### "Error: You need to be logged in to deploy"

Run `npx wrangler login` again and make sure you complete the browser authorization.

### "Worker not found" or 404 errors

Make sure you're using the correct URL. Check your Cloudflare dashboard:
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Click **Workers & Pages**
3. Find `israel-time-mcp` and click it
4. Copy the URL from the "Preview" section

### "Connection refused" when testing locally

Make sure the local server is running (`npm start`) and you're using `http://localhost:8787/sse` (not https).

### Tools not showing up in Claude.ai

1. Make sure you added the `/sse` endpoint (not just the base URL)
2. Try disconnecting and reconnecting the integration
3. Start a new conversation (MCP connections are established per-conversation)

### Deployment fails with TypeScript errors

Try running:

```bash
npm install
npx wrangler deploy
```

If errors persist, check that your Node.js version is 18+:

```bash
node --version
```

---

## Updating Your Server

When you make changes to the code:

1. Edit files in `src/index.ts`
2. Test locally: `npm start`
3. Deploy: `npm run deploy`

Changes go live immediately after deployment.

---

## Cost

Cloudflare Workers free tier includes:
- **100,000 requests/day**
- **10ms CPU time per request**

For a simple time server, you'll never hit these limits. No credit card required.

---

## Next Steps

- **Add more tools**: Edit `src/index.ts` to add tools for other checks
- **Add authentication**: If you want to restrict who can use your server, follow [Cloudflare's OAuth guide](https://developers.cloudflare.com/agents/guides/remote-mcp-server/#add-authentication)
- **Monitor usage**: Check your Worker's analytics in the Cloudflare dashboard

---

## Quick Reference

| Action | Command |
|--------|---------|
| Install dependencies | `npm install` |
| Run locally | `npm start` |
| Deploy | `npm run deploy` |
| Check Cloudflare login | `npx wrangler whoami` |
| View logs | `npx wrangler tail` |

| Endpoint | URL |
|----------|-----|
| SSE (for Claude.ai) | `https://israel-time-mcp.YOUR-SUBDOMAIN.workers.dev/sse` |
| Streamable HTTP | `https://israel-time-mcp.YOUR-SUBDOMAIN.workers.dev/mcp` |
