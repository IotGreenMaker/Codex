# G-Buddy Development Plan

> **Last Updated:** April 5, 2026
> **Version:** 0.3.0
> **Philosophy:** Local-first, privacy-focused, zero friction

---

## Core Principles

1. **100% Local Data** - All data stays on the user's device (IndexedDB)
2. **No Authentication Required** - Zero entry barrier for new users
3. **No Cloud Dependency** - Works offline, forever
4. **Share by Link** - Free distribution, no sign-up walls
5. **Visual Identity** - Attractive, memorable branding

---
## Manual TO DO List 
1 - Remove the testing button, called Add test plants and remove all the logic relates to it,  and check if need to separate from the logic of Create New Plant - OK
2 - Climate, VPD, Water Data cards on the dashboard, need to remove the editable feature, and check the faulty logic of updating it with the latest table info , and remove the total days card that is commented -OK
3 - Watering table and Activity feed, The ligic on the FEED colunm from the table has faulty logic, It should ommit the feeding on the related watering event, not on the Suggested next feed recipe ,  
4 - AI Config modal, need to be checked, the Inworld API key might not be included on the API call , add the view password button to the api inputs - save button can refresh the page -- OK 
5 - New -  Fix move to the right and make it always visible, the AI voice Speaker Icon and make it function for muting the voice when clicked - OK
6.1 - The Export, Change the Esxel for a themed Json or CSV inside a Gbudyd Style template , a  
6.2 - The Import,  Develop A button to "import" a new plant that will import data from a JSon or CSV (made from the app), and the logging will continue from there 
7 - Better Format the tables and masks for easier manual input 
8 - Set the default measument units to PMM on 500 scale always 
9 - Apply the logo on the header with a animated glow drop shadow 
10 - Review the light hours dashboard card mobile layout 
11 - Nutrient Calculator small layout review put the "target convesion" near the input with better styling.
12 - The VPD Chart should detect automatically the plant stage and last table input value.
13 - Activity Feed style the stage event cards with the color and bigger icons 
14 - Fix The vercel access through homepage, and apply logo to homepage
15 - Improove the Setup Section with more relatable info of the grow space and add it to the AI context to help on relevant decisions add the outside weather data so when asked he "knows" if it is colder or hotter or humidy or dryer outside, so he can give advices like, increase ventilation or increase humidity basicaly looking at the two climate data the inddor and outdoor  
 16 - *Achitecture - Thake a look on the data structure to avoid conflict and redundancy, plot it in a .md and edit with notes 
17 - AI chat Panel, check the logic for the STT, it's not transcribing and showing on the prompt in real time as it did before increase the input time as now whena take a bit of time in my speech it send the message inclepe, eg. new weather 25 degrees  -speech gap- and 43 percent humidity --- THe assitant is geting the message before I inform Humidity , taking 2 request to one action , 

18 -  Check deleting the climate and watering data - OK  
19 - when asking the AI assitnat about the last watering event it is creating a new occourance on the table, wich is not the desired behaviour - he should onl read and inform the data
20 - Some AI responses are shoing duplicated and unfformatted on the chat - Watering logged with 1L of water, pH 5.8, and EC 1.4 (700 PPM). { "message": "Watering logged.", "watering": { "amountMl": 1000, "ph": 5.8, "ec": 1.4 } }



## Current Tech Stack

### Frontend
- **Next.js 15** with React 19 (App Router)
- **TypeScript** (strict mode enabled)
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Lucide React** for icons

### Backend (Minimal)
- **Next.js API Routes** (serverless functions for AI proxy)
- **Groq AI** (LLM for AI assistant - requires API key)
- **Inworld TTS** (voice synthesis - optional, requires API key)
- **Weather API** (local weather data)

### Storage
- **IndexedDB** (client-side local storage - primary)
- **Excel Export** (backup via xlsx)
- **JSON Export** (full backup capability)

### Testing
- **Jest** with ts-jest (20 unit tests passing)

---

## Development Roadmap

### Phase 1: Visual Identity & Branding (Week 1)

| Task | Description | Tools |
|------|-------------|-------|
| **Logo Design** | Create a distinctive plant/AI icon (SVG) | See AI Tools below |
| **Color Palette** | Define brand colors (current: lime green theme) | Coolors.co, Adobe Color |
| **Typography** | Choose consistent font pairing | Google Fonts |
| **App Icon** | 192x192, 512x512 for PWA | Figma, Canva |
| **Splash Screen** | Loading screen with logo | Built in code |
| **Brand Guidelines** | Simple doc with colors, fonts, logo usage | Notion, Google Docs |

