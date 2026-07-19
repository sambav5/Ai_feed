# Dental Implant Workflow — Monthly Research Agent

Tracks real-world dental implant workflow pain points (consultation through
follow-up) as they come up in public online discussions, once a month.
Sends you a short WhatsApp summary and keeps a running spreadsheet of every
discussion it's found, with structured details per row.

## What this does NOT do (read this first)

- **Doesn't reach Dentaltown or YouTube comments.** Both are effectively
  invisible to web search (login-walled / not indexed), so they're excluded
  from the brief rather than silently failing. If Dentaltown coverage
  matters to you, that likely needs a manual account + periodic reading, or
  a separate tool built specifically against Dentaltown (no public API).
- **LinkedIn and general forums are best-effort.** Only public, indexed
  posts surface — private group discussions won't.
- **Doesn't invent numbers.** Severity scores, frequency, and impact fields
  are filled only when the source discussion actually supports them — the
  model is instructed to write "Not stated" rather than guess. Expect a lot
  of "Not stated" cells, especially early on; that's accuracy, not a bug.
- **Doesn't re-rank a "Top 25" every month.** Each run reports what's *new*
  since the last run and appends it to the spreadsheet. Ranking the full
  historical set is a separate, heavier task — ask if you want that added
  as a periodic (e.g. quarterly) pass later.

## How it works
1. Once a month, Claude (with live web search, up to 25 searches per run)
   looks for new discussions on Reddit, Quora, Dental Economics,
   DentistryIQ, public LinkedIn, manufacturer forums, general dental
   forums, and relevant scientific publications.
2. It's told which URLs were already captured in past runs, so it focuses
   on genuinely new material.
3. New findings get appended as rows to `data/dental-implant-findings.xlsx`
   (title, source, url, author role, implant system, theme, pain point,
   severity, quote, confidence, etc.)
4. A short WhatsApp message summarizes what's new this run and links to
   the spreadsheet in the repo.
5. The workflow commits the updated spreadsheet and URL-tracking file back
   to the repo, so the next run knows what's already been covered.

## One-time setup

### 1. You already have Twilio Sandbox + Anthropic key from the other bot
Same four values, reused here:
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `WHATSAPP_TO`
- `ANTHROPIC_API_KEY`

### 2. Push this project to its own GitHub repo
```bash
cd dental-implant-research-agent
git init
git add .
git commit -m "Dental implant research agent"
gh repo create dental-implant-research-agent --private --source=. --push
```

### 3. Add repo secrets
Settings → Secrets and variables → Actions → New repository secret. Add
the same five as your other bot: `ANTHROPIC_API_KEY`, `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `WHATSAPP_TO`.

### 4. Confirm Actions has write permission
Settings → Actions → General → Workflow permissions → make sure
"Read and write permissions" is selected. The workflow needs this to
commit the spreadsheet back after each run (the `permissions: contents:
write` line in the workflow file requests it, but the repo setting must
also allow it).

### 5. Test it
Actions tab → "Monthly Dental Implant Research" → Run workflow. This first
run has no prior history, so expect a bigger batch of findings and a longer
run time (multiple searches + a larger write). Check your WhatsApp, then
check the repo for the updated `data/dental-implant-findings.xlsx`.

## Notes on cost
Each run uses Claude Sonnet with up to 25 web searches plus a longer
output (structured JSON for every finding) — expect this to cost more per
run than the daily news-digest bot (that one uses Haiku with no search
tool). Still low — a few cents to low dollars per monthly run depending on
how much it finds — but worth knowing it's a different cost profile.

## Local test
```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
export TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export TWILIO_AUTH_TOKEN=your_auth_token
export TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
export WHATSAPP_TO=whatsapp:+9198XXXXXXXX
npm start
```
