---
id: gemini-rate-limits
url: https://ai.google.dev/gemini-api/docs/rate-limits
fetched_at: 2026-08-24T20:45:26.669Z
---

- English
- Deutsch
- Español – América Latina
- Français
- Indonesia
- Italiano
- Polski
- Português – Brasil
- Shqip
- Tiếng Việt
- Türkçe
- Русский
- עברית
- العربيّة
- فارسی
- हिंदी
- বাংলা
- ภาษาไทย
- 中文 – 简体
- 中文 – 繁體
- 日本語
- 한국어
- Home
- Gemini API
- Docs

# Rate limits

Rate limits regulate the number of requests you can make to the Gemini API within a given timeframe. These limits help maintain fair usage, protect against abuse, and help maintain system performance for all users.
View your active rate limits in AI Studio

## How rate limits work

Rate limits are usually measured across three dimensions:
- Requests per minute ( RPM )
- Tokens per minute (input) ( TPM )
- Requests per day ( RPD )
Your usage is evaluated against each limit, and exceeding any of them will trigger a rate limit error. For example, if your RPM limit is 20, making 21 requests within a minute will result in an error, even if you haven't exceeded your TPM or other limits.
Rate limits are applied per project, not per API key. Requests per day ( RPD ) quotas reset at midnight Pacific time.
Limits vary depending on the specific model being used, and some limits only apply to specific models. For example, Images per minute, or IPM, is only calculated for models capable of generating images (Nano Banana), but is conceptually similar to TPM. Other models might have a token per day limit (TPD).
Rate limits are more restricted for experimental and preview models.

### Spend-based rate limits

In addition to requests per minute (RPM) and tokens per minute (TPM) limits, the Gemini API enforces spend-based rate limits to protect against unexpected charges. Whether these limits apply to your account depends on your billing history and usage tier .
The following table shows the spend-based rate limits for each usage tier . These limits are evaluated on a rolling 10-minute window. Whether these limits apply to your account depends on your billing history and account standing.
Rate limits > How rate limits work > Spend-based rate limits > Usage tier: Free | Spend rate limit (per 10 minutes): N/A
Rate limits > How rate limits work > Spend-based rate limits > Usage tier: Tier 1 | Spend rate limit (per 10 minutes): $10
Rate limits > How rate limits work > Spend-based rate limits > Usage tier: Tier 2 | Spend rate limit (per 10 minutes): $50
Rate limits > How rate limits work > Spend-based rate limits > Usage tier: Tier 3 | Spend rate limit (per 10 minutes): $200

If you hit a spend-based rate limit, the API returns a 429 RESOURCE_EXHAUSTED error. To resolve this:
- Wait and retry after a short period.
- Reduce the rate of expensive requests , for example by using smaller context windows or shorter outputs.
- If you consistently hit this limit during normal usage, request a rate limit increase .

## Usage tiers

Rate limits are tied to the project's usage tier. As your API usage and spending increase, you'll be automatically upgraded to a higher tier with increased rate limits.
The qualifications for Tiers 2 and 3 are based on the total cumulative spending on Google Cloud services (including, but not limited to, the Gemini API) for the billing account linked to your project.
Rate limits > Usage tiers > Usage tier: Free | Qualification: Active project or free trial | Billing tier cap: N/A
Rate limits > Usage tiers > Usage tier: Tier 1 | Qualification: Set up and link an active billing account | Billing tier cap: $250
Rate limits > Usage tiers > Usage tier: Tier 2 | Qualification: Paid $100 + 3 days from first successful payment | Billing tier cap: $2,000
Rate limits > Usage tiers > Usage tier: Tier 3 | Qualification: Paid $1,000 + 30 days from first successful payment | Billing tier cap: $20,000 - $100,000+

While meeting the stated qualification criteria is generally sufficient for approval, in rare cases an upgrade request may be denied based on other factors identified during the review process.
This system helps maintain the security and integrity of the Gemini API platform for all users.

## Gemini API rate limits

Rate limits depend on a variety of factors (such as your usage tier) and can be viewed in Google AI Studio. As your tier and account status change over time, your rate limits will automatically update.
View your active rate limits in AI Studio
Specified rate limits are not guaranteed and actual capacity may vary.

## Priority inference rate limits

Priority consumption holds its own rate limits even though consumption is counted towards overall interactive traffic rate limits. Default rate limits are: 0.3x the standard rate limit for each model and tier

## Batch API rate limits

Batch API requests are subject to their own rate limits, separate from the non-batch API calls.
- Concurrent batch requests: 100
- Input file size limit: 2GB
- File storage limit: 20GB
- Enqueued tokens per model: The Batch enqueued tokens table lists the maximum number of tokens that can be enqueued for batch processing across all your active batch jobs for a given model.

### Tier 1

