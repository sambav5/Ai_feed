# AI News Daily Digest → WhatsApp

Sends yourself the top 10 AI news items every day via WhatsApp. Total cost: **₹0/month**
(a Claude Haiku call every day is a few cents at most; everything else is free).

## How it works
1. Pulls recent items from free RSS feeds across three categories:
   - **Industry & product** — TechCrunch, VentureBeat, MIT Tech Review, Ars Technica, Google News
   - **Research** — arXiv cs.AI and cs.LG new-submission feeds
   - **Community buzz** — Hacker News, r/MachineLearning, r/artificial, r/LocalLLaMA
2. Sends the combined list to Claude (Haiku), which picks up to 10 of the
   most significant items overall and groups them under 🏢 Industry,
   🔬 Research, and 💬 Community headers (any empty section is skipped).
3. Sends the resulting digest to your own WhatsApp using Twilio's WhatsApp
   Sandbox (splitting into multiple messages automatically if it exceeds
   Twilio's 1600-character limit per message).
4. A GitHub Actions cron job runs this automatically every morning — no
   server, no hosting bill.

## One-time setup (10 minutes)

### 1. Twilio WhatsApp Sandbox (you said this is already set up)
Just confirm you have these four values from your Twilio Console:
- **Account SID** and **Auth Token** — from the Console dashboard (https://console.twilio.com/)
- **Sandbox WhatsApp number** — shown on the WhatsApp Sandbox page, e.g. `whatsapp:+14155238886`
- Your own phone joined to the sandbox (you should have already WhatsApp'd
  the `join <your-sandbox-keyword>` code to that number)

⚠️ Sandbox note: if your phone hasn't messaged the sandbox number in the
last 72 hours, WhatsApp requires you to re-send the `join <code>` message
before it'll deliver anything — otherwise messages silently fail. If the
daily message ever stops arriving, that's the first thing to check.

### 2. Get an Anthropic API key
Create one at https://console.anthropic.com/ (Settings → API Keys).

### 3. Push this project to a GitHub repo
```bash
cd ai-digest-bot
git init
git add .
git commit -m "AI digest bot"
gh repo create ai-digest-bot --private --source=. --push
```

### 4. Add repo secrets
In your GitHub repo: Settings → Secrets and variables → Actions → New repository secret.
Add these five:
- `ANTHROPIC_API_KEY` — from step 2
- `TWILIO_ACCOUNT_SID` — from your Twilio Console
- `TWILIO_AUTH_TOKEN` — from your Twilio Console
- `TWILIO_WHATSAPP_FROM` — the sandbox number, formatted as `whatsapp:+14155238886`
- `WHATSAPP_TO` — your number, formatted as `whatsapp:+9198XXXXXXXX`

### 5. Test it
Go to the Actions tab → "Daily AI Digest" → "Run workflow" (this uses the
`workflow_dispatch` trigger). Check your WhatsApp within a minute.

Once that works, it runs automatically every day at the time set in the
cron schedule inside `.github/workflows/daily-digest.yml` (default: 07:30 IST).

## Customizing
- **Change sources**: edit the `FEEDS` array in `digest.js`. Each entry has a
  `url` and a `category` (`industry`, `research`, or `community`) — add any
  RSS feed, tag it with whichever category fits, and it'll be grouped
  automatically. Other useful feeds: `http://export.arxiv.org/rss/cs.CL`
  (NLP papers), specific company blogs, other subreddits (`https://www.reddit.com/r/<sub>/.rss`).
- **Change grouping/tone/format**: edit the prompt in `pickTop10()` — e.g.
  change the three categories to your own, adjust item count, change emoji.
- **Change delivery time**: edit the cron expression (times are in UTC).

Note: Reddit occasionally rate-limits or blocks requests without warning
notice (uncommon, but if a run silently skips Reddit items, that's why —
the script logs a fetch error for that feed and continues with the rest).

## Local test (before pushing to GitHub)
```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
export TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export TWILIO_AUTH_TOKEN=your_auth_token
export TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
export WHATSAPP_TO=whatsapp:+9198XXXXXXXX
npm start
```
