import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const LIST_AVATARS_TOOL: Tool = {
  name: 'list_avatars',
  description: 'Lista los avatares 3D gratuitos disponibles en el catálogo. Muestra nombre, formato y categoría.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  }
}

export const SELECT_AVATAR_TOOL: Tool = {
  name: 'select_avatar',
  description: 'Selecciona un avatar 3D para un agente. Puede ser del catálogo (por ID) o una URL custom (.glb/.vrm).',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'ID del agente' },
      avatarId: { type: 'string', description: 'ID del avatar del catálogo (ej: avatar_corporate_female_01). Mutuamente excluyente con avatarUrl.' },
      avatarUrl: { type: 'string', description: 'URL directa a un modelo .glb/.vrm. Mutuamente excluyente con avatarId.' }
    },
    required: ['agentId']
  }
}

export async function listAvatarsHandler(client: BotuyoApiClient, _args: Record<string, unknown>) {
  const result = await client.get('/api/avatars/catalog')
  if (!result || !result.success || !result.data) {
    throw new Error('Could not fetch avatar catalog')
  }

  const catalog = result.data as Array<{
    _id: string
    name: string
    modelFormat: string
    category: string
    modelUrl: string
  }>

  if (catalog.length === 0) {
    return { text: 'No hay avatares en el catálogo aún.' }
  }

  let output = `Catálogo de avatares 3D (${catalog.length}):\n\n`

  for (const avatar of catalog) {
    output += `  • ${avatar._id} — ${avatar.name}\n`
    output += `    Formato: ${avatar.modelFormat.toUpperCase()} | Categoría: ${avatar.category}\n`
    if (avatar.modelUrl) {
      output += `    URL: ${avatar.modelUrl}\n`
    }
    output += '\n'
  }

  output += `Usá select_avatar con --avatarId para asignar uno a un agente.`

  return { text: output }
}

export async function selectAvatarHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const agentId = args.agentId as string
  const avatarId = args.avatarId as string | undefined
  const avatarUrl = args.avatarUrl as string | undefined

  if (!agentId) throw new Error('agentId is required')
  if (!avatarId && !avatarUrl) throw new Error('Provide either avatarId (from catalog) or avatarUrl (custom URL)')
  if (avatarId && avatarUrl) throw new Error('Provide avatarId OR avatarUrl, not both')

  let finalUrl = avatarUrl || ''

  // If avatarId provided, look up from catalog
  if (avatarId) {
    const catalogResult = await client.get(`/api/avatars/catalog/${avatarId}`)
    if (!catalogResult || !catalogResult.success || !catalogResult.data) {
      throw new Error(`Avatar "${avatarId}" not found in catalog. Use list_avatars to see available options.`)
    }
    finalUrl = (catalogResult.data as { modelUrl: string }).modelUrl
    if (!finalUrl) {
      throw new Error(`Avatar "${avatarId}" exists but has no model URL configured yet.`)
    }
  }

  // Select the avatar for the agent
  const result = await client.post('/api/avatars/select', {
    agentId,
    avatarUrl: finalUrl
  })

  if (!result || !result.success) {
    throw new Error(result?.message || 'Failed to select avatar')
  }

  const source = avatarId ? `catálogo (${avatarId})` : 'URL custom'
  return { text: `✅ Avatar actualizado para agente ${agentId}\n   Fuente: ${source}\n   URL: ${finalUrl}` }
}