Rate limits > Batch API rate limits > Tier 1 > Model: Text-out models
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 3.1 Pro Preview | Batch enqueued tokens: 5,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 3.5 Flash-Lite | Batch enqueued tokens: 10,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 3.7 Flash | Batch enqueued tokens: 3,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 3.1 Flash Lite | Batch enqueued tokens: 10,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 3.1 Flash Lite Preview | Batch enqueued tokens: 10,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 3.6 Flash | Batch enqueued tokens: 3,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 3.5 Flash | Batch enqueued tokens: 3,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 2.5 Pro | Batch enqueued tokens: 5,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 2.5 Pro TTS | Batch enqueued tokens: 25,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 2.5 Flash | Batch enqueued tokens: 3,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 2.5 Flash Preview | Batch enqueued tokens: 3,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 2.5 Flash Image Preview | Batch enqueued tokens: 3,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 2.5 Flash TTS | Batch enqueued tokens: 100,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 2.5 Flash Lite | Batch enqueued tokens: 10,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 2.5 Flash Lite Preview | Batch enqueued tokens: 10,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 2.0 Flash | Batch enqueued tokens: 10,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 2.0 Flash Image | Batch enqueued tokens: 3,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 2.0 Flash Lite | Batch enqueued tokens: 10,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Multi-modal generation models
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 3.1 Flash Image Preview 🍌 | Batch enqueued tokens: 1,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 3.1 Flash Lite Image 🍌 | Batch enqueued tokens: 2,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini 3 Pro Image Preview 🍌 | Batch enqueued tokens: 2,000,000
Rate limits > Batch API rate limits > Tier 1 > Model: Embedding models
Rate limits > Batch API rate limits > Tier 1 > Model: Gemini Embedding | Batch enqueued tokens: 500,000

### Tier 2

Rate limits > Batch API rate limits > Tier 2 > Model: Text-out models
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 3.1 Pro Preview | Batch enqueued tokens: 500,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 3.5 Flash-Lite | Batch enqueued tokens: 500,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 3.1 Flash Lite | Batch enqueued tokens: 500,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 3.1 Flash Lite Preview | Batch enqueued tokens: 500,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 3.6 Flash | Batch enqueued tokens: 400,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 3.5 Flash | Batch enqueued tokens: 400,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 2.5 Pro | Batch enqueued tokens: 500,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 2.5 Pro TTS | Batch enqueued tokens: 100,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 2.5 Flash | Batch enqueued tokens: 400,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 2.5 Flash Preview | Batch enqueued tokens: 400,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 2.5 Flash Image Preview | Batch enqueued tokens: 400,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 2.5 Flash TTS | Batch enqueued tokens: 100,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 2.5 Flash Lite | Batch enqueued tokens: 500,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 2.5 Flash Lite Preview | Batch enqueued tokens: 500,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 2.0 Flash | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 2.0 Flash Image | Batch enqueued tokens: 400,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 2.0 Flash Lite | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Multi-modal generation models
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 3.1 Flash Image Preview 🍌 | Batch enqueued tokens: 250,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 3.1 Flash Lite Image 🍌 | Batch enqueued tokens: 270,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini 3 Pro Image Preview 🍌 | Batch enqueued tokens: 270,000,000
Rate limits > Batch API rate limits > Tier 2 > Model: Embedding models
Rate limits > Batch API rate limits > Tier 2 > Model: Gemini Embedding | Batch enqueued tokens: 5,000,000

### Tier 3

Rate limits > Batch API rate limits > Tier 3 > Model: Text-out models
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 3.1 Pro Preview | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 3.5 Flash-Lite | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 3.1 Flash Lite | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 3.1 Flash Lite Preview | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 3.6 Flash | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 3.5 Flash | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 2.5 Pro | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 2.5 Pro TTS | Batch enqueued tokens: 1,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 2.5 Flash | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 2.5 Flash Preview | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 2.5 Flash Image Preview | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 2.5 Flash TTS | Batch enqueued tokens: 4,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 2.5 Flash Lite | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 2.5 Flash Lite Preview | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 2.0 Flash | Batch enqueued tokens: 5,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 2.0 Flash Image | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 2.0 Flash Lite | Batch enqueued tokens: 5,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Multi-modal generation models
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 3.1 Flash Image Preview 🍌 | Batch enqueued tokens: 750,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 3.1 Flash Lite Image 🍌 | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini 3 Pro Image Preview 🍌 | Batch enqueued tokens: 1,000,000,000
Rate limits > Batch API rate limits > Tier 3 > Model: Embedding models
Rate limits > Batch API rate limits > Tier 3 > Model: Gemini Embedding | Batch enqueued tokens: 10,000,000

## How to upgrade to the next tier

To transition from the Free tier to a paid tier, you must first set up billing in AI Studio .
Once your project meets the specified criteria , it will be automatically upgraded to the next tier. Tier upgrades from the Free to Tier 1 will typically take effect instantly, and subsequent tier upgrades will take effect within 10 minutes. Navigate to the Projects page in AI Studio to check your tiers.

## Request a rate limit increase

Each model variation has an associated rate limit (requests per minute, RPM). For details on those rate limits, see the AI Studio Rate Limit page.
Request paid tier rate limit increase
We offer no guarantees about increasing your rate limit, but we'll do our best to review your request.
Except as otherwise noted, the content of this page is licensed under the Creative Commons Attribution 4.0 License , and code samples are licensed under the Apache 2.0 License . For details, see the Google Developers Site Policies . Java is a registered trademark of Oracle and/or its affiliates.
Last updated 2026-08-18 UTC.
