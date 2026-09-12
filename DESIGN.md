---
name: "AlmazStat"
description: "Тёмный футбольный интерфейс с редакционной иерархией игрового дня."
colors:
  night-canvas: "#0b0e12"
  base-surface: "#12171c"
  raised-surface: "#192027"
  feature-surface: "#11161b"
  live-surface: "#101b18"
  primary-text: "#edf2ed"
  muted-text: "#8e9a98"
  focus-sage: "#93b8aa"
  matchday-gold: "#c7a66a"
  brand-indigo-light: "#8898ff"
  brand-indigo-deep: "#5147b8"
  live-green: "#86c8a4"
  error-coral: "#e8897d"
  hairline: "rgba(205, 220, 214, 0.12)"
typography:
  display:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(38px, 7vw, 72px)"
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    letterSpacing: "-0.02em"
  title:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 700
  body:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Space Mono, monospace"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.04em"
rounded:
  compact: "8px"
  control: "12px"
  chip: "13px"
  panel: "16px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "28px"
components:
  action-link:
    textColor: "{colors.matchday-gold}"
    typography: "{typography.title}"
    height: "44px"
  featured-match:
    backgroundColor: "{colors.feature-surface}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.panel}"
    padding: "22px 24px 28px"
  live-strip:
    backgroundColor: "{colors.live-surface}"
    textColor: "{colors.live-green}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "64px"
  schedule-row:
    textColor: "{colors.primary-text}"
    padding: "7px 10px"
    height: "48px"
  search-field:
    backgroundColor: "{colors.base-surface}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.panel}"
    padding: "0 16px 0 44px"
    height: "48px"
  filter-chip:
    backgroundColor: "{colors.base-surface}"
    textColor: "{colors.muted-text}"
    rounded: "{rounded.chip}"
    padding: "0 17px"
    height: "44px"
---

# Design System: AlmazStat

## Overview

**Creative North Star: "Ночной редакционный матч-дэй"**

AlmazStat is an established dark football-data system. Its homepage extends that incumbent identity with the hierarchy of a restrained sports broadcast: one decisive headline match, a compact queue of what follows, a truthful live signal, and a complete schedule beneath. The interface should feel informed and immediate, not theatrical or promotional.

This is an evolution of the existing product world rather than a new global visual identity. Dark tonal surfaces, compact data density, Russian-first labels, team marks, and numeric clarity remain foundational; the editorial hierarchy is strongest on the homepage and should not force every utility or detail screen into the same composition.

**Key Characteristics:**

- Dark, low-glare football surfaces with fine cool hairlines.
- Muted gold for editorial priority and navigation emphasis.
- Green reserved for verified live state and score information.
- Oversized editorial introduction paired with compact tabular match data.
- Calm, factual empty, loading, and error states with no invented content.

## Colors

The palette is a near-black stadium field with cool mineral surfaces, warm gold editorial cues, and narrowly semantic status color.

### Primary

- **Matchday Gold** (`matchday-gold`): marks the featured-match badge, priority links, active navigation underline, times in the next-match rail, and homepage focus outlines.

### Secondary

- **Focus Sage** (`focus-sage`): preserves the incumbent accessible focus color on existing controls outside the homepage treatment.
- **Brand Indigo Gradient** (`brand-indigo-light` to `brand-indigo-deep`): remains confined to the established AlmazStat diamond mark; it is an incumbent brand signature, not a new homepage accent family.
- **Live Green** (`live-green`): identifies only a match confirmed to be live and its associated score or state.
- **Error Coral** (`error-coral`): communicates failed data states without competing with live green.

### Neutral

- **Night Canvas** (`night-canvas`): the page background and darkest visual field.
- **Base Surface** (`base-surface`): the standard panel and control foundation across incumbent screens.
- **Raised Surface** (`raised-surface`): nested controls and secondary tonal separation.
- **Feature Surface** (`feature-surface`): the homepage feature, next rail, and schedule shell.
- **Live Surface** (`live-surface`): the quiet green-black backing for the honest live strip.
- **Primary Text** (`primary-text`): primary labels, team names, scores, and headings.
- **Muted Text** (`muted-text`): supporting dates, league context, and metadata.
- **Hairline** (`hairline`): low-contrast panel, row, and control boundaries.