#### Recommended AI Tools for Logo & Assets

| Tool | Use Case | Cost | URL |
|------|----------|------|-----|
| **Claude 3.5 Sonnet** | Generate SVG logos, icons, illustrations | Free tier | claude.ai |
| **Midjourney v6** | High-quality brand imagery, mood boards | $10/mo | midjourney.com |
| **DALL-E 3** | Quick concept images, social media assets | Free via ChatGPT | chatgpt.com |
| **Recraft.ai** | Vector icons, illustrations, SVG export | Free tier | recraft.ai |
| **Figma AI** | Design system, icon sets, UI components | Free tier | figma.com |
| **Canva AI** | Social media posts, banners, presentations | Free tier | canva.com |
| **Iconify** | Open-source icon library | Free | iconify.design |
| **SVGRepo** | Free SVG icons | Free | svgrepo.com |

#### Prompt Examples for Logo Generation

```
Claude/Midjourney prompt:
"Create a minimalist logo for a plant growing app called G-Buddy. 
The design should combine a leaf/sprout with a chat bubble or AI brain. 
Style: clean, modern, flat design. Colors: lime green (#84cc16) and dark slate. 
Output as SVG-friendly vector style."
```

---

### Phase 2: Onboarding Experience (Week 1-2)

| Task | Description |
|------|-------------|
| **Welcome Modal** | Beautiful first-run experience with logo and tagline |
| **Feature Tour** | 2-step interactive walkthrough |
| **First Plant Flow** | Guided "Add Your First Plant" experience |
| **Empty State Design** | Attractive screens when no data exists |
| **Tutorial Tooltips** | Contextual hints on first use |


### Phase 3: PWA & Distribution (Week 2)

| Task | Description |
|------|-------------|
| **PWA Manifest** | app name, icons, theme colors |
| **Service Worker** | Cache app shell for offline |
| **Install Prompt** | Custom "Add to Home Screen" prompt |
| **Share by Link** | Export plant data as encoded URL |
| **Import from Link** | Open shared grow data via URL |

#### PWA Configuration

```json
{
  "name": "G-Buddy - AI Grow Companion",
  "short_name": "G-Buddy",
  "description": "Your AI-powered grow companion. 100% private.",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#84cc16",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

### Phase 4: Data Portability (Week 2-3)

| Task | Description |
|------|-------------|
| **Export to JSON** | Full backup file download |
| **Import from JSON** | Restore from backup |
| **Export to Excel** | Already implemented ✅ |
| **QR Code Share** | Generate QR for quick data sharing |
| **Encrypted Sharing** | Optional password-protected shares |

#### Share by Link Architecture

```
User A: Export plant data → Encoded JSON in URL hash
        ↓
URL: gbuddy.app/share#eyJwbGFudHMiOlt7ImlkIjoi...
        ↓
User B: Opens link → Data decoded from URL hash
        ↓
User B: Views shared grow data (read-only)
```

**Benefits:**
- No server storage needed
- No authentication required
- Data lives in the URL (client-side only)
- Works with any static host

---

### Phase 5: Polish & Launch (Week 3-4)

| Task | Description |
|------|-------------|
| **Error Pages** | Custom 404, error boundary |
| **Loading States** | Skeleton screens |
| **Performance** | Optimize bundle size, lazy loading |
| **Landing Page** | Simple homepage with features |
| **Documentation** | User guide, FAQ |

---

### Phase 6: Responsive Testing (Ongoing)

| Task | Description | Tools |
|------|-------------|-------|
| **Mobile Testing** | Test on iOS Safari, Android Chrome | Physical devices, BrowserStack |
| **Tablet Testing** | iPad, Android tablet layouts | Physical devices |
| **Desktop Testing** | Chrome, Firefox, Safari, Edge | DevTools |
| **Automated Testing** | Screenshot regression | Playwright, Percy |
| **Performance Testing** | Lighthouse scores | Chrome DevTools |

#### Recommended Testing Tools

| Tool | Use Case | Cost | URL |
|------|----------|------|-----|
| **Chrome DevTools** | Responsive design mode, Lighthouse | Free | Built into Chrome |
| **Playwright** | Automated cross-browser testing | Free | playwright.dev |
| **BrowserStack** | Real device testing cloud | $29/mo | browserstack.com |
| **Responsively App** | Multi-device preview | Free | responsively.app |
| **Lighthouse CI** | Automated performance audits | Free | GitHub Actions |
| **Vercel Preview** | Share test deployments | Free tier | vercel.com |

#### Responsive Breakpoints

```css
/* Tailwind default breakpoints (we use these) */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet portrait */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

