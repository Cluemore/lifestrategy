# LifeStrategy Game Theory — Viva Guide

LifeStrategy models Months 7–12 as a repeated two-player game. The human and the current financial character independently choose `SECURITY`, `GROWTH`, `LIFESTYLE`, or `BALANCED`. A strategy is a normalized allocation vector over security, savings, growth, and lifestyle. The negotiated allocation is the equal-weight blend `x = 0.5 vH + 0.5 vA`.

## State-dependent utility

For player `i`, the implementation calculates:

`Ui = 100 × [Σ wi,k × mk(state) × ln(1 + 8xk) − λi × debt/(6 × income) + γi × 0.08]`

The logarithm creates diminishing returns. `mk(state)` changes marginal benefit: emergency allocation is particularly valuable when emergency coverage is low, savings value declines as savings rise, and growth value declines as invested capital accumulates. Debt sensitivity and goal sensitivity vary by character. Human preference weights come from selected goals and historical allocations. Character weights adapt deterministically to current coverage and debt.

## Worked verification state

- Income: ₹45,000
- Essential expenses: ₹20,000
- Savings: ₹20,000
- Emergency fund: ₹5,000
- Investments: ₹2,000
- Debt: ₹0
- Human weights: (0.30, 0.30, 0.25, 0.15)
- Sam base weights: (0.40, 0.35, 0.15, 0.10)

For Human `SECURITY` and Sam `GROWTH`:

- Human vector: (0.35, 0.35, 0.20, 0.10)
- Sam strategy vector: (0.15, 0.15, 0.50, 0.20)
- Negotiated vector: (0.25, 0.25, 0.35, 0.15)
- Each payoff is then produced by the utility function above using the same financial state and each participant's own weights.

The app calculates all 16 cells at runtime. A human best response maximizes human utility within a fixed agent column; an agent best response maximizes agent utility within a fixed human row. Ties are retained. A cell is a pure Nash equilibrium exactly when it is in both best-response sets. The engine returns zero, one, or multiple equilibria without forcing one.

Outcome B Pareto-dominates A when both utilities are at least as high and one is strictly higher. The Pareto frontier filters all dominated outcomes and is plotted in the Strategy Lab.

## Repeated-game interpretation

The strategy set stays fixed, but financial state and preferences change. A tiny reserve increases security's marginal value. Once coverage is healthy, Sam relaxes security weight; Gia increases growth weight when debt is low and coverage is healthy. This makes the same nominal strategy rationally produce different payoffs later in the year.
