# CodeSetu — Customer UX & Conversion Plan

> Derived from a naive (non-technical) user walkthrough of the current product.
> Ordered by impact: highest-ROI items first within each section.

---

## Context

The pipeline engine is functionally complete (9-stage durable Inngest pipeline, SSE live updates,
assembly panel, iframe preview, Vercel deploy). The product now needs to cross the gap from
"impressive demo" to "thing I pay for." This plan documents every required UX, conversion, and
feature change to make that happen.

**Target user:** A solo founder, freelancer, or small business owner with no coding ability.
They describe an idea in plain English and expect a working, deployed website in return.

---

## 1. Post-deploy: Surface the live URL as the hero

### Problem
After the pipeline completes, the user is sent back to the dashboard with a "🎉 Your app is
ready" card at the bottom of a long scroll. The deployed URL is buried inside the "Going live"
stage card. The moment of payoff — *you have a live website* — is completely muted.

### Requirements

**1.1 Full-screen success state on the project detail page**

When `project.status === "completed"` and `project.deploymentUrl` is set, replace the bottom
completion card with a full-width hero block:

```
┌─────────────────────────────────────────────────────────────┐
│  ✦  Your app is live                                        │
│                                                             │
│  ┌─ big clickable URL chip ──────────────────────────────┐  │
│  │  https://your-project.vercel.app          [Open ↗]   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                             │
│  [Copy link]   [Share]   [← Dashboard]                      │
└─────────────────────────────────────────────────────────────┘
```

- URL chip: rounded-full border, clicking opens in a new tab.
- "Copy link" copies to clipboard and shows a "Copied!" tick for 1.5 s.
- "Share" opens the native Web Share API (mobile) or falls back to copy.
- This block should be the *first* thing visible — above the stage list, not below it.

**1.2 Persistent deployment badge in the page header**

Once deployed, the header breadcrumb area gains a small "Live ↗" chip that links to the
deployment URL. It persists on every subsequent visit to the project page.

**1.3 Deploy URL on the project card (dashboard)**

`ProjectCard` component currently shows title, prompt snippet, progress bar, and timestamp.
Add a single line below the progress bar:
- If `project.deploymentUrl` is set: show `🌐 Live · <short URL>` as a tappable link.
- Otherwise: omit the line entirely.

### Files
- `apps/web/app/dashboard/[id]/page.tsx` — completion hero block, header badge
- `apps/web/app/dashboard/_components/project-card.tsx` — deployment URL line

---

## 2. Live preview before the approval step

### Problem
The approval banner asks "Ready to go live?" before the user has seen the website running on a
real URL. They are being asked to approve something they can only see inside an iframe inside
your app. If the iframe preview breaks (CSP, relative paths, JS errors), they have no fallback.

### Requirements

**2.1 Temporary preview deployment (pre-approval)**

After the `implementation` stage completes and before the `approval` stage waits, deploy to a
temporary Vercel preview URL (Vercel preview deployments are free and ephemeral).

- Store this URL in `project.previewUrl` (new nullable column in the `project` table).
- Expose it on the `GET /api/projects/:id` response.

**2.2 Preview URL shown inside the approval banner**

Modify the approval banner:

```
Ready to preview?

Your app has been built. Open the preview link below,
then approve when you're happy.

[Open preview ↗]           [Looks good — publish it →]
```

- "Open preview ↗" links to `project.previewUrl` in a new tab.
- "Looks good — publish it →" is disabled until the user has opened the preview (track via
  `localStorage` flag keyed to `projectId`).
- Optionally embed the preview URL inside the existing `<PreviewPanel>` iframe as a secondary
  "open externally" link.

**2.3 Schema change**

```ts
// packages/database/src/schema.ts
previewUrl: text("preview_url"),        // temporary, before approval
deploymentUrl: text("deployment_url"),  // final, after approval
```