#### Testing Checklist

- [ ] **320px** - Small phones (iPhone SE)
- [ ] **375px** - Standard phones (iPhone 13)
- [ ] **414px** - Large phones (iPhone 14 Pro Max)
- [ ] **768px** - Tablet portrait (iPad)
- [ ] **1024px** - Desktop (laptop)
- [ ] **1440px** - Large desktop
- [ ] **Touch targets** - All buttons >= 44x44px
- [ ] **Font sizes** - Readable at all breakpoints
- [ ] **Charts** - Responsive and readable
- [ ] **Modals** - Full screen on mobile
- [ ] **Forms** - Keyboard doesn't hide inputs
- [ ] **PWA install** - Works on iOS and Android

---

## File Structure

```
Release-v2/
├── docs/
│   ├── ARCHITECTURE.md
│   └── DEVELOPMENT_PLAN.md    ← This file
├── public/
│   ├── gbuddy-icon.svg        # Logo
│   ├── manifest.json          # PWA config
│   ├── icons/
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   └── maskable-icon.png
│   └── og-image.png           # Social sharing preview
├── src/
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── dashboard/page.tsx   # Main app
│   │   ├── share/page.tsx     # View shared data
│   │   ├── error.tsx          # Error boundary
│   │   ├── not-found.tsx      # 404 page
│   │   └── loading.tsx        # Loading skeleton
│   ├── components/
│   │   ├── onboarding/
│   │   │   ├── welcome-modal.tsx
│   │   │   ├── feature-tour.tsx
│   │   │   └── first-plant-flow.tsx
│   │   └── ...
│   └── lib/
│       ├── share.ts           # Encode/decode share URLs
│       └── ...
└── ...
```

---

## Distribution Channels

| Channel | Method | Cost |
|---------|--------|------|
| **Direct Link** | Share URL via WhatsApp, Telegram | Free |
| **GitHub Pages** | Host at `iotgreenmaker.github.io/gbuddy` | Free |
| **Vercel** | Custom domain `gbuddy.io` | Free tier |
| **QR Code** | Print on grow tents, stickers | Free |
| **USB/Local** | Run from USB stick (no internet) | Free |

---

## AI Models Reference

### For AI Assistant (In-App)

| Model | Provider | Use Case | Cost |
|-------|----------|----------|------|
| **llama-3.3-70b-versatile** | Groq | Current AI assistant | Free tier available |
| **llama-3.1-8b-instant** | Groq | Faster, cheaper alternative | Free tier available |
| **mixtral-8x7b-32768** | Groq | Long context (32k tokens) | Free tier available |
| **gpt-4o-mini** | OpenAI | Alternative model | $0.15/1M tokens |

### For Asset Creation (Development)

| Model | Provider | Best For | Access |
|-------|----------|----------|--------|
| **Claude 3.5 Sonnet** | Anthropic | SVG generation, code, copy | claude.ai (free) |
| **GPT-4o** | OpenAI | Image generation, copy | chatgpt.com (free) |
| **DALL-E 3** | OpenAI | Quick concept images | chatgpt.com (free) |
| **Stable Diffusion XL** | Stability AI | High-res images | stability.ai |
| **Midjourney v6** | Midjourney | Artistic brand imagery | $10/mo |

---


---

## Quick Start for New Developers

1. Clone repo: `git clone https://github.com/IotGreenMaker/Codex.git`
2. Install: `npm install`
3. Copy `.env.local.example` → `.env.local`
4. Run: `npm run dev`
5. Tests: `npm test`

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-04-05 | 0.3.0 | Local-first plan, AI tools, responsive testing |
| 2026-04-05 | 0.2.0 | Code improvements, unit tests, validation |
| 2026-04-01 | 0.1.0 | Initial architecture |