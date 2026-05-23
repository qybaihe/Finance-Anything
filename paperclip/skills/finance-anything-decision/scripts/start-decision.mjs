#!/usr/bin/env node

function readFlag(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : "";
}

async function readStdinIfAvailable() {
  if (process.stdin.isTTY) return "";
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input.trim();
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "").replace(/\/api$/, "");
}

const args = process.argv.slice(2);
const goalFlag = readFlag(args, "--goal");
const context = readFlag(args, "--context") ?? "";
const positional = args.filter((arg, index) => {
  const previous = args[index - 1];
  return !arg.startsWith("--") && previous !== "--goal" && previous !== "--context";
});

const stdinGoal = await readStdinIfAvailable();
const flagOrPositionalGoal = goalFlag ?? positional.join(" ");
const goal = (flagOrPositionalGoal || stdinGoal).trim();

if (!goal) {
  console.error("Missing decision goal. Use --goal \"...\" or pipe text on stdin.");
  process.exit(2);
}

const apiUrl = normalizeBaseUrl(
  process.env.FINANCE_ANYTHING_API_URL ||
  process.env.PAPERCLIP_API_URL ||
  "http://127.0.0.1:3300",
);
const apiKey = process.env.FINANCE_ANYTHING_API_KEY || process.env.PAPERCLIP_API_KEY || "";

if (!apiKey) {
  console.error("Missing PAPERCLIP_API_KEY or FINANCE_ANYTHING_API_KEY.");
  process.exit(2);
}

const headers = {
  "content-type": "application/json",
  authorization: apiKey.toLowerCase().startsWith("bearer ") ? apiKey : `Bearer ${apiKey}`,
};
if (process.env.PAPERCLIP_RUN_ID) {
  headers["x-paperclip-run-id"] = process.env.PAPERCLIP_RUN_ID;
}

const response = await fetch(`${apiUrl}/api/finance/decisions`, {
  method: "POST",
  headers,
  body: JSON.stringify({ goal, context }),
});

const bodyText = await response.text();
let body;
try {
  body = bodyText ? JSON.parse(bodyText) : null;
} catch {
  body = bodyText;
}

if (!response.ok) {
  console.error(JSON.stringify({ status: response.status, body }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(body, null, 2));
