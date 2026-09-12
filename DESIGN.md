---
name: "AlmazStat"
description: "Graphite sports control room для быстрого чтения футбольного игрового дня."
colors:
  graphite-canvas: "#0d1014"
  outer-canvas: "#090b0e"
  panel-surface: "#151920"
  raised-surface: "#1c212a"
  league-surface: "#20252e"
  primary-text: "#f2f5fb"
  muted-text: "#87909f"
  primary-green: "#22c978"
  live-green-soft: "#a9f3cc"
  error-red: "#ef4e57"
  hairline: "rgba(224, 232, 255, 0.09)"
typography:
  display:
    fontFamily: "Inter, DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(25px, 3vw, 36px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Inter, DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "Inter, DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Inter, DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Space Mono, monospace"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  badge: "5px"
  compact: "6px"
  control: "8px"
  panel: "10px"
  shell: "16px"
  pill: "999px"
spacing:
  xs: "5px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  action-link:
    backgroundColor: "rgba(34, 201, 120, 0.10)"
    textColor: "{colors.live-green-soft}"
    rounded: "{rounded.compact}"
    padding: "0 12px"
    height: "36px"
  featured-match:
    backgroundColor: "{colors.panel-surface}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.panel}"
    padding: "18px 20px 20px"
  live-panel:
    backgroundColor: "{colors.panel-surface}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.panel}"
    padding: "16px"
  today-panel:
    backgroundColor: "{colors.panel-surface}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.panel}"
    padding: "16px"
  schedule-row:
    textColor: "{colors.primary-text}"
    padding: "7px 10px"
    height: "45px"
  sidebar-item-active:
    backgroundColor: "rgba(34, 201, 120, 0.10)"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.compact}"
    padding: "0 11px"
    height: "41px"
  date-option-active:
    backgroundColor: "rgba(34, 201, 120, 0.12)"
    textColor: "{colors.live-green-soft}"
    rounded: "{rounded.compact}"
    padding: "5px 8px"
    height: "52px"
---

# Design System: AlmazStat

## Overview

**Creative North Star: "Graphite Sports Control Room"**

AlmazStat выглядит как компактная операторская игрового дня: матовые графитовые панели, тонкие холодные разделители, плотная спортивная типографика и один уверенный зелёный сигнал. Экран должен ощущаться рабочим, быстрым и фактическим — без рекламной театральности и декоративной «аналитики».

Иерархия строится композицией и плотностью. На desktop три главные зоны видны одновременно, а устойчивый левый sidebar держит контекст навигации. На mobile оболочка исчезает, дата становится явным контролом, а порядок контента следует срочности: LIVE, главный матч, матчи сегодня, затем расписание.

**Key Characteristics:**

- Графитовая низкобликовая основа с холодными тонкими границами.
- Единственный primary — яркий зелёный; gold и indigo не используются.
- Плотные панели и компактные строки вместо больших декоративных карточек.
- Inter для интерфейса и Space Mono для времени, счёта и live-статуса.
- Только реальные API-данные и честные empty/loading/error-состояния.

## Colors

Палитра почти монохромная: различия графитовых слоёв организуют пространство, а зелёный действует как редкий операционный сигнал.

### Primary

- **Signal Green**: активные маршруты и фильтры, focus ring, CTA, выбранная дата и подтверждённые live-состояния.

### Neutral

- **Graphite Canvas**: основной фон приложения.
- **Outer Canvas**: фон вокруг desktop-оболочки.
- **Panel Surface**: рабочие панели первого ряда и расписания.
- **Raised Surface**: интерактивные контролы и локальное разделение слоёв.
- **League Surface**: заголовки групп расписания.
- **Primary Text**: ключевые названия, счёт и активная навигация.
- **Muted Text**: метаданные, подписи и неактивные состояния.
- **Cold Hairline**: границы shell, панелей и строк.
- **Error Red**: только реальные ошибки загрузки или данных.

### Named Rules

**The One Signal Rule.** Primary green is the only accent: do not revive gold or indigo for branding, priority, selection, or focus.

**Theme parity.** Пользователь может переключаться между графитовой и светлой операторской темой. Светлая тема использует холодный белый canvas, белые панели, чернильный текст и тот же Signal Green; композиция, плотность и семантика цветов не меняются. Выбор темы сохраняется локально.

**The Verified Live Rule.** Green may label LIVE only when the API status belongs to the verified live-status set; otherwise show a factual empty or upcoming state.

## Typography

**Display Font:** Inter (with DM Sans and system sans fallbacks)

**Body Font:** Inter (with DM Sans and system sans fallbacks)
**Label/Mono Font:** Space Mono (with monospace fallback)

**Character:** Inter keeps the control-room shell compact and neutral. Space Mono turns time, minute and score into stable instruments that can be scanned vertically.

### Hierarchy

