# G-Buddy — Contexto do Projeto

## Visão Geral

**G-Buddy** é um companheiro de cultivo baseado em IA com foco em voz (voice-first). É uma aplicação web construída com **Next.js 15** que oferece monitoramento ambiental em tempo real, registros por voz e orientação de cultivo com IA.

### Princípios Core

1. **100% Dados Locais** — Todos os dados ficam no dispositivo do usuário (IndexedDB)
2. **Sem Autenticação** — Zero barreira de entrada
3. **Sem Dependência de Cloud** — Funciona offline
4. **Privacidade Total** — Sem contas, sem rastreamento, sem armazenamento em nuvem

### Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Framework** | Next.js 15 (App Router) |
| **Linguagem** | TypeScript (strict mode) |
| **UI** | React 19 + Tailwind CSS |
| **Gráficos** | Recharts |
| **Ícones** | Lucide React |
| **IA** | Groq AI (LLM) |
| **TTS** | Inworld TTS / Browser Speech API |
| **Storage** | IndexedDB (client-side) |
| **Export** | XLSX (via `xlsx`), JSON |
| **Testes** | Jest + ts-jest |
| **PWA** | Service Worker (`public/sw.js`) |

---

## Estrutura de Diretórios

```
Release-v2/
├── src/
│   ├── app/
│   │   ├── page.tsx                     # Redirect raiz → /dashboard
│   │   ├── dashboard/page.tsx           # UI principal do app
│   │   ├── api/
│   │   │   ├── conversations/route.ts   # Operações de chat (IndexedDB)
│   │   │   ├── groq/route.ts            # Proxy para Groq AI
│   │   │   ├── health/route.ts          # Health check
│   │   │   ├── plants/route.ts          # Operações de plantas
│   │   │   ├── tts/route.ts             # Text-to-speech
│   │   │   └── weather/route.ts         # Dados climáticos
│   │   └── manifest.ts                  # PWA manifest
│   ├── components/
│   │   └── dashboard/                   # Componentes da UI principal
│   └── lib/
│       ├── indexeddb-storage.ts         # Cliente IndexedDB
│       ├── grow-math.ts                 # Cálculos: VPD, EC, pH, nutrientes
│       ├── nutrient-logic.ts            # Lógica de nutrientes Canna Aqua
│       ├── types.ts                     # Tipos TypeScript
│       ├── groq-ai.ts                   # Integração Groq
│       ├── tts.ts                       # Text-to-speech
│       ├── i18n.ts                      # Internacionalização
│       ├── validation.ts                # Validação de dados
│       ├── buildGrowContext.ts          # Contexto para prompts IA
│       ├── config.ts                    # Configurações (VPD targets, etc.)
│       ├── env.ts                       # Validação de env vars
│       ├── excel-export.ts              # Export XLSX
│       ├── excel-storage.ts             # Storage via Excel
│       ├── plants-store.ts              # Store de plantas
│       ├── newplant-data.ts             # Templates de criação de planta
│       ├── vpd-utils.ts                 # Utilitários VPD
│       └── uuid.ts                      # Geração de UUIDs
├── public/
│   ├── sw.js                            # Service Worker (offline)
│   ├── gbuddy-icon.svg                  # Logo
│   └── g-icon.png                       # Favicon
├── docs/
│   ├── ARCHITECTURE.md                  # Documentação de arquitetura
│   └── DEVELOPMENT_PLAN.md              # Plano de desenvolvimento
├── g-data/                              # Dados auxiliares/scripts
├── electron/                            # (vazio, futuro Electron desktop)
├── .claude/                             # Configurações Claude
└── .codex-logs/                         # Logs de desenvolvimento
```

---

## Modelos de Dados

### Tipos Principais (`src/lib/types.ts`)

- **`PlantProfile`** — Perfil completo de uma planta (strain, estágio, luz, água, clima, notas, receita de nutrientes)
- **`GrowStage`** — `"Seedling" | "Veg" | "Bloom"`
- **`WateringEntry`** — Evento de rega (amountMl, pH, EC, runoff)
- **`ClimateEntry`** — Dados climáticos (tempC, humidity)
- **`ChatMessageEntry`** — Mensagem de chat (role, content, plantId)
- **`FeedRecipe`** — Receita de nutrientes (baseA, baseB, CalMag, additives)
- **`LightProfile`** — Configuração de iluminação
- **`GrowCommand`** — Comandos estruturados para IA (update_plant, add_watering, etc.)

### IndexedDB Stores

| Store | Descrição |
|-------|-----------|
| `plants` | Perfis de plantas (keyPath: `id`) |
| `settings` | Configurações KV (active plant, AI config) |
| `chat_messages` | Mensagens de chat indexadas por `plantId` |

---

## Comandos Principais

```bash
# Desenvolvimento
npm run dev          # Inicia Next.js dev server (localhost:3000)

# Build e produção
npm run build        # Build de produção
npm start            # Inicia servidor de produção

# Qualidade de código
npm run lint         # Next.js ESLint
npm run typecheck    # TypeScript --noEmit

# Testes
npm test             # Executa Jest
npm run test:watch   # Jest em modo watch
```

### Quick Start (Windows)

```bat
Run-GBuddy.bat       # Script que instala deps, build e abre browser
```

### Quick Start (Manual)

```bash
npm install
cp .env.local.example .env.local  # Adicionar chaves de API
npm run build
npm start
# Abrir http://localhost:3000/dashboard
```

---

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `NEXT_PUBLIC_GROQ_API_KEY` | Chave API Groq (LLM) |
| `NEXT_PUBLIC_INWORLD_API_KEY` | Chave API Inworld (TTS) |

---

## Fluxo de Dados

1. Usuário grava nota de voz no dashboard (Web Speech API)
2. Speech-to-text produz transcrito
3. Transcrito é enviado ao LLM (Groq) para extração estruturada
4. Dados validados são armazenados no IndexedDB
5. Dashboard consulta dados locais e renderiza gráficos
6. Respostas IA usam TTS (Inworld ou browser)

---

## Cálculos e Utilitários

### VPD (Vapor Pressure Deficit)

Fórmula Magnus implementada em `grow-math.ts`:
- `SVP = 0.6108 * exp((17.27 * T) / (T + 237.3))`
- `VP = SVP * (RH / 100)`
- `VPD = SVP - VP`

Targets por estágio definidos em `config.ts`.

### Nutrientes (Canna Aqua)

- Períodos de nutrientes definidos em `CANNA_AQUA_PERIODS`
- Cálculos de dosagem por litro e EC target
- Escala PPM: **500** (Hanna)

---

## Convenções de Desenvolvimento

- **TypeScript strict mode** — sem `any` sem justificativa
- **Path aliases** — `@/*` resolve para `./src/*`
- **Cálculos puros** — utilitários em módulos TypeScript puros
- **Storage abstraído** — IndexedDB via repositório em `indexeddb-storage.ts`
- **Validação** — outputs de LLM validados antes de salvar
- **Componentes** — React Server Components com client components onde necessário

---

## Deployment (Vercel)

1. Push para GitHub
2. Conectar repo no Vercel
3. Adicionar env vars (`NEXT_PUBLIC_GROQ_API_KEY`, `NEXT_PUBLIC_INWORLD_API_KEY`)
4. Deploy automático

---

## Notas de Arquitetura

- **Local-first**: todos os dados no IndexedDB do browser
- **Offline-first**: service worker cached app shell
- **Sem backend**: API routes são proxies para serviços externos (Groq, TTS, Weather)
- **Export**: XLSX para planilhas, JSON para backup completo
- **Futuro**: Electron desktop app, PWA install, share by link
