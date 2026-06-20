# Ms. Ellis — Profesora de inglés (AgentFamily / VARIANTES)

> **REGLA DURA — LEER ANTES DE TOCAR.** Ms. Ellis está migrada a una **AgentFamily** (un agente lógico con **7 variantes**: `nivelador` + `a1..c2`). El ruteo entre niveles es con la tool **`switch_variant`** (NO `transfer_to_department`).
> **NO uses `import_agent_json` sobre `agents/ms_ellis_*.json`** — esos seeds son **legacy** (modelo viejo `transfer_to_department`) y reimportarlos **revierte la family y rompe las variantes**. Para editar, usá la family (ver _Cómo editar_ abajo).

| Dato | Valor |
|---|---|
| Tenant | `69cfa71f02a3b484fd9cecbc` (tenant de la plataforma/demos) |
| Family id | `6a344975524b9e2d93406f40` (slug `ms-ellis`, entry `nivelador`) |
| Fuente de verdad | `agent-families/ms-ellis.json` (este repo) |
| apiKey del demo | `agent_cd6263de95644349b7b525051ad728de` → variante `nivelador` (en `EnglishTeacherDemoPage.tsx`) |

Cada variante se **materializa como un agente real** (mismo `_id`, preserva apiKey + bases de conocimiento). Por eso al listar agentes aparecen los 7 tiers: **es esperado**, no son duplicados.

## Variantes y ruteo (`switch_variant`)

| Variante | agentId | Deriva a (`handoffTargets`) |
|---|---|---|
| `nivelador` (entry) | `69fe4c99894181eaa0a84235` | a1, a2, b1, b2, c1, c2 |
| `a1` | `6a31f42d0bff04d6abbd5d7f` | a2, nivelador |
| `a2` | `6a31f42e0bff04d6abbd5d83` | b1, nivelador |
| `b1` | `6a31f42e0bff04d6abbd5d87` | b2, nivelador |
| `b2` | `6a31f42e0bff04d6abbd5d8b` | c1, nivelador |
| `c1` | `6a31f42e0bff04d6abbd5d8f` | c2, nivelador |
| `c2` | `6a31f42f0bff04d6abbd5d93` | nivelador |

El materializer arma `switch_variant.params.variants` desde los `handoffTargets` (sin ids hardcodeados en los prompts).

## Cómo editar (la forma correcta)

1. `export_agent_family(familyId: "6a344975524b9e2d93406f40")` → actualiza `agent-families/ms-ellis.json`.
2. Editá `agent-families/ms-ellis.json` (`base` + `variants[].overrides`).
3. `import_agent_family(filePath: "./agent-families/ms-ellis.json")` (full-replace, reconcilia por `key`, in-place).
4. `publish_agent_family(familyId: "6a344975524b9e2d93406f40")`.

Para una variante puntual: `update_family_variant(familyId, variantKey, { overrides })` + `publish_agent_family`. El script `scripts/migrate_ms_ellis_family.mjs` tiene modos `--verify` / `--convert-switch` / `--apply` para operaciones masivas (con backups en `/tmp/ms_ellis_backup`).

## Flujo

1. **Nivelador** (entry): perfil del alumno (nombre/edad/intereses) → objetivo → evalúa (adaptativo, `present_quiz` en texto y voz) → `save_user_memory` (`english_level`, `learning_goal`) → **`switch_variant`** al nivel con `handover_context`.
2. **Variante de nivel**: lee el handover (no repregunta) → recorre su temario un tema por vez con gate de dominio → evaluación final → si aprueba, **`switch_variant`** al nivel siguiente; si no, refuerza. Puede volver al `nivelador`.
3. El **objetivo** y el progreso persisten en memoria (`memoryNamespace: ms_ellis`, compartido entre variantes) + handover, así todos los niveles personalizan ejemplos/ejercicios.

### Criterios por nivel

| Nivel | Eval final | Producción | Español/Inglés |
|---|---|---|---|
| A1 | quiz 8 preg ≥75% | — | ~70% español |
| A2 | quiz 8 preg ≥75% | — | ~50% español |
| B1 | quiz 10 preg ≥80% | + tarea de producción | ~20% español |
| B2 | quiz 10 preg ≥80% | + tarea de producción | inglés (ES si lo piden) |
| C1 | quiz 10-12 preg ≥85% | + producción extendida | 100% inglés |
| C2 | quiz 12 preg ≥85% | + producción exigente | 100% inglés — **certifica** (sin nivel superior) |

## Seeds legacy (`agents/ms_ellis_*.json`)

Esos 7 JSON son el **modelo viejo** (`transfer_to_department`, pre-family). Se conservan **solo** porque `scripts/migrate_ms_ellis_family.mjs` los usa para descubrir los agentes por `name`. **NO los re-importes con `import_agent_json`** (revierten la family y desvinculan las variantes). La fuente de verdad vigente es `agent-families/ms-ellis.json`.

> ⚠️ Toda operación de family impacta **producción** (`api.botuyo.com`). Desde esta red corporativa (Netskope) los scripts necesitan `NODE_EXTRA_CA_CERTS` apuntando a la CA de Netskope para el TLS.

## Requisito del fix de quiz en voz
Todos los agentes ya incluyen `present_quiz` en `enabledTools`. El backend (VoiceSessionComposer) ahora obliga a usar `present_quiz` en voz, así los botones aparecen también en la llamada.

## Web Push — "próxima clase" (`suggest_next_class`)
Los **6 agentes de nivel** (a1–c2) incluyen ahora `suggest_next_class` en `enabledTools` y en el stage `teach`. Al cerrar la sesión, Ms. Ellis **sugiere** la próxima clase; la tool emite un client event `suggest_next_class` `{ scheduledAt, title?, body? }` que el frontend renderiza como la tarjeta "Próxima clase" con el botón "Activar recordatorio". El alumno **confirma** y recién ahí se suscribe al push y se agenda el recordatorio (diseño "Ambos"). El `nivelador` NO la incluye (solo nivela).

> ⚠️ **Orden de despliegue**: la tool `SuggestNextClassTool` debe estar **desplegada en el backend** antes de re-importar estos 6 JSON (si no, el nombre se ignora). Además, para que el push se entregue de verdad, el backend necesita las VAPID (`WEBPUSH_VAPID_PUBLIC/PRIVATE/SUBJECT`) seteadas en prod. Para aplicar cambios de estos prompts, editá la family (`agent-families/ms-ellis.json`) y usá `import_agent_family` + `publish_agent_family` — **nunca** `import_agent_json` sobre los seeds.
