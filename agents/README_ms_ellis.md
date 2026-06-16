# Ms. Ellis — Sistema multi-agente de inglés (7 agentes)

Profesora de inglés con **1 nivelador + 6 agentes de nivel (A1–C2)** que se conmutan con la tool `transfer_to_department` (cambia el `activeAgentId` de la conversación de forma transparente).

## Archivos

| Archivo | Rol | Transfiere a |
|---|---|---|
| `ms_ellis_nivelador.json` | Entrada. Detecta nivel CEFR + objetivo, deriva. | a1, a2, b1, b2, c1, c2 |
| `ms_ellis_a1.json` | Beginner. Temario A1 + eval final. | a2 (promoción), nivelador |
| `ms_ellis_a2.json` | Elementary. | b1, nivelador |
| `ms_ellis_b1.json` | Intermediate. | b2, nivelador |
| `ms_ellis_b2.json` | Upper-Int. | c1, nivelador |
| `ms_ellis_c1.json` | Advanced. | c2, nivelador |
| `ms_ellis_c2.json` | Mastery. | nivelador |

> El `apiKey` del widget en la demo (`EnglishTeacherDemoPage.tsx`) debe apuntar al **nivelador**.

## Flujo

1. **Nivelador**: pregunta el objetivo del alumno → evalúa (adaptativo, `present_quiz` en texto y voz) → `save_user_memory` (`english_level`, `learning_goal`) → `transfer_to_department` al nivel con `handover_context`.
2. **Agente de nivel**: lee el handover (no repregunta) → recorre su temario (Grammar / Vocabulary / Functions) → evaluación final → si aprueba, `transfer_to_department` al nivel siguiente; si no, refuerza. Puede volver al `nivelador`.
3. El **objetivo** persiste en memoria + handover, así todos los niveles personalizan ejemplos/ejercicios.

### Criterios por nivel

| Nivel | Eval final | Producción | Español/Inglés |
|---|---|---|---|
| A1 | quiz 8 preg ≥75% | — | ~70% español |
| A2 | quiz 8 preg ≥75% | — | ~50% español |
| B1 | quiz 10 preg ≥80% | + tarea de producción | ~20% español |
| B2 | quiz 10 preg ≥80% | + tarea de producción | inglés (ES si lo piden) |
| C1 | quiz 10-12 preg ≥85% | + producción extendida | 100% inglés |
| C2 | quiz 12 preg ≥85% | + producción exigente | 100% inglés — **certifica** (sin nivel superior) |

## Import (hay orden obligatorio por el chicken-egg de los agentId)

> ⚠️ Estas operaciones impactan **producción** (`api.botuyo.com`). Corrélas vos cuando estés listo.

**Fase 1 — Crear los 7 agentes (obtener sus IDs):**
Usá la tool MCP `create_agent` para cada uno (nivelador + a1..c2). Anotá el `agentId` (Mongo) que devuelve cada uno.

| Agente | agentId real |
|---|---|
| nivelador | `__________` |
| a1 | `__________` |
| a2 | `__________` |
| b1 | `__________` |
| b2 | `__________` |
| c1 | `__________` |
| c2 | `__________` |

**Fase 2 — Reemplazar placeholders:**
En cada JSON, cambiá los tokens `<AGENT_ID_*>` del bloque `toolConfigs.transfer_to_department.params.departments` por los IDs reales de la tabla.
- `ms_ellis_nivelador.json`: completar a1, a2, b1, b2, c1, c2.
- `ms_ellis_a1.json`: a2 + nivelador. `a2.json`: b1 + nivelador. `b1.json`: b2 + nivelador. `b2.json`: c1 + nivelador. `c1.json`: c2 + nivelador. `c2.json`: nivelador.

**Fase 3 — Importar cada config:**
`import_agent_json` con `agentId` (el real) y `filePath` (el JSON). Ej: `import_agent_json(agentId: "<ID_NIVELADOR>", filePath: "./agents/ms_ellis_nivelador.json")`.

**Fase 4 — Publicar y apuntar el widget:**
Publicá los 7 agentes y poné el `apiKey` del **nivelador** en `EnglishTeacherDemoPage.tsx`.

## Requisito del fix de quiz en voz
Todos los agentes ya incluyen `present_quiz` en `enabledTools`. El backend (VoiceSessionComposer) ahora obliga a usar `present_quiz` en voz, así los botones aparecen también en la llamada.