### Files
- `packages/database/src/schema.ts` — add `previewUrl` column
- `packages/database/drizzle/` — new migration file
- `packages/inngest/src/functions/pipeline.ts` — deploy preview after `implementation`
- `apps/server/src/modules/projects/projects.controller.ts` — expose `previewUrl`
- `apps/web/app/dashboard/[id]/page.tsx` — approval banner changes
- `apps/web/app/dashboard/_lib/projects.ts` — add `previewUrl` to `Project` type

---

## 3. Pricing page / pricing on landing

### Problem
There is no pricing anywhere on the site. A non-technical user who likes the product cannot
commit because they don't know if it's free, freemium, or expensive. This is the single largest
conversion blocker.

### Requirements

**3.1 Pricing section on `apps/web/app/page.tsx`**

Add a `#pricing` anchor section between "Features" and the final CTA. Three tiers:

```
Free                    Pro                     Team
────────────────────    ────────────────────    ────────────────────
3 projects / month      Unlimited projects      Everything in Pro
Community preview URL   Custom domain (1)       Custom domains (10)
                        Email on deploy         Priority pipeline
                        Remove CodeSetu badge   Team members (5)

[Get started]           [$19/month]             [$49/month]
                        [Start free trial]      [Contact us]
```

- Highlight the "Pro" card (slightly elevated shadow, border in `--blue-700`).
- Add an FAQ accordion below: "What counts as a project?", "Can I cancel?",
  "What stack does it use?", "Do I need a GitHub account?"

**3.2 Nav link**

Add "Pricing" to the nav alongside "How it works / Pipeline / Features".

**3.3 Dashboard upgrade prompt**

When a Free-tier user has used 3/3 projects this month, the `NewProjectBox` shows an inline
upgrade nudge instead of the submit button:

```
You've used your 3 free builds this month.
[Upgrade to Pro →]  ·  Resets on Jul 1
```

### Files
- `apps/web/app/page.tsx` — pricing section + nav link
- `apps/web/app/dashboard/_components/new-project-box.tsx` — usage limit nudge
- `apps/web/app/_components/pricing-section.tsx` — new component (extracted for size)

---

## 4. Completion email

### Problem
A build takes several minutes. Users start a build, leave the tab, and never come back because
they don't know when it's done. A "Your app is ready" email with the live link is the highest-ROI
re-engagement feature.

### Requirements

**4.1 Email sent on pipeline completion**

At the end of the `release` stage in the Inngest function, after `project.status` is set to
`completed`, send an email to `project.user.email`:

```
Subject: Your app is live — <project title>

Hi <first name>,

Your project "<title>" just finished building and is live at:

  https://your-project.vercel.app

Open it ↗

───
Built with CodeSetu · Unsubscribe
```

- Use the existing email infrastructure (the repo has email capability from the `send Email`
  commit). Look up the existing email sender in `apps/server/src/`.
- Send only once: guard against duplicate sends with a `emailedAt` timestamp on the `project`
  table.

**4.2 Schema change**

```ts
// packages/database/src/schema.ts
emailedAt: timestamp("emailed_at"),
```

### Files
- `packages/database/src/schema.ts` — `emailedAt` column
- `packages/inngest/src/functions/pipeline.ts` — send email at release stage
- `apps/server/src/` — email template / sender utility

---

## 5. Stage label copy — non-technical language

### Problem
The stage labels shown in the pipeline detail page use internal engineering vocabulary:
`Request`, `Product Thinking`, `PRD`, `Tasks`, `Implementation`, `Review`, `Fixes`, `Approval`,
`Release`. These mean nothing to a non-technical user.

### Requirements

**5.1 Replace stage display labels in `_lib/projects.ts`**

The `STAGES` constant drives all rendered labels. Change the `label` and `description` fields:

