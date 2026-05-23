---
name: finance-anything-decision
description: >
  Start a Finance Anything multi-agent decision workflow from a short natural
  language goal. Use when an agent, OpenCode runtime, or user asks for help
  deciding whether to buy, invest in, compare, or choose something and wants the
  Finance Anything agent team to produce the final decision report.
---

# Finance Anything Decision

Use this skill to hand a purchase, investment, product, second-hand value, or
general choice question to Finance Anything. Do not replace the Finance Anything
workflow with your own analysis; create the decision issue and return the issue
link so the specialist agents can collaborate.

## Requirements

The calling agent needs a Paperclip API identity:

- `PAPERCLIP_API_URL` or `FINANCE_ANYTHING_API_URL`
- `PAPERCLIP_API_KEY` or `FINANCE_ANYTHING_API_KEY`
- Optional: `PAPERCLIP_RUN_ID` for audit trail

In normal Paperclip/OpenCode agent runs these values are injected automatically.

## Start A Decision

From this skill directory, run:

```bash
node scripts/start-decision.mjs --goal "我现在需要购买一台二手 MacBook，请帮我判断是否值得入手"
```

With extra context:

```bash
node scripts/start-decision.mjs \
  --goal "我是否应该买入这只股票" \
  --context "预算 5 万元，持有周期 6-12 个月，不能接受大幅回撤"
```

The script calls:

```text
POST /api/finance/decisions
```

The response includes `issuePath`, `issue.identifier`, `projectId`, `goalId`,
and the assigned decision orchestrator. Reply with the created issue link and a
brief note that Finance Anything has started the multi-agent decision workflow.

## Direct API Shape

```json
{
  "goal": "我现在需要购买一台二手 MacBook，请帮我判断是否值得入手",
  "context": "预算 6000 元，偏好轻便，担心电池和保值率"
}
```

Use `goal` for the user's exact decision target. Use `context` only for
constraints, budget, timing, risk preference, product links, or known facts.