### Named Rules

**The Verified Green Rule.** Use live green only when the current match status is in the product's live-status set; an empty live strip remains factual and does not simulate activity.

**The Warm Priority Rule.** Gold expresses editorial importance or an active path. It is not a decorative wash and should not tint large surfaces.

## Typography

**Display Font:** DM Sans (with system sans-serif fallbacks)

**Body Font:** DM Sans (with system sans-serif fallbacks)

**Label/Mono Font:** Space Mono (with monospace fallback)

**Character:** DM Sans supplies a compact, contemporary broadcast voice without leaving the incumbent system. Space Mono is the data instrument: it keeps times, scores, live labels, and tabular numerals steady and quickly scannable.

### Hierarchy

- **Display** (700, `clamp(38px, 7vw, 72px)`, 0.94): the homepage's “Футбол сегодня” editorial introduction; mobile adjusts to `clamp(36px, 11vw, 50px)`.
- **Headline** (700, 21px): panel titles such as “Следом”; preserve compact negative tracking.
- **Title** (700, 12–27px): team names and row titles scale with their information rank, never by arbitrary card variation.
- **Body** (400, 14px, 1.55): explanatory and supporting copy; keep it brief because visits are scan-oriented.
- **Label** (700, 11px, 0.04em): Space Mono badges, time, score, and status roles; uppercase is used for compact state labels such as LIVE.

### Named Rules

**The Numeric Instrument Rule.** Render scores, kickoff times, and live labels in Space Mono with tabular numerals; prose and team names remain in DM Sans.

**The Rank Before Scale Rule.** Use the largest type for the day and the featured score, then step sharply down into compact match metadata.

## Layout

The application is mobile-first. Below 800px, its established shell stays within a 520px column with 16px horizontal padding, the desktop header navigation is hidden, and the homepage stage collapses into one column. The featured match remains dominant while team marks reduce from 88px to 64px; schedule rows reflow from a four-column versus line to two stacked team rows with a fixed score column.

At 800px and above, the shell expands to a centered maximum width of 1180px with 24px side padding. The header gains centered navigation and a separating hairline. The homepage stage uses a weighted two-column grid—featured match at roughly two parts and the next rail at 0.92 parts—with a 280px minimum for the rail. Utility, match-centre, analysis, and data screens retain their narrower incumbent 760px desktop measure.

The homepage follows an editorial reading order: introduction, featured match with next rail, live strip, then league-grouped schedule. Repeated spacing is compact (8–16px) inside data rows, relaxed (24–28px) between major homepage regions, and never padded merely to make sparse data look full.

### Named Rules

**The 800px Recomposition Rule.** Do not merely shrink the desktop grid; below 800px, stack the stage and explicitly recompose dense schedule rows.

**The Incumbent Measure Rule.** The 1180px width belongs to the desktop shell and homepage canvas; existing focused screens keep their 760px content measure.

## Elevation & Depth

The system is tonally layered and mostly flat. Depth comes from near-black surface steps, low-opacity hairlines, and the existing radial page atmosphere. Strong ambient shadows remain part of legacy hero cards and the logo, but the redesigned homepage panels sit flat at rest; row hover uses a subtle translucent lightening instead of lift.

### Shadow Vocabulary

- **Legacy Card Ambient** (`0 25px 70px rgba(0, 0, 0, 0.35)`): reserved for the established match-detail hero card.
- **Brand Mark Glow** (`0 10px 35px rgba(101, 119, 255, 0.22)`): preserves the incumbent logo treatment.
- **Status Dot Shadow** (`0 2px 8px rgba(0, 0, 0, 0.45)` on the homepage): separates the live dot from its dark live surface.

### Named Rules

**The Flat Broadcast Rule.** Homepage information panels stay flat; hierarchy comes from composition, tonal surface changes, and typography rather than floating card shadows.

## Shapes

