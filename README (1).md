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
3. Sends the resulting digest to your own WhatsApp using CallMeBot's free
   personal-use API.
4. A GitHub Actions cron job runs this automatically every morning — no
   server, no hosting bill.

## One-time setup (15 minutes)

### 1. Get a CallMeBot API key (sends WhatsApp to yourself, free)
1. Save this contact on your phone: **+34 644 59 71 67** (CallMeBot's number).
2. WhatsApp it exactly: `I allow callmebot to send me messages`
3. You'll get a reply with your personal API key. Keep it.

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
Add these three:
- `ANTHROPIC_API_KEY` — from step 2
- `WHATSAPP_PHONE` — your number with country code, digits only (e.g. `9198XXXXXXXX`)
- `CALLMEBOT_APIKEY` — from step 1

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
export WHATSAPP_PHONE=9198XXXXXXXX
export CALLMEBOT_APIKEY=123456
npm start
```