| Current label      | New label                   | New description                                           |
|--------------------|-----------------------------|-----------------------------------------------------------|
| Request            | Understanding your idea     | We ask a couple of quick questions to get the details right |
| Product Thinking   | Thinking it through         | We figure out who it's for and what it should do          |
| PRD                | Writing the brief           | A plain-English spec of exactly what we'll build          |
| Tasks              | Making a checklist          | We break the build into small, trackable pieces           |
| Implementation     | Writing the code            | The actual files that make your website work              |
| Review             | Checking for mistakes       | A second pass to catch anything we missed                 |
| Fixes              | Polishing it up             | Small improvements before it goes live                    |
| Approval           | Your sign-off               | Take a look — approve when you're happy                   |
| Release            | Going live                  | Published and available at your URL                       |

**5.2 Progress bar tooltip**

Add a `title` attribute to each progress-bar segment (already exists in code) and additionally
show the new human label — not the `type` slug — in the tooltip.

**5.3 Moment labels** (the 4 groupings)

Current moment labels (`Understanding / Building / Quality / Shipping`) are already
non-technical but their `blurb` text is shown in `var(--gray-600)` at `12px` — nearly
invisible. Increase to `13px` and `var(--gray-700)`.

### Files
- `apps/web/app/dashboard/_lib/projects.ts` — `STAGES` and `MOMENTS` constants
- `apps/web/app/dashboard/[id]/page.tsx` — moment blurb font-size + color

---

## 6. Shareable project link (no login required to view)

### Problem
A user who just deployed their website wants to share it with a co-founder or client. Right now
the project detail URL (`/dashboard/:id`) requires login, so the link is useless to share.

### Requirements

**6.1 Public project view at `/p/:id`**

New unauthenticated route that shows a read-only version of the project:

```
┌─────────────────────────────────────────────────────────────┐
│  CodeSetu wordmark                                          │
├─────────────────────────────────────────────────────────────┤
│  <Project title>                                            │
│  <Prompt snippet>                                           │
│                                                             │
│  Built with CodeSetu in ~4 minutes                         │
│                                                             │
│  [Open app ↗]          [Build yours free →]                │
│                                                             │
│  ── stages ──                                               │
│  ✓ Understanding   ✓ Brief   ✓ Code   ✓ Live               │
└─────────────────────────────────────────────────────────────┘
```

- No stage card details (those are private). Just the 4 moment checkmarks and the live URL.
- "Build yours free →" links to the homepage — this doubles as a growth/referral surface.

**6.2 Share button on the completion screen**

On the project detail page (logged-in view), the completion hero block (section 1.1) gets a
"Share" button that copies `https://codesetu.com/p/<id>` to clipboard.

**6.3 API: public project endpoint**

`GET /api/p/:id` — returns project `title`, `prompt`, `status`, `deploymentUrl`,
moment-level completion summary. No auth required. Rate-limited at 60 req/min per IP.

**6.4 Remove badge on Free tier**

On the public page, Free-tier projects show a small "Built with CodeSetu" badge. Pro tier
can remove it.

### Files
- `apps/web/app/p/[id]/page.tsx` — new public view (server component is fine here)
- `apps/server/src/modules/projects/projects.controller.ts` — public endpoint
- `apps/server/src/routes/index.ts` — mount `/p/:id` without `authGuard`
- `apps/web/app/dashboard/[id]/page.tsx` — share button

---

## 7. "Edit after deploy" — post-publish iteration

### Problem
The pipeline is currently one-shot. After deploy, there is no way to make changes.
If the button color is wrong, the user must start a new project from scratch.

### Requirements

**7.1 "Request a change" input on the completed project page**

Below the deployment URL hero block, show a collapsed section:

```
[✏ Make a change]

▼ (expands to:)

What would you like to change?
┌─────────────────────────────────┐
│ e.g. "Make the button blue"     │
└─────────────────────────────────┘
[Send it →]
```

Submitting creates a new pipeline run linked to the same project (`parentProjectId` FK), with
the original prompt + current files as context. The new run goes through a *fast path*:
Implementation → Review → Fixes → Release (skipping Request/PRD/Tasks since those are done).

**7.2 Schema change**

