# 003 — Fire and Forget Ingredient Extraction

**Date:** 28 Feb 2026
**Status:** Decided

## Decision
When user logs food, two LLM calls are made. First call returns nutrition data immediately — user sees result instantly. Second call extracts ingredients and runs in background without awaiting — updates DB silently when complete.

## Why
Response time is everything for a frictionless logging experience. Making the user wait for ingredient extraction kills the flow. Ingredients are needed for personalization and pattern learning, not for immediate display — so they can wait.

## Alternatives Considered
Single LLM call for both nutrition and ingredients — rejected because it doubles response time for data the user doesn't immediately need.

## Consequences
There is a short window after logging where ingredient data doesn't exist yet in DB. Personalization layer must handle null ingredients gracefully.
