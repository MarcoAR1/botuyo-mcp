/**
 * npx @botuyo/mcp setup
 *
 * Complete onboarding flow:
 * 1. Write the mcp.json config file for the user's editor
 * 2. Offer to login via email/password or OAuth browser
 */

import * as readline from 'readline'
import { readCredentials } from './credentials.js'
import { runLogin } from './login.js'
import { runAuth } from './auth.js'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { join, sep } from 'path'
import { existsSync } from 'fs'

interface EditorOption {
  name: string
  configPath: string
  description: string
}

const EDITORS: EditorOption[] = [
  { name: 'Cursor', configPath: `.cursor${sep}mcp.json`, description: '.cursor/mcp.json' },
  { name: 'VS Code / Antigravity', configPath: `.vscode${sep}mcp.json`, description: '.vscode/mcp.json' },
  { name: 'Claude Desktop', configPath: getClaudeConfigPath(), description: 'claude_desktop_config.json' }
]

function getClaudeConfigPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || ''
  if (process.platform === 'win32') {
    return join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json')
  }
  return join(home, '.config', 'claude', 'claude_desktop_config.json')
}

function getAntigravityConfigPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || ''
  return join(home, '.gemini', 'antigravity', 'mcp_config.json')
}

function buildServerBlock() {
  return {
    botuyo: {
      command: 'npx',
      args: ['-y', '@botuyo/mcp']
    }
  }
}

export async function runSetup(args: string[]): Promise<void> {
  console.log('')
  console.log('  ╔══════════════════════════════════════╗')
  console.log('  ║     🤖 BotUyo MCP — Setup            ║')
  console.log('  ╚══════════════════════════════════════╝')
  console.log('')

  // ── Step 1: Configure editor ───────────────────────────────────────────────

  console.log('  📦 Paso 1: Configurar tu editor\n')

  let selectedEditor: EditorOption | undefined

  // Auto-detect editor
  const detected = autoDetect()
  if (detected) {
    console.log(`  📍 Detectado: ${detected.name} (${detected.description})`)
    const confirm = await prompt('  ¿Configurar este editor? (S/n): ')
    if (confirm.toLowerCase() !== 'n') {
      selectedEditor = detected
    }
    console.log('')
  }

  // Interactive menu if not auto-detected
  if (!selectedEditor) {
    console.log('  ¿Para qué editor querés configurar BotUyo?\n')
    for (let i = 0; i < EDITORS.length; i++) {
      console.log(`    ${i + 1}. ${EDITORS[i].name}`)
    }
    console.log(`    ${EDITORS.length + 1}. Solo mostrar config (copiar manual)`)

    const choice = await prompt('\n  Elegí una opción: ')
    const choiceNum = parseInt(choice, 10)
    console.log('')

    if (choiceNum >= 1 && choiceNum <= EDITORS.length) {
      selectedEditor = EDITORS[choiceNum - 1]
    } else {
      // Print snippet and continue to login
      console.log('  Agregá esto a tu archivo mcp.json:\n')
      console.log('  ' + JSON.stringify({ servers: buildServerBlock() }, null, 2).split('\n').join('\n  '))
      console.log('')
    }
  }

  // Write config file if editor selected
  if (selectedEditor) {
    await writeConfigFile(selectedEditor)
  }

  // Always configure Antigravity (independent of editor choice)
  await writeAntigravityConfig()

  // ── Step 2: Authentication ─────────────────────────────────────────────────

  console.log('  ─────────────────────────────────────────')
  console.log('  🔐 Paso 2: Autenticación\n')

  const creds = await readCredentials()
  if (creds?.token) {
    const expired = creds.expiresAt && new Date(creds.expiresAt) < new Date()
    if (!expired) {
      console.log(`  ✅ Ya estás autenticado`)
      console.log(`     Email:  ${creds.email}`)
      console.log(`     Tenant: ${creds.tenantName} (${creds.role})`)
      console.log(`     Expira: ${new Date(creds.expiresAt).toLocaleDateString()}\n`)
      console.log('  ══════════════════════════════════════════')
      console.log('  ✅ Setup completo. ¡Ya podés usar el MCP!\n')
      process.exit(0)
    }
    console.log('  ⚠️  Tu sesión expiró. Necesitás re-autenticarte.\n')
  } else {
    console.log('  Necesitás iniciar sesión para usar el MCP.\n')
  }

  console.log('  ¿Cómo querés autenticarte?\n')
  console.log('    1. 🌐 Browser (OAuth — abre el navegador)')
  console.log('    2. 📧 Email y password (en la terminal)')
  console.log('    3. ⏭️  Omitir (configurar después)\n')

  const authChoice = await prompt('  Elegí una opción: ')
  const authNum = parseInt(authChoice, 10)
  console.log('')

  if (authNum === 1) {
    await runAuth(['--force'])
  } else if (authNum === 2) {
    await runLogin(['--force'])
  } else {
    console.log('  Podés autenticarte después con:')
    console.log('    npx @botuyo/mcp auth    — browser (OAuth)')
    console.log('    npx @botuyo/mcp login   — email/password\n')
    process.exit(0)
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function writeConfigFile(editor: EditorOption): Promise<void> {
  const configPath = editor.configPath.startsWith('.')
    ? join(process.cwd(), editor.configPath)
    : editor.configPath

  try {
    let config: any = { servers: buildServerBlock() }

    // Merge with existing config if present
    if (existsSync(configPath)) {
      try {
        const existing = JSON.parse(await readFile(configPath, 'utf8'))
        config = { ...existing, servers: { ...existing.servers, ...buildServerBlock() } }
        console.log('  📋 Mergeando con config existente...')
      } catch {
        // Can't parse → overwrite
      }
    }

    // Create directory if needed
    const dir = configPath.substring(0, configPath.lastIndexOf(sep))
    if (dir) await mkdir(dir, { recursive: true })

    await writeFile(configPath, JSON.stringify(config, null, 2))
    console.log(`  ✅ Config escrita en: ${configPath}`)
    console.log('     Reiniciá tu editor para que tome los cambios.\n')
  } catch (err: any) {
    console.error(`  ❌ Error al escribir config: ${err.message}`)
    console.log('\n  Copiá esto manualmente:\n')
    console.log('  ' + JSON.stringify({ servers: buildServerBlock() }, null, 2).split('\n').join('\n  '))
    console.log('')
  }
}

async function writeAntigravityConfig(): Promise<void> {
  const configPath = getAntigravityConfigPath()

  try {
    let config: any = { mcpServers: buildServerBlock() }

    // Merge with existing config if present
    if (existsSync(configPath)) {
      try {
        const existing = JSON.parse(await readFile(configPath, 'utf8'))
        config = {
          ...existing,
          mcpServers: { ...existing.mcpServers, ...buildServerBlock() }
        }
        console.log('  📋 Mergeando con config de Antigravity existente...')
      } catch {
        // Can't parse → overwrite
      }
    }

    // Create directory if needed
    const dir = configPath.substring(0, configPath.lastIndexOf(sep))
    if (dir) await mkdir(dir, { recursive: true })

    await writeFile(configPath, JSON.stringify(config, null, 2))
    console.log(`  ✅ Antigravity MCP configurado: ${configPath}`)
  } catch (err: any) {
    console.error(`  ⚠️  No se pudo configurar Antigravity: ${err.message}`)
  }
}

function autoDetect(): EditorOption | undefined {
  if (existsSync('.cursor')) return EDITORS[0]
  if (existsSync('.vscode')) return EDITORS[1]
  return undefined
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}
