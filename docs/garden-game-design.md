# Seed Sort: Garden Game Design (draft for Joshua's review)

Two games in one:

1. **The puzzle game:** the seed-sorting levels we already have.
2. **The garden game:** a real garden you see, tap and restore, with characters who talk to you
   and react to what you do. **Puzzles earn stars; stars pay for garden tasks; tasks move the story.**

This "puzzle + restoration" loop is the most profitable structure in casual mobile games, because
players come back for the story and the garden, not just the next level. The mechanics are a
genre convention; everything here (setting, cast, writing, art) is original.

---

## 1. Core loop

```
Play a sorting level ──► earn 1 ★ (first clear)
        ▲                       │
        │                       ▼
Next task needs more ★ ◄── Spend ★ on a garden task (1–3 ★)
                                │
                                ▼
            Task animation (weeds cleared, fountain fixed…)
            + a short character scene
            + sometimes a choice: pick 1 of 3 styles
```

- **Tasks** are listed in a small to-do panel ("Clear the weeds from the path · 1★").
- **Style choices** (bench style, fountain style, flowerbed colors) are the genre's strongest
  hook. Players make the garden *theirs*, and can change their choice later for free.
- **Areas:** the garden unlocks area by area. Each area is roughly 15–20 tasks, about 30 levels.
- **Seed packs** stay: varieties you collect become the flowers you can plant in flowerbed tasks.

## 2. Setting and tone

**Hollow Brook Botanical Garden**, a city-owned public garden, closed for six years. You've been
hired as the new head gardener. The budget is a joke, the staff is three people and a goose.

Tone: **grounded workplace comedy**. Dry, specific, character-driven. No lost-relative letters,
no evil developer, no speeches about what gardens mean.

## 3. Cast

| Character | Role | Voice |
|---|---|---|
| **Marisol Vega** | Facilities manager. Kept the place from falling down alone for six years. | Deadpan, practical, low expectations, secretly invested. |
| **Wendell Pruitt** | Retired botanist, volunteer. Knows every Latin name. | Precise, pedantic, terrible at small talk, fond of plants more than people. |
| **Ozzie Tran** | Teenager working off community service hours. | Films everything for a channel with 41 subscribers. Surprisingly useful. |
| **The Goose** | Lives in the pond. Has no name; nobody has earned the right. | Hostile. A recurring problem across the whole game. |

### Sample: the first task

> **MARISOL:** So. You're the new head gardener.
> **MARISOL:** You're also the only gardener. Congratulations on the promotion.
> *Task: Clear the weeds from the entrance path · 1★*
> *(weeds clear)*
> **MARISOL:** Huh. There was a path under there.
> **OZZIE:** Can you do that again? I wasn't filming.

### Sample: a style choice

> *Task: Replace the bench · 2★ · choose a style: Classic wood / Wrought iron / Painted*
> **WENDELL:** Wrought iron. It's what the original designer intended in 1931.
> **MARISOL:** The original designer also intended a working budget.

## 4. Area plan (season 1)

| Area | Levels (approx.) | Highlights |
|---|---|---|
| 1. Entrance Path | 1–30 | Weeds, gate, path, bench (choice), first flowerbed, the Goose arrives |
| 2. Greenhouse | 31–60 | Broken glass, benches of seedlings, Wendell's orchid obsession |
| 3. Pond | 61–90 | The Goose's territory. Fountain (choice), lily pads, a bridge |
| 4. Rose Garden | 91–120 | Arbor (choice), rose beds planted with collected varieties |
| 5. Reopening Day | 121–150 | Gates open to the public; the city's inspection |

New areas ship as updates every few weeks after launch. Regular updates are what keep this
genre's players active for months.

## 5. Scope and timeline (honest version)

This is a much bigger game than the original "small puzzle game in 30 days" plan.

| Work | Who | Estimate |
|---|---|---|
| Garden engine: tasks, stars, choices, dialogue, area scenes, save | Claude | ~1–2 weeks |
| Area 1 content: ~18 tasks, dialogue | Claude | ~3–4 days |
| Style test: entrance scene (overgrown + restored) and Marisol (3 expressions) | Claude | done, see `art/` |
| Full Area 1 art: remaining cast, task objects with broken/fixed/style variants | Claude | ~1 week |
| Integrate art, polish, playtest | Both | ~1 week |
| Native app builds, ads, analytics (original Week 3 work) | Claude | ~1 week |

**Realistic first store release: about 6–8 weeks from now, with Area 1 and Area 2.**
Starting with fewer areas is normal for this genre; later areas ship as updates.

## 6. Art pipeline

All art is vector illustration drawn in code (`art/src/*.py` writes SVG, `art/render.mjs` renders
PNG). Flat-shaded, warm, consistent: one palette and lighting direction for everything. Every
garden object is its own layer with "broken" and "fixed" states (and style variants for choices),
so a task swaps one layer with an animation. No paid tools or licenses needed, and the art can be
revised as easily as code.

## 7. Decisions still open

- Name: keep **Seed Sort**, or a garden name (e.g. **Hollow Brook**, **Hollow Brook Gardens**)?
- Stars per level: 1 per first clear (genre standard) or tied to the 1–3 star rating?
- Does the cast work for you? The Goose is optional but players tend to love a recurring nuisance.
