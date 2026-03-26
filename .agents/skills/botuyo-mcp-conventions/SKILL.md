---
name: BotUyo MCP Architecture and Testing Rules
description: Defines the project structure layout and strict requirements for ensuring 100% functionality verification on any new code or change.
---

# 🤖 BotUyo MCP Architecture & Testing Standards

Esta skill es de lectura OBLIGATORIA al iniciar cualquier tarea u operación sobre el proyecto `botuyo-mcp`. Define la estructura del repositorio y establece la política estricta de validación del 100% en todos los cambios y agregados.

## 🏗️ Estructura del Proyecto (Project Structure)

El proyecto es un servidor MCP desarrollado en TypeScript. Todo el código fuente reside en el directorio `src/`.

*   **`src/index.ts`**: Archivo principal del servidor MCP (`@modelcontextprotocol/sdk`). Contiene la inicialización del servidor, el registro de herramientas (tools) y recursos.
*   **`src/client.ts`**: Capa de cliente HTTP dedicada a la comunicación asincrónica con la API core de BotUyo (manejo de endpoints).
*   **`src/tools/`**: Implementación individual de las herramientas (tools) expuestas por el servidor MCP, como `create_agent`, `update_agent`, `delete_agent`, `upsert_stage`, etc. Al agregar o modificar una tool, se debe hacer en su respectivo archivo aquí y luego importarse e integrarse en `index.ts`.
*   **`src/commands/`**: Comandos y módulos auxiliares para autenticación (`login.ts`, `auth.ts`), cambio de tenantes (`switch_tenant.ts`), y flujos de setup del usuario en la CLI (`setup.ts`).
*   **`dist/`**: Código compilado emitido por `tsc`. Node.js ejecuta este código (según el script `"start"`).

## 🛡️ Política Estricta de Testing (100% Funcionalidad Comprobada)

Es una regla infranqueable de este proyecto que **TODO CÓDIGO NUEVO, MODIFICACIÓN O REFACTORIZACIÓN DEBE SER TESTEADO Y CORROBORADO AL 100%**.

Para cumplir con este requisito, como Agente debes realizar y documentar siempre lo siguiente ante cualquier cambio:

1.  **Validación de Compilación (TypeScript)**:
    *   Ejecutar siempre el compilador de TypeScript y asegurarse de que no haya ni un solo error o advertencia en los tipos.
    *   Comando para usar: `npm run build` o `npx tsc --noEmit`. No se considera ninguna tarea como finalizada hasta que este paso sea exitoso sin excepciones.

2.  **Verificación Funcional Obligatoria**:
    *   Si se agrega una herramienta nueva en `src/tools/`, debe testearse activamente usando herramientas de inspección MCP, o armando un log/script local para asegurar que la lógica interna (los llamados al `client.ts`) funciona correctamente, se envían los payloads adecuados, y las respuestas se devuelven en el formato MCP requerido.
    *   Si hay tests automatizados disponibles, correrlos siempre. Si no los hay, redactar un archivo temporal `/tmp/test.ts` para ejecutar el código particular del cambio y confirmar visualmente que el flujo de datos no arroje errores en tiempo de ejecución.

3.  **Auditoría de Impacto**:
    *   Verificar que un pequeño cambio en `src/client.ts` o un archivo compartido no rompa otras tools de MCP.
    *   En caso de existir linter implementado en el stack (`npm run lint`), debes correrlo y resolver todas las quejas.

✅ **Resumen:**
No des ninguna tarea por completada sin antes proveer pruebas palpables (salida de logs, comandos exitosos de test/build) que demuestren fehacientemente que la funcionalidad agregada opera en su totalidad y al 100% de la eficiencia esperada.
