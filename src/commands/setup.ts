/**
 * npx @botuyo/mcp setup
 *
 * Generates the mcp.json snippet for the current MCP client.
 * Since auth uses ~/.botuyo/credentials.json (saved by login),
 * the server block only needs command + args, no env vars.
 */

import { readCredentials } from './credentials.js'
import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const CLIENTS: Record<string, { name: string; configPath: string }> = {
  cursor: {
    name: 'Cursor',
    configPath: '.cursor/mcp.json'
  },
  vscode: {
    name: 'VS Code / Antigravity',
    configPath: '.vscode/mcp.json'
  }
}

function buildServerBlock() {
  return {
    servers: {
      botuyo: {
        command: 'npx',
        args: ['-y', '@botuyo/mcp']
      }
    }
  }
}

export async function runSetup(args: string[]): Promise<void> {
  console.log('\n🔧 BotUyo MCP — Setup\n')

  const creds = await readCredentials()

  if (!creds?.token) {
    console.log('⚠️  No estás autenticado. Ejecutá `npx @botuyo/mcp login` primero.\n')
  } else {
    console.log(`✅ Autenticado como: ${creds.email} (${creds.tenantName})\n`)
  }

  const target = args[0] || autoDetectClient()

  if (target && CLIENTS[target]) {
    await writeConfigFile(target)
  } else {
    // Print all snippets
    console.log('Copiá el snippet para tu herramienta:\n')
    const block = buildServerBlock()
    for (const [_id, client] of Object.entries(CLIENTS)) {
      console.log(`── ${client.name} (${client.configPath}) ──`)
      console.log(JSON.stringify(block, null, 2))
      console.log()
    }
    printClaudeSnippet()
  }

  console.log('💡 El servidor lee las credenciales de ~/.botuyo/credentials.json automáticamente.')
  console.log('   No necesitás configurar variables de entorno.\n')
}

async function writeConfigFile(clientId: string): Promise<void> {
  const client = CLIENTS[clientId]
  const configPath = join(process.cwd(), client.configPath)
  const config = buildServerBlock()

  try {
    // Merge with existing config if present
    let merged: any = config
    if (existsSync(configPath)) {
      const existing = JSON.parse(await readFile(configPath, 'utf8'))
      merged = { ...existing, servers: { ...existing.servers, ...(config as any).servers } }
    }

    const dir = configPath.split(/[/\\]/).slice(0, -1).join('/')
    if (dir) {
      const { mkdir } = await import('fs/promises')
      await mkdir(dir, { recursive: true })
    }

    await writeFile(configPath, JSON.stringify(merged, null, 2))
    console.log(`✅ Escrito en ${configPath}`)
    console.log(`   Reiniciá tu editor para que tome los cambios.\n`)
  } catch (err: any) {
    console.error(`❌ Error al escribir config: ${err.message}`)
  }
}

function autoDetectClient(): string | undefined {
  if (existsSync('.cursor')) return 'cursor'
  if (existsSync('.vscode')) return 'vscode'
  return undefined
}

function printClaudeSnippet(): void {
  console.log(`── Claude Desktop (~/.config/claude/claude_desktop_config.json) ──`)
  console.log(JSON.stringify(buildServerBlock(), null, 2))
  console.log()
}
