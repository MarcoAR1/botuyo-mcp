import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'
import { readFileSync, statSync, existsSync } from 'fs'
import { extname, basename } from 'path'

const ALLOWED_EXTENSIONS = ['.webp', '.png', '.jpg', '.jpeg', '.svg']
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

export const UPLOAD_AGENT_MEDIA_TOOL: Tool = {
  name: 'upload_agent_media',
  description: `Upload a local image file to the CDN and assign it to an agent as avatar or logo.

Reads the file from the local filesystem, uploads it via the backend media API (Cloudinary),
and updates the agent's widgetConfig with the resulting URL.

Supported formats: webp, png, jpg, jpeg, svg. Max size: 2MB.`,
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'The MongoDB ID of the agent' },
      filePath: { type: 'string', description: 'Absolute path to the local image file (webp, png, jpg, svg)' },
      mediaType: {
        type: 'string',
        enum: ['avatar', 'logo'],
        description: 'Type of media: "avatar" for agent avatar, "logo" for widget logo. Default: "avatar"'
      }
    },
    required: ['agentId', 'filePath']
  }
}

export async function uploadAgentMediaHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, filePath, mediaType = 'avatar' } = args as {
    agentId: string
    filePath: string
    mediaType?: 'avatar' | 'logo'
  }

  if (!agentId || !filePath) {
    throw new Error('agentId and filePath are required')
  }

  // 1. Validate file exists
  if (!existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`)
  }

  // 2. Validate extension
  const ext = extname(filePath).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`Formato no soportado (${ext}). Usar: ${ALLOWED_EXTENSIONS.join(', ')}`)
  }

  // 3. Validate size
  const stat = statSync(filePath)
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`Archivo excede el límite de 2MB (${(stat.size / 1024).toFixed(0)}KB)`)
  }

  // 4. Read file
  const fileBuffer = readFileSync(filePath)
  const fileName = basename(filePath)

  // 5. Upload to backend via multipart
  const url = await client.uploadMedia(fileBuffer, fileName, mediaType as string)

  // 6. Update agent widgetConfig with the CDN URL
  const widgetPatch: Record<string, string> = {}
  if (mediaType === 'avatar') {
    widgetPatch.avatarUrl = url
  } else {
    widgetPatch.logoUrl = url
  }

  await client.put(`/api/v1/mcp/agents/${agentId}`, {
    widgetConfig: widgetPatch
  } as any)

  return {
    success: true,
    data: {
      url,
      agentId,
      mediaType,
      fileName,
      assignedTo: mediaType === 'avatar' ? 'widgetConfig.avatarUrl' : 'widgetConfig.logoUrl'
    },
    message: `${mediaType === 'avatar' ? 'Avatar' : 'Logo'} subido y asignado correctamente.`
  }
}