The form language is gently rounded and compact. Homepage shells use a consistent 16px radius, live bands and core controls use 12px, badges use 8px, and chips use the full pill. Hairline borders separate regions and rows; team logos remain unclipped with `object-fit: contain`, preserving real club marks rather than forcing them into decorative masks.

**The Quiet Corner Rule.** Reserve large legacy radii for existing detail cards; the homepage's editorial panels use the tighter 16px silhouette.

## Components

### Buttons and Action Links

- **Shape:** tap targets are at least 44px high; compact controls use the control radius, while row and match buttons inherit their container shape.
- **Primary:** the homepage uses gold text links and a solid gold “Матч дня” badge rather than a large filled call-to-action.
- **Hover / Focus:** links reveal their underline on hover; homepage focus uses a 2px gold outline offset by 3px. Existing non-homepage controls retain the incumbent sage focus outline.
- **Retry:** failed states expose the incumbent bordered retry button and never hide recovery behind a generic card click.

### Chips

- **Style:** filter chips use a base surface, hairline border, compact bold label, 44px minimum height, and horizontal scrolling where space is constrained.
- **State:** active filters gain a quiet tinted background and brighter text; live color is not used merely to denote a selected LIVE filter.

### Cards / Containers

- **Corner Style:** 16px on homepage panels, tighter on badges and live strips, and larger only where the incumbent screen already establishes it.
- **Background:** use the feature surface for the main homepage shells and a distinct live surface only for verified live context.
- **Shadow Strategy:** flat on the homepage; see Elevation & Depth for the preserved legacy exceptions.
- **Border:** one subtle hairline around panel shells and between rows.
- **Internal Padding:** 18–24px on desktop panels, reduced explicitly on mobile schedule and feature layouts.

### Inputs / Fields

- **Style:** 48px-high base-surface fields with a 16px radius, hairline stroke, primary text, muted placeholder, and a 44px left inset when a search icon is present.
- **Focus:** the incumbent search field shifts to a cool focus border with a restrained translucent ring.

### Navigation

Desktop navigation appears only at 800px and above, centers in the header, and uses muted 12px bold links. Active and hover states brighten the label; the active route gets a 2px gold underline. Mobile preserves the incumbent fixed bottom navigation rather than squeezing the desktop links into the header.

### Featured Match

The signature homepage component is one dominant, full-width match button with a gold “Матч дня” badge, league context, large team marks, team names, standings context when available, and a central Space Mono kickoff or score. Green enters only when this selected fixture is actually live.

### Next-Match Rail

Up to three additional priority matches form a compact queue. Each row uses a stable time/score column, two clipped team labels with marks, and one league line; it supports the featured match instead of visually matching its weight.

### Live Strip

The live strip is an honest status surface. With live fixtures it shows the first match, current score, status, and remaining count; without them it explicitly says there are no matches now and points to the match centre.

### League-Grouped Schedule

The full daily schedule is grouped by competition priority, then sorted chronologically within each group. League headers carry the mark, name, and match count; rows keep time/status, home team, score, and away team aligned for fast scanning.

## Do's and Don'ts

### Do:

- **Do** preserve the incumbent dark palette, DM Sans/Space Mono pairing, team marks, and compact data density when extending the product.
- **Do** keep the homepage order as featured choice, next queue, truthful live strip, and full league-grouped schedule.
- **Do** use actual API-backed teams, competitions, times, statuses, and scores; provide calm empty or error copy when data is absent.
- **Do** recompose at 800px and keep interactive targets at least 44px high.
- **Do** make focus visible with the established gold homepage or sage incumbent outline.

### Don't:

- **Don't** promote the homepage composition into a mandatory template for match details, search, leagues, teams, or analytics.
- **Don't** use live green for upcoming, selected, loading, or decorative states.
- **Don't** invent editorial headlines, promotional claims, photos, metrics, or live activity that the source data does not provide.
- **Don't** flatten the day into a wall of equal cards; editorial rank and full schedule serve different scanning needs.
- **Don't** add floating shadows or saturated color washes to redesigned homepage panels; preserve the quiet tonal depth.
