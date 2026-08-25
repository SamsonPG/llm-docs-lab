---
id: openrouter-limits
url: https://openrouter.ai/docs/api-reference/limits
fetched_at: 2026-08-24T20:45:26.669Z
---

## Documentation Index

Fetch the complete documentation index at: /docs/llms.txt
Use this file to discover all available pages before exploring further.

# Limits

Credit Limits and Rate Limits
Limits > Limit type: Credit limits | What it governs: How much you can spend (account balance and per-key credit caps) | Where to check: GET /api/v1/key → limit_remaining
Limits > Limit type: Rate limits | What it governs: How many requests you can make (free-model request caps and DDoS protection) | Where to check: X-RateLimit-* headers on the error response

## Checking your limits

## Credit limits

- Account balance , your available credits across the account. If your account has a negative credit balance, you may see errors, including for free models. Adding credits to put your balance above zero allows you to use those models again.
- Per-key credit limits , an optional spending cap configured on an individual API key. The limit , limit_reset , and limit_remaining fields in the GET /api/v1/key response above describe this cap and how much of it remains.

### Handling 402 errors

- Add credits to bring your account balance above zero.
- Check per-key limits. If limit_remaining on the key is exhausted, raise the key’s credit limit or wait for it to reset (see limit_reset ).
- Monitor proactively. Call GET /api/v1/key as shown above to track limit_remaining and usage before requests start failing.

## Rate limits

- Free usage limits : If you’re using a free model variant (with an ID ending in ), the following limits apply:
Limits > Rate limits > Credits purchased (all time): Less than
Limits > Rate limits > Credits purchased (all time): At least

- DDoS protection : Cloudflare’s DDoS protection will block requests that dramatically exceed reasonable usage.

### Handling 429 errors

- OpenRouter , when you hit one of the platform limits above (free-model requests per minute or per day, or DDoS protection).
- The upstream provider , when the provider serving your request is rate limiting or at capacity. In this case error.metadata.provider_code carries the provider’s original error code when available, and fallback routing retries other providers for the same model automatically before the error reaches you. You can also specify fallback models to try a different model when all providers for the first are exhausted.
- Retry with exponential backoff. Rate limits are transient; wait and retry rather than immediately re-sending. Honor the Retry-After header when present.
- On free variants , purchase at least credits to raise your daily limit, or switch to the paid variant of the model, which has no platform-level request cap.
- For provider-side limits , add fallback models or relax provider routing preferences so more providers are eligible to serve the request.

#### Mid-stream rate limits
