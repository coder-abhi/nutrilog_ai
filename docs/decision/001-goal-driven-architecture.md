# 001 — Goal Driven Architecture

**Date:** 28 Feb 2026
**Status:** Decided

## Decision
Each user selects one health goal on signup. Dashboard tracks and highlights only the nutrients relevant to that specific goal.

## Why
Generic nutrition tracking overwhelms users. The more health conscious someone is, the harder every food decision becomes. By focusing on one goal, EatWise cuts noise and gives users clarity. Someone growing hair doesn't need to think about calorie deficit. Someone losing weight doesn't need biotin targets.

## Alternatives Considered
Multiple goals per user — rejected because it reintroduces the same overwhelm the app is trying to solve. One goal, full focus.

## Consequences
Need a goal-to-nutrient mapping layer. Dashboard must be dynamic and goal-aware, not a static display of all nutrients.
