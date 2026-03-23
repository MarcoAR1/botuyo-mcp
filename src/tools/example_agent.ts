import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export const EXAMPLE_AGENT_TOOL: Tool = {
  name: 'example_agent',
  description: `Returns a complete, documented example of an agent configuration JSON with ALL possible fields explained.

Use this as a reference when creating or editing agents. Every field includes a description of what it does,
its type, and valid values. This is a read-only reference tool — it doesn't create or modify anything.

Useful for:
- New users learning the agent config structure
- Checking available fields before using import_agent_json
- Understanding how stages, connections, channelFlows, and tools work together`,
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  }
}

export async function exampleAgentHandler() {
  const example = {
    _comment: 'This is a complete reference of all agent configuration fields. Use export_agent_json to get your real config, edit it, and import_agent_json to apply.',

    name: 'Mi Agente de Ejemplo',

    identity: {
      tone: 'Amigable, profesional y empático. Usá un tono cercano pero respetuoso.',
      language: 'es-AR',
      objective: 'Asistir a los usuarios con consultas sobre productos, reservas y soporte general.',
      customInstructions: 'Instrucciones adicionales libres. Pueden incluir reglas de negocio, restricciones, o comportamiento especial.'
    },

    stages: [
      {
        id: 'greeting',
        name: 'Saludo Inicial',
        type: 'start',
        instruction: 'Saludá al usuario de forma cálida y preguntale en qué lo podés ayudar. Si ya hay historial, no repitas el saludo.',
        tools: [],
        _types: 'type can be: start, action, router, end. Only 1 start allowed.'
      },
      {
        id: 'guest_discovery',
        name: 'Descubrimiento',
        type: 'action',
        instruction: 'Hacé preguntas para entender las necesidades del usuario: qué busca, fechas, presupuesto, etc.',
        tools: ['search_accommodations', 'search_knowledge_base'],
        _note: 'tools[] lists tool IDs available in THIS stage. They must also be in enabledTools[].'
      },
      {
        id: 'guest_booking',
        name: 'Reserva',
        type: 'action',
        instruction: 'Guiá al usuario por el proceso de reserva. Mostrá opciones de pago y confirmá los datos.',
        tools: ['create_pre_reservation', 'get_accommodation_details']
      },
      {
        id: 'farewell',
        name: 'Despedida',
        type: 'end',
        instruction: 'Despedite amablemente. Agradecé la conversación y ofrecé ayuda futura.',
        tools: []
      }
    ],

    connections: [
      {
        id: 'c1',
        from: 'greeting',
        to: 'guest_discovery',
        type: 'default',
        _note: 'Default connections always transition. No condition needed.'
      },
      {
        id: 'c2',
        from: 'guest_discovery',
        to: 'guest_booking',
        type: 'conditional',
        condition: 'El usuario expresó interés en reservar una opción específica',
        _note: 'Conditional connections: the LLM evaluates the condition to decide if to transition.'
      },
      {
        id: 'c3',
        from: 'guest_booking',
        to: 'farewell',
        type: 'conditional',
        condition: 'La reserva fue completada exitosamente o el usuario quiere terminar'
      },
      {
        id: 'c_disc_farewell',
        from: 'guest_discovery',
        to: 'farewell',
        type: 'conditional',
        condition: 'El usuario quiere despedirse sin reservar'
      }
    ],

    channelFlows: {
      phone: {
        connections: [
          { id: 'phone_c1', from: 'greeting', to: 'guest_discovery', type: 'default' },
          { id: 'phone_c2', from: 'guest_discovery', to: 'farewell', type: 'conditional', condition: 'El usuario quiere terminar' }
        ],
        _note: 'ChannelFlows override the default connections for a specific channel. Here, phone skips booking (tools not phone-compatible).'
      },
      whatsapp: {
        connections: [
          { id: 'wa_c1', from: 'greeting', to: 'guest_discovery', type: 'default' },
          { id: 'wa_c2', from: 'guest_discovery', to: 'guest_booking', type: 'conditional', condition: 'Quiere reservar' },
          { id: 'wa_c3', from: 'guest_booking', to: 'farewell', type: 'conditional', condition: 'Reserva completada' }
        ],
        _note: 'If a channel is NOT in channelFlows, it uses the default connections array.'
      }
    },

    enabledTools: [
      'search_accommodations',
      'get_accommodation_details',
      'create_pre_reservation',
      'search_knowledge_base',
      'identify_user_context',
      'update_user_profile'
    ],
    _enabledToolsNote: 'All tools the agent can use across all stages. Per-stage tools[] must be a subset of this. Use list_available_tools to see all options.',

    channels: ['web', 'whatsapp', 'phone'],
    _channelsNote: 'Valid channels: web, whatsapp, telegram, discord, instagram, phone. Runtime filters tools by channel compatibility.',

    widgetConfig: {
      cssVariables: {
        primary: '210 100% 50%',
        'primary-foreground': '0 0% 100%',
        background: '222 47% 6%',
        foreground: '210 40% 98%',
        muted: '217 33% 17%',
        'muted-foreground': '215 20% 65%',
        accent: '210 100% 50%',
        'accent-foreground': '0 0% 100%',
        border: '217 33% 17%',
        ring: '210 100% 50%',
        'chat-bubble-user': '210 100% 50%',
        'chat-bubble-user-foreground': '0 0% 100%',
        'chat-bubble-bot': '217 33% 17%',
        'chat-bubble-bot-foreground': '210 40% 98%',
        radius: '0.75rem',
        _note: 'HSL values WITHOUT the hsl() wrapper. Widget uses these as CSS custom properties.'
      },
      welcomeMessage: '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte?',
      placeholder: 'Escribí tu mensaje...',
      position: 'bottom-right'
    },

    voice: {
      profile: 'Coral Cálida',
      widgetCallEnabled: true,
      _note: 'profile is the display name of a voice profile (use list_voice_profiles to see options). liveModel is admin-only and auto-preserved.'
    },

    channelPrompts: {
      whatsapp: 'Recordá que estás hablando por WhatsApp. Usá mensajes cortos y directos. Evitá markdown complejo.',
      phone: 'Estás en una llamada telefónica. Hablá de forma natural, sin usar formato visual. Sé conciso.',
      _note: 'Per-channel system prompt overrides. Merged into the base prompt when that channel is active.'
    },

    knowledgeDocumentIds: ['doc_abc123', 'doc_def456'],
    _knowledgeNote: 'MongoDB IDs of knowledge base documents for RAG. The agent will search these for context.',

    _readOnlyFields: {
      apiKey: 'agent_cce16580e147497ba5a35ff4c4947066',
      _note: 'apiKey is shown in export but cannot be modified via import. Used for external API integrations.'
    },

    _adminOnlyFields: {
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      summaryThreshold: 15,
      'voice.liveModel': 'gemini-2.0-flash-live-001',
      _note: 'These fields are only editable via the admin panel, never via MCP import.'
    }
  }

  return {
    success: true,
    data: example,
    message: 'This is a complete reference of all agent configuration fields. Fields prefixed with _ are documentation-only and should be removed when using import_agent_json.'
  }
}
