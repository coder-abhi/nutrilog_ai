# 004 — SQLite as Local Database

**Date:** 28 Feb 2026
**Status:** Decided

## Decision
Using SQLite as the primary database for food logs, user profiles, preferences, and ingredient history.

## Why
This is currently a solo-built MVP. SQLite requires zero infrastructure setup, runs locally, is fast enough for single-user and early multi-user scale, and keeps the project simple and portable. Speed of development matters more than scale at this stage.

## Alternatives Considered
PostgreSQL — more powerful but overkill for MVP, adds infrastructure complexity. MongoDB — rejected because structured relational data like user goals and nutrient logs fits SQL naturally.

## Consequences
Will need to migrate to PostgreSQL when app scales beyond early users. Migration path is straightforward since schema is already relational.
