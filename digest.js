// AI News Daily Digest -> WhatsApp
// Fetches recent AI news from multiple RSS sources, asks Claude to pick the
// top 10 and summarize them, then sends the digest to your own WhatsApp via
// Twilio's WhatsApp Sandbox.

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

// --- 3. Send via WhatsApp (Twilio Sandbox) ------------------------------
// Uses Twilio's REST API directly via fetch — no SDK dependency needed.
async function sendWhatsApp(text) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886" (the sandbox number)
  const to = process.env.WHATSAPP_TO;            // e.g. "whatsapp:+9198XXXXXXXX"

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  // Twilio caps a single message body at 1600 characters. If Claude's
  // digest runs longer, split it into chunks on line boundaries so no
  // section gets cut mid-sentence.
  const chunks = splitIntoChunks(text, 1550);

  for (const [idx, chunk] of chunks.entries()) {
    const body = new URLSearchParams({ From: from, To: to, Body: chunk });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const data = await res.json();
    if (!res.ok) {
      console.error(`Twilio error on chunk ${idx + 1}/${chunks.length}:`, data);
      throw new Error(data.message || "Twilio send failed");
    }
    console.log(`Sent chunk ${idx + 1}/${chunks.length}, sid: ${data.sid}`);
  }
}

function splitIntoChunks(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const lines = text.split("\n");
  const chunks = [];
  let current = "";
  for (const line of lines) {
    if ((current + "\n" + line).length > maxLen) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
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