```ts
// packages/database/src/schema.ts — project table
parentProjectId: text("parent_project_id").references(() => project.id),
changeRequest:   text("change_request"),   // the "what to change" text
iteration:       integer("iteration").default(0),
```

**7.3 Fast-path Inngest function**

New `pipeline.change` function triggered by event `pipeline/change`:
- Stages: `implementation` → `review` → `fixes` → `release`.
- Receives `{ projectId, changeRequest, parentProjectId }`.
- Loads the parent's generated files from the `implementation` artifact as context.

**7.4 Dashboard card shows iteration count**

If `iteration > 0`, the project card shows "v2", "v3" etc. as a small badge next to the title.

### Files
- `packages/database/src/schema.ts` — new columns
- `packages/inngest/src/functions/pipeline.ts` — fast-path `pipeline.change` function
- `apps/server/src/modules/projects/projects.controller.ts` — `POST /api/projects/:id/change`
- `apps/web/app/dashboard/[id]/page.tsx` — change request input UI
- `apps/web/app/dashboard/_components/project-card.tsx` — iteration badge

---

## 8. Example gallery on the landing page

### Problem
The landing page has a pipeline animation and a stage showcase, but zero examples of finished
output. A non-technical user can't tell if the result will be a plain white HTML page or
something they'd actually show a client.

### Requirements

**8.1 "Built with CodeSetu" gallery section**

Add a new section between "How it works" and "Pipeline" on `apps/web/app/page.tsx`:

```
What people are building

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ [screenshot]     │  │ [screenshot]     │  │ [screenshot]     │
│ Coffee shop      │  │ Waitlist page    │  │ Portfolio        │
│ landing page     │  │ with email       │  │ with contact     │
│                  │  │ capture          │  │ form             │
│ Built in 4 min   │  │ Built in 3 min   │  │ Built in 5 min   │
│ [Open ↗]         │  │ [Open ↗]         │  │ [Open ↗]         │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

- For launch: use 3–6 curated screenshot images (static, manually added to `apps/web/public/`).
- Each card links to the live deployed URL.
- Cards are horizontally scrollable on mobile.

**8.2 Static data file**

`apps/web/app/_components/gallery-data.ts` — array of `{ title, prompt, screenshot, url, time }`.

### Files
- `apps/web/app/page.tsx` — gallery section
- `apps/web/app/_components/gallery-section.tsx` — new component
- `apps/web/app/_components/gallery-data.ts` — static data
- `apps/web/public/gallery/` — screenshot images

---

## 9. UX micro-fixes (low effort, high polish)

These are small targeted fixes that address specific friction points identified in the walkthrough.

### 9.1 Clarification chips — "Something else →" arrow

**Problem:** The arrow `→` on the "Something else" button implies navigation away from the page.
**Fix:** Replace `Something else →` with `+ Something else` (or use a pencil icon). The dashed
border already communicates "custom input" — the arrow is misleading.

File: `apps/web/app/dashboard/[id]/page.tsx` — `ClarificationsForm` component, line ~356.

---

### 9.2 Approval banner — consistent voice

**Problem:** "Ready to go live?" in the heading and "Looks good — go live →" on the button are
two different framings of the same action.
**Fix:**
- Heading: "Take a look, then approve"
- Subtext: "We've finished building. Preview it below, then give us the go-ahead."
- Button: "Approve and publish →"

File: `apps/web/app/dashboard/[id]/page.tsx` — approval banner block (~line 789).

---

### 9.3 Mobile: "Describe an idea in the box above" empty state

**Problem:** The empty state says "in the box above" but on screens narrower than ~400px the
`NewProjectBox` scrolls above the empty state, so the copy is correct — but on the initial paint
before scroll it can feel like it points nowhere.
**Fix:** Change to: "Use the box at the top of the page to describe your idea."

File: `apps/web/app/dashboard/page.tsx` — `EmptyState` component (~line 236).

---

### 9.4 Progress bar — clickable segments

**Problem:** Progress bar segments have a `title` tooltip but no visual affordance that they're
informative. Users tap them expecting something.
**Fix:** Make each segment a `<button>` that scrolls to its corresponding stage card using
`document.getElementById(stage.type).scrollIntoView({ behavior: "smooth" })`.

File: `apps/web/app/dashboard/[id]/page.tsx` — progress bar section (~line 757).

---

### 9.5 Keyboard shortcut label on mobile

**Problem:** "Press ⌘↵ to start" in `NewProjectBox` is shown via `hidden sm:inline` — correct.
But the mobile layout has no hint about how to submit (no visible submit shortcut, just the button).
**Fix:** On mobile, change the span to show: "Tap the button or press Enter to start" using a
`sm:hidden` span. (Or omit entirely — the button is self-explanatory.)

File: `apps/web/app/dashboard/_components/new-project-box.tsx` — line ~158.

---

### 9.6 Model picker — hide entirely or reframe

**Problem:** "Advanced options" expands to show model names (Claude, GPT-4 etc.). Non-technical
users don't know what these are and the section seeds doubt ("am I picking wrong?").
**Fix (option A):** Remove `ModelPicker` from `NewProjectBox` entirely for now. The default
model is fine for most users.
**Fix (option B):** If keeping it, relabel: "Speed vs quality" toggle — Fast (cheaper, quick)
vs Best (smarter, slower). Map these to the underlying model IDs internally.

File: `apps/web/app/dashboard/_components/new-project-box.tsx` — advanced options block (~line 136).

---

## 10. Custom domain (Pro feature)

### Problem
The deploy target is always a Vercel-subdomain URL. If a user can type `mycoffee.com` and have
it work, they will pay without hesitation. A custom domain is the clearest signal of production
value.

### Requirements

**10.1 Custom domain input on the project settings page**

New `apps/web/app/dashboard/[id]/settings/page.tsx`:

```
Custom domain