- **Display** (800, fluid 25–36px, 1): day heading and highest-level screen title.
- **Headline** (800, 15px, 1.2): panel headings, usually uppercase on the dashboard.
- **Title** (700, 12px, 1.2): team names, navigation and compact actions.
- **Body** (400, 12px, 1.5): supporting status and empty-state copy.
- **Label** (700, 10px, 1.2): times, scores, live minute and compact operational metadata.

### Named Rules

**The Numeric Instrument Rule.** Use Space Mono with tabular numerals for kickoff times, scores and live minutes; team names and prose remain in Inter.

## Layout

Desktop begins at 800px. The page sits in a framed shell up to 1440px wide with a 226px sticky sidebar (`top: 18px`, viewport-height minus outer gutters) and a fluid main canvas. The first dashboard row has three columns in this semantic and visual order: «Матчи сегодня» on the left, featured match in the centre, LIVE on the right. The schedule spans the content width below.

Below 800px the sidebar is removed, the mobile header and fixed bottom navigation carry the shell, and a three-option date switcher appears. The first row becomes one column ordered LIVE → featured → «Матчи сегодня»; schedule remains below. Interactive targets are at least 44px high on mobile, and the main content reserves bottom safe-area space for the fixed navigation.

**The Recomposition Rule.** At 800px, change navigation and semantic order; do not merely shrink the desktop columns.

**The First-Row Contract Rule.** Desktop always presents Today matches / Featured / LIVE as peer operational zones, with schedule as the next tier.

## Elevation & Depth

Depth is primarily tonal and structural: darker outer canvas, framed shell, differentiated graphite panels and hairline borders. Panels remain flat at rest; the desktop shell may use one broad ambient shadow to separate the application from the page background. Hover uses a faint green tint, never a floating-card lift.

### Shadow Vocabulary

- **Shell Ambient** (`0 26px 80px rgba(0, 0, 0, 0.38)`): desktop application shell only.
- **Signal Glow** (`0 0 10px rgba(34, 201, 120, 0.35)`): small verified live dots only.

### Named Rules

**The Flat Panel Rule.** Information hierarchy comes from grid placement, tonal surfaces and typography; dashboard panels do not float independently.

## Shapes

The form language is compact and technical: 6–10px corners for controls and panels, 16px only for the outer desktop shell, and pills only for intrinsically circular status elements. Borders are thin and cool; team marks retain their natural silhouettes without decorative containers unless an image is unavailable.

## Components

### Buttons

- **Shape:** compact rectangular controls with restrained corners (6–8px).
- **Primary:** green-tinted surface or green signal with concise labels; avoid oversized marketing CTAs.
- **Hover / Focus:** faint green wash on hover and a 2px Signal Green focus outline with 2px offset.
- **Ghost:** transparent by default, graphite/green tint when active.

### Chips

- **Style:** compact filter chips with transparent inactive state and a green-tinted selected state.
- **State:** `aria-pressed` mirrors selection; mobile targets remain at least 44px high.

### Cards / Containers

- **Corner Style:** compact panel radius (10px).
- **Background:** graphite panel surface with cold hairline border.
- **Shadow Strategy:** flat by default; no per-card drop shadow.
- **Internal Padding:** typically 14–20px depending on density.

### Inputs / Fields

- **Style:** raised graphite fill, cold hairline, compact radius (8px), muted placeholder.
- **Focus:** Signal Green border/outline; no indigo glow.
- **Error / Disabled:** error red only for confirmed failure; disabled states use muted text and reduced contrast.

### Navigation

Desktop navigation lives in a 226px sticky left sidebar; the active route has a subtle green wash and a narrow green rail. The desktop header is hidden. Below 800px the sidebar is absent and navigation moves to a fixed, safe-area-aware bottom bar; the active icon/text uses Signal Green. Navigation items must preserve visible focus.

### Match-Day Panels

The dashboard stage contains three sibling zones. «Матчи сегодня» is a dense filtered list, Featured is the visual anchor with team marks and the largest score/time, and LIVE is a compact verified feed or explicit no-live state. The schedule below groups every API match by competition in stable rows.

## Do's and Don'ts

### Do:

- **Do** use the approved graphite sports control room composition and Signal Green as the sole primary accent.
- **Do** keep desktop order as Today matches / Featured / LIVE, with schedule below.
- **Do** keep mobile order as LIVE / Featured / Today, with the date switcher above and fixed bottom navigation below.
- **Do** render teams, leagues, logos, times, statuses and scores only from the API, preserving honest loading, empty and error states.
- **Do** make score, time and live status scannable with Space Mono and tabular numerals.

### Don't:

- **Don't** reintroduce gold, indigo, purple gradients or their glow treatments.
- **Don't** use the old two-column featured/next layout for the dashboard's first tier.
- **Don't** show fake standings, team-of-the-week modules, invented metrics, editorial headlines, photos, predictions or simulated live activity.
- **Don't** keep the desktop sidebar visible on mobile or replace the fixed mobile bottom navigation with desktop controls.
- **Don't** flatten the page into equal repeated cards; preserve the distinct roles of LIVE, Featured, Today and Schedule.
