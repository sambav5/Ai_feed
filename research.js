// Dental Implant Workflow — Monthly Market Research Agent
//
// Each month this:
//  1. Asks Claude (with web search) to find NEW discussions about implant
//     workflow pain points since the last run
//  2. Dedupes against everything already captured (data/seen-urls.json)
//  3. Appends the new, structured findings to a running spreadsheet
//     (data/dental-implant-findings.xlsx)
//  4. Sends a short WhatsApp summary of what's new this month
//
// IMPORTANT SCOPE NOTE: Dentaltown and YouTube comments are excluded from
// the search brief below because they aren't reachable via web search
// (login-walled / not indexed). LinkedIn and general forums are included
// as best-effort and will surface only public, indexed content.

import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import XLSX from "xlsx";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SEEN_PATH = path.join("data", "seen-urls.json");
const SHEET_PATH = path.join("data", "dental-implant-findings.xlsx");

const COLUMNS = [
  "date_found",
  "title",
  "source",
  "url",
  "publication_date",
  "author_role",
  "country",
  "practice_type",
  "implant_system",
  "software_mentioned",
  "theme",
  "primary_pain_point",
  "secondary_pain_points",
  "severity_1_10",
  "frequency",
  "representative_quote",
  "confidence_level",
  "short_summary",
];

// --- Load state from previous runs --------------------------------------
function loadSeenUrls() {
  if (!fs.existsSync(SEEN_PATH)) return [];
  return JSON.parse(fs.readFileSync(SEEN_PATH, "utf-8"));
}

function loadExistingRows() {
  if (!fs.existsSync(SHEET_PATH)) return [];
  const wb = XLSX.readFile(SHEET_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

// --- Build the research prompt ------------------------------------------
function buildPrompt(seenUrls) {
  // Cap how many prior URLs we quote back to the model — a few hundred is
  // plenty to steer it away from obvious repeats without bloating the prompt.
  const recentSeen = seenUrls.slice(-300);

  return `You are a market research analyst studying real-world dental implant
workflow problems (patient consultation through final delivery and follow-up).
Do NOT propose products, solutions, or validate any startup idea — only
collect and describe evidence.

Search for discussions from the last ~30 days on: Reddit, Quora, Dental
Economics, DentistryIQ, public LinkedIn posts, manufacturer community
forums, general dental forums, and scientific publications (for workflow
trends only). Focus on posts where dental professionals (general dentists,
implantologists, prosthodontists, oral surgeons, periodontists, dental
technicians, lab owners, clinic managers, dental assistants, CAD/CAM
designers) describe workflow problems, delays, remakes, communication
breakdowns, inventory/component issues, scheduling issues, or software
frustrations (exocad, 3Shape, Medit, DTX Studio, coDiagnostiX, BlueSkyPlan).

Do NOT repeat any of these already-captured URLs:
${recentSeen.length ? recentSeen.join("\n") : "(none yet — this is the first run)"}

For each genuinely new discussion you find, extract:
- title, source, url, publication_date, author_role, country, practice_type
- implant_system (if mentioned), software_mentioned (if mentioned)
- theme (one of: treatment planning, digital impressions, surgical guides,
  lab communication, implant ordering, inventory shortages, missing
  components, implant system compatibility, abutment selection, crown
  remakes, delivery delays, case tracking, patient communication, CAD/CAM
  workflow, outsourcing, quality control)
- primary_pain_point, secondary_pain_points
- severity_1_10 (your best-evidence estimate; if you can't reasonably judge
  it, write "Not stated" — never guess a number without basis)
- frequency (e.g. "one-off complaint" vs "recurring theme across multiple
  posts" — describe in words, don't invent a stat)
- representative_quote (paraphrase, not verbatim — keep under 20 words)
- confidence_level (high / medium / low, based on how clear and specific
  the source post was)
- short_summary (1-2 sentences)

CRITICAL: if a field isn't stated or reasonably inferable from the source,
write exactly "Not stated". Never fabricate a plausible-sounding number,
country, or role just to fill a field.

Respond in exactly this format:

===SUMMARY===
(3-6 sentences: how many new discussions found, the 2-3 most notable new
pain points or shifts this month, plain text, no markdown symbols)

===DATA_JSON===
(a JSON array of objects, one per discussion, using exactly these keys:
${COLUMNS.filter((c) => c !== "date_found").join(", ")}
— valid JSON only, no markdown code fences, no trailing commas)`;
}

// --- Call Claude with web search ----------------------------------------
async function runResearch(seenUrls) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8000,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 25 }],
    messages: [{ role: "user", content: buildPrompt(seenUrls) }],
  });

  const fullText = msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const summaryMatch = fullText.match(/===SUMMARY===([\s\S]*?)===DATA_JSON===/);
  const jsonMatch = fullText.match(/===DATA_JSON===([\s\S]*)/);

  const summary = summaryMatch ? summaryMatch[1].trim() : "(no summary section returned)";
  let items = [];
  if (jsonMatch) {
    try {
      items = JSON.parse(jsonMatch[1].trim());
    } catch (err) {
      console.error("Failed to parse DATA_JSON block:", err.message);
      console.error("Raw block was:\n", jsonMatch[1].slice(0, 2000));
    }
  }

  return { summary, items };
}

