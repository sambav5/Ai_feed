// AI News Daily Digest -> WhatsApp
// Fetches recent AI news from multiple RSS sources, asks Claude to pick the
// top 10 and summarize them, then sends the digest to your own WhatsApp via CallMeBot.

import Parser from "rss-parser";
import Anthropic from "@anthropic-ai/sdk";

// Reddit (and some other feeds) reject requests without a browser-like User-Agent.
const parser = new Parser({
  headers: { "User-Agent": "Mozilla/5.0 (compatible; ai-digest-bot/1.0)" },
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// --- 1. Sources -------------------------------------------------------
// Add/remove feeds freely. These are all free, public RSS endpoints.
// Each feed is tagged with a `category` so the digest can group results
// (Research / Industry / Community) instead of one flat list.
const FEEDS = [
  // Industry / journalism
  { url: "https://techcrunch.com/tag/artificial-intelligence/feed/", category: "industry" },
  { url: "https://venturebeat.com/category/ai/feed/", category: "industry" },
  { url: "https://www.technologyreview.com/feed/", category: "industry" },
  { url: "https://feeds.arstechnica.com/arstechnica/index", category: "industry" },
  { url: "https://news.google.com/rss/search?q=artificial+intelligence+when:1d&hl=en-US&gl=US&ceid=US:en", category: "industry" },

  // Research (papers)
  { url: "http://export.arxiv.org/rss/cs.AI", category: "research" },
  { url: "http://export.arxiv.org/rss/cs.LG", category: "research" },

  // Community discussion / buzz
  { url: "https://hnrss.org/newest?q=AI", category: "community" },              // Hacker News, query-filtered
  { url: "https://www.reddit.com/r/MachineLearning/.rss", category: "community" },
  { url: "https://www.reddit.com/r/artificial/.rss", category: "community" },
  { url: "https://www.reddit.com/r/LocalLLaMA/.rss", category: "community" },
];

async function fetchAllFeeds() {
  const items = [];
  for (const { url, category } of FEEDS) {
    try {
      const feed = await parser.parseURL(url);
      for (const entry of feed.items.slice(0, 15)) {
        items.push({
          title: entry.title,
          link: entry.link,
          source: feed.title,
          category,
          pubDate: entry.pubDate,
        });
      }
    } catch (err) {
      console.error(`Failed to fetch ${url}:`, err.message);
    }
  }
  return items;
}

// --- 2. Rank + summarize with Claude -----------------------------------
async function pickTop10(items) {
  const listText = items
    .map((i, idx) => `${idx + 1}. [${i.category}] [${i.source}] ${i.title} (${i.link})`)
    .join("\n");

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: `Here is a list of recent AI-related items from multiple sources, each tagged with a category (industry, research, or community):

${listText}

Pick up to 10 of the most significant, genuinely newsworthy items overall (skip duplicates and low-substance posts), then group your selection under three headers in this exact order, omitting any header with zero items:

🏢 INDUSTRY & PRODUCT
🔬 RESEARCH
💬 COMMUNITY BUZZ

Under each header, list items as "- <one punchy line, max 20 words> (<link>)". Keep the whole thing plain text (no markdown formatting like ** or #), WhatsApp-friendly. Start the whole message with today's date as a title line, and keep total items across all sections to 10.`,
      },
    ],
  });

  return msg.content.map((b) => b.text || "").join("\n");
}

// --- 3. Send via WhatsApp (CallMeBot) -----------------------------------
async function sendWhatsApp(text) {
  const phone = process.env.WHATSAPP_PHONE;   // your number, with country code, no + or spaces
  const apikey = process.env.CALLMEBOT_APIKEY; // get this once via CallMeBot's WhatsApp opt-in
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(
    text
  )}&apikey=${apikey}`;

  const res = await fetch(url);
  const body = await res.text();
  console.log("CallMeBot response:", body);
}

// --- Run ----------------------------------------------------------------
(async () => {
  console.log("Fetching feeds...");
  const items = await fetchAllFeeds();
  console.log(`Fetched ${items.length} items. Asking Claude to pick top 10...`);
  const digest = await pickTop10(items);
  console.log("Digest:\n", digest);
  await sendWhatsApp(digest);
})();