┌─────────────────────────────────────────┐
│ www.mycoffee.com                        │
└─────────────────────────────────────────┘
[Save]

DNS instructions (shown after save):
  Add a CNAME record:
  Name: www
  Value: cname.vercel-dns.com
```

**10.2 Vercel domain assignment**

Use the Vercel API (`POST /v10/projects/:projectId/domains`) with `VERCEL_TOKEN` to assign the
domain to the deployed project. Store the custom domain in a new `customDomain` column on the
`project` table.

**10.3 Tier gate**

If the user is on the Free tier, clicking "Add custom domain" shows:
"Custom domains are available on Pro. [Upgrade →]"

### Files
- `packages/database/src/schema.ts` — `customDomain` column
- `apps/web/app/dashboard/[id]/settings/page.tsx` — new settings page
- `apps/server/src/modules/projects/projects.controller.ts` — `POST /api/projects/:id/domain`

---

## Priority order for implementation

| Priority | Section | Effort | Impact |
|----------|---------|--------|--------|
| P0 | 3. Pricing page | Small (UI only) | Blocks all conversions |
| P0 | 1. Surface live URL as hero | Small | Biggest "aha" moment |
| P0 | 4. Completion email | Small | Highest re-engagement |
| P1 | 2. Live preview before approval | Medium | Trust before payment |
| P1 | 5. Non-technical stage labels | Tiny | Immediate comprehension |
| P1 | 9. Micro-fixes (all) | Tiny | Polish, trust signals |
| P2 | 6. Shareable link | Medium | Viral / growth |
| P2 | 8. Example gallery | Small (UI + assets) | Landing conversion |
| P3 | 7. Edit after deploy | Large | Retention / LTV |
| P3 | 10. Custom domain | Large | Upgrade trigger |

---

## Out of scope for this plan

- Payment integration / billing engine (Stripe or Razorpay) — separate plan needed
- User account settings page (email preferences, plan management)
- Admin dashboard / usage analytics
- Mobile app
- Team collaboration features beyond the Pro tier placeholder