// --- Append new rows to the spreadsheet ----------------------------------
function appendToSheet(existingRows, newItems) {
  const today = new Date().toISOString().slice(0, 10);
  const newRows = newItems.map((item) => ({
    date_found: today,
    ...COLUMNS.slice(1).reduce((acc, col) => {
      acc[col] = item[col] ?? "Not stated";
      return acc;
    }, {}),
  }));

  const allRows = [...existingRows, ...newRows];
  const sheet = XLSX.utils.json_to_sheet(allRows, { header: COLUMNS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Findings");
  fs.mkdirSync(path.dirname(SHEET_PATH), { recursive: true });
  XLSX.writeFile(wb, SHEET_PATH);

  return newRows.length;
}

// --- Send WhatsApp summary (Twilio) --------------------------------------
async function sendWhatsApp(text) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const to = process.env.WHATSAPP_TO;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams({ From: from, To: to, Body: text });

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Twilio error:", data);
    throw new Error(data.message || "Twilio send failed");
  }
  console.log("Sent WhatsApp summary, sid:", data.sid);
}

// --- Run ------------------------------------------------------------------
(async () => {
  console.log("Loading prior state...");
  const seenUrls = loadSeenUrls();
  const existingRows = loadExistingRows();
  console.log(`Previously captured: ${seenUrls.length} URLs, ${existingRows.length} rows.`);

  console.log("Running research (this may take a few minutes)...");
  const { summary, items } = await runResearch(seenUrls);

  const freshItems = items.filter((i) => i.url && !seenUrls.includes(i.url));
  console.log(`Model returned ${items.length} items, ${freshItems.length} genuinely new after dedupe.`);

  const addedCount = appendToSheet(existingRows, freshItems);

  const updatedSeen = [...seenUrls, ...freshItems.map((i) => i.url)];
  fs.mkdirSync(path.dirname(SEEN_PATH), { recursive: true });
  fs.writeFileSync(SEEN_PATH, JSON.stringify(updatedSeen, null, 2));

  const repo = process.env.GITHUB_REPOSITORY; // auto-set by GitHub Actions, e.g. "you/dental-implant-research-agent"
  const repoUrl = repo ? `https://github.com/${repo}/blob/main/data/dental-implant-findings.xlsx` : "";
  const whatsappText = `Dental Implant Research — Monthly Update

${summary}

${addedCount} new discussions logged this run (${existingRows.length + addedCount} total in the spreadsheet so far).${repoUrl ? `\n\nFull spreadsheet: ${repoUrl}` : ""}`;

  console.log("Summary to send:\n", whatsappText);
  await sendWhatsApp(whatsappText);
})();
