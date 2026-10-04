# LifeStrategy — Functionality Audit

| Feature | Status | What it does |
| --- | --- | --- |
| Start screen | WORKING | New Game, gated Continue, Presentation Mode, Settings, and confirmed Reset Save all use persistent state. |
| Character setup | WORKING | Name, age, occupation, avatar, living situation, scenario, and 2–3 goals persist through the run. |
| Save / load | WORKING | Zustand stays responsive locally while a versioned FastAPI + SQLite save hydrates the complete run, including financial state, goals, events, achievements, agent adaptation and Game Theory history. Local state is a safe retry fallback, not the only persistence layer. |
| Journey / database history | WORKING | Journey reads real chronological `game_actions` from SQLite when connected, grouped by simulated month; local unsynced actions are visibly identified as a retry fallback. |
| World map and movement | WORKING | Nine locations come from one typed registry shared by Phaser, map labels and routing; WASD/arrow movement, boundaries, building collision, proximity prompt, and E-to-enter work. Bank and Café have distinct IDs and hitboxes. |
| Fast-travel map | WORKING | Discovered locations can be revisited through the map; current location and discovery persist. |
| Home | WORKING | Shows monthly requirements, budget, goals, journal, environment progress, and guarded month finish. |
| Workplace | WORKING | Processes salary once per month, stores salary history, and provides real career choices with persistent outcomes. |
| Bank | WORKING | Cash, savings, and emergency transfers share one guarded finance engine and transfer history. |
| Investment Corner | WORKING | Supports contributions/withdrawals, simulated seeded month-end returns, cumulative contribution, and history. |
| Learning Studio | WORKING | Courses cost real skill/cash funds, have completion times, delayed effects, inventory items, and salary/growth consequences. |
| Shopping Street | WORKING | Purchases cost cash, change Lifestyle, and selected items become inventory keepsakes. |
| Travel Station | WORKING | Destination selection, travel fund, affordability gate, booking, score effects, goal completion, and ticket inventory work. |
| Café / agents | WORKING | Sam, Gia, Leo, and Maya unlock by month, react to live state, maintain satisfaction/interaction state, and choose the current strategy counterpart. |
| Salary and budget guards | WORKING | Salary, allocation, event, strategy, and month transition are each processed once and cannot be duplicated by revisit/refresh. |
| Budget allocation | WORKING | Live totals, validity guard, lock-after-confirm, goal-aware Suggested Balance, history, and direct financial effects work. |
| Events and delayed effects | WORKING | All authored event choices apply immediate effects; eligible delayed effects use a once-only queue. |
| Debt | WORKING | Borrowing, debt interest, mandatory month-end payment, balance effect, journal, and transaction history work. |
| Goals | WORKING | Emergency, investing, learning, travel, laptop, and purchase goals use real progress sources and completion consequences. |
| Scores and Journey charts | WORKING | Wealth, Security, Lifestyle, Growth, and Goals are engine-calculated and charted from monthly history. |
| Journal | WORKING | Salary, allocation, transfers, events, learning, purchases, travel, strategy, and month-end entries are recorded and filterable. |
| Inventory / achievements | WORKING | Gameplay earns inventory; every listed achievement has a real condition, unlock month, and persisted state. |
| Mini-games and XP | WORKING | Salary Split and Strategy Match are playable once per month and award only XP, never exploitable cash. |
| Strategy Lab | WORKING | Uses the current state, current agent, actual preference vectors, all 16 profiles, negotiated allocation, and numeric utilities. |
| Payoff board / Nash proof | WORKING | Every cell is selectable; best responses, Nash profiles, alternatives, and actual payoff proof are shown. |
| Pareto map / repeated-game history | WORKING | Interactive Pareto points and persisted strategic-history records show utilities, Nash status, and Pareto status. |
| Music / settings | SIMPLIFIED | Browser-generated original ambient tracks provide play, pause, next, mute, music/SFX volume, reduced motion, and text size without external audio files. |
| Environmental progression | SIMPLIFIED | The town displays earned laptop, certificate, travel, savings-jar, garden, and debt reactions instead of full separate room scenes. |
| Presentation Mode | WORKING | A fixed event route and optional Next Demo Beat use the same live engines and reach results through the normal lifecycle. |
| Final results / comparison | WORKING | Final state, scores, goals, strategy classification, insights, and latest-two-run comparison use recorded run data. |
| Responsive layout | WORKING | HUD-safe zones reserve space for the Monthly Chapter, Year Journey, goals and dock. The chapter no longer covers a building; the Goals card uses viewport-aware width, margins and scroll bounds so it remains visible on standard desktop targets. |
