import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export const EXAMPLE_AGENT_TOOL: Tool = {
  name: 'example_agent',
  description: `Returns a complete, documented example of an agent configuration JSON with ALL possible fields explained.

Use this as a reference when creating or editing agents. Every field includes a description of what it does,
its type, valid values, and conditions. This is a read-only reference tool — it doesn't create or modify anything.

Useful for:
- New users learning the agent config structure
- Checking available fields before using import_agent_json
- Understanding how stages, connections, channelFlows, and tools work together
- Learning the widget theming system (cssVariables, darkCssVariables, animations, effects)`,
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  }
}

export async function exampleAgentHandler() {
  const reference = {
    // ═══════════════════════════════════════════════════════════════════
    // AGENT CONFIGURATION REFERENCE
    // All fields documented with types, valid values, and conditions.
    // Use export_agent_json → edit → import_agent_json workflow.
    // ═══════════════════════════════════════════════════════════════════

    // ─── CORE IDENTITY ─────────────────────────────────────────────
    name: 'Mi Agente de Ejemplo',
    _name_doc: 'Required. String. Display name shown in widget header and admin panel.',

    identity: {
      tone: 'Amigable, profesional y empático. Usá un tono cercano pero respetuoso.',
      language: 'es-AR',
      objective: 'Asistir a los usuarios con consultas sobre productos, reservas y soporte general.',
      customInstructions: 'Instrucciones adicionales libres. Pueden incluir reglas de negocio, restricciones, o comportamiento especial.'
    },
    _identity_doc: {
      tone: 'Optional. String. Personality/voice of the agent. Included in every system prompt.',
      language: 'Required. String. BCP-47 locale (es-AR, en-US, pt-BR, etc.). Controls response language.',
      objective: 'Optional. String. High-level goal. Helps the LLM stay on-topic.',
      customInstructions: 'Optional. String. Free-form rules injected into system prompt. Can include markdown, lists, etc.'
    },

    // ─── CONVERSATIONAL FLOW (STAGES + CONNECTIONS) ────────────────
    stages: [
      {
        id: 'greeting',
        name: 'Saludo Inicial',
        type: 'start',
        instruction: 'Saludá al usuario de forma cálida y preguntale en qué lo podés ayudar.',
        tools: []
      },
      {
        id: 'guest_discovery',
        name: 'Descubrimiento',
        type: 'action',
        instruction: 'Hacé preguntas para entender las necesidades del usuario.',
        tools: ['search_accommodations', 'search_knowledge_base']
      },
      {
        id: 'intent_router',
        name: 'Router de Intención',
        type: 'router',
        instruction: 'Analizá la intención del usuario y dirigilo al flujo correcto. No interactúes directamente, solo evaluá las condiciones de salida.',
        tools: []
      },
      {
        id: 'guest_booking',
        name: 'Reserva',
        type: 'action',
        instruction: 'Guiá al usuario por el proceso de reserva.',
        tools: ['create_pre_reservation', 'get_accommodation_details']
      },
      {
        id: 'farewell',
        name: 'Despedida',
        type: 'end',
        instruction: 'Despedite amablemente y preguntá si necesita algo más.',
        tools: []
      }
    ],
    _stages_doc: {
      id: 'Required. Unique string identifier. Referenced by connections.',
      name: 'Optional. Human-readable label for admin UI and visual graph.',
      type: 'Required. One of: "start", "action", "router", "end". See _stageTypes_doc for detailed explanation.',
      instruction: 'Required. System prompt for this stage. The LLM follows this when the stage is active.',
      tools: 'Optional. Array of tool IDs available in THIS stage. Must be a subset of enabledTools[].'
    },
    _stageTypes_doc: {
      start: {
        purpose: 'Entry point of the conversation. The agent begins here when a new conversation starts.',
        behavior: 'Executes its instruction once at the start, then transitions to the next stage via connections.',
        useCases: 'Greeting the user, collecting initial context, setting the tone of the conversation.',
        cardinality: 'Exactly 1 per agent. Every agent MUST have exactly one start stage.',
        bestPractices: 'Keep it simple — greet the user and ask how you can help. Avoid heavy tool usage here.'
      },
      action: {
        purpose: 'The workhorse stage. Executes tools, interacts with the user, and performs tasks.',
        behavior: 'The LLM follows the instruction, can call tools assigned to this stage, and engages in multi-turn conversation until a transition condition is met.',
        useCases: 'Searching products, collecting user data, processing orders, answering questions, executing business logic.',
        cardinality: 'Unlimited. You can have as many action stages as needed.',
        bestPractices: 'Assign only the tools relevant to this stage\'s purpose. Write clear instructions about what the agent should accomplish before transitioning.'
      },
      router: {
        purpose: 'Decision point that evaluates the user\'s intent and directs the flow to different stages based on conditions.',
        behavior: 'The LLM analyzes the conversation context and evaluates the conditional connections to determine which stage to transition to. It does NOT interact with the user directly — it silently routes.',
        useCases: 'Intent classification (sales vs support vs FAQ), language detection, user type routing (new vs returning), priority triage.',
        cardinality: 'Unlimited. Use as many routers as needed for complex branching flows.',
        bestPractices: 'Keep router instructions focused on evaluation criteria. All outgoing connections should be "conditional" type. Don\'t assign tools — routers should be lightweight decision makers.'
      },
      end: {
        purpose: 'Closing stage. Wraps up the conversation and says goodbye.',
        behavior: 'Executes its instruction (farewell message) and marks the conversation as completed. No further transitions occur.',
        useCases: 'Saying goodbye, sending a summary, confirming a completed action, asking for feedback.',
        cardinality: 'At least 1. You need at least one end stage, but can have multiple (e.g. one for success, one for cancellation).',
        bestPractices: 'Keep it brief and warm. Optionally ask if the user needs anything else before closing.'
      },
      _summary: 'A typical flow: start → action(s) → router → action(s) → end. ' +
        'The router is optional — simple agents can go start → action → end with conditional connections. ' +
        'Use routers when you have 3+ possible paths from a single decision point.'
    },

    connections: [
      { id: 'c1', from: 'greeting', to: 'guest_discovery', type: 'default' },
      { id: 'c2', from: 'guest_discovery', to: 'intent_router', type: 'default' },
      { id: 'c3', from: 'intent_router', to: 'guest_booking', type: 'conditional', condition: 'El usuario quiere reservar un alojamiento' },
      { id: 'c4', from: 'intent_router', to: 'farewell', type: 'conditional', condition: 'El usuario quiere despedirse o no necesita más ayuda' },
      { id: 'c5', from: 'intent_router', to: 'guest_discovery', type: 'conditional', condition: 'El usuario necesita más información antes de decidir' },
      { id: 'c6', from: 'guest_booking', to: 'farewell', type: 'conditional', condition: 'Reserva completada o cancelada' }
    ],
    _connections_doc: {
      id: 'Required. Unique string identifier.',
      from: 'Required. Stage ID where the edge originates.',
      to: 'Required. Stage ID where the edge points.',
      type: '"default" = always transitions (no AI evaluation). "conditional" = LLM evaluates the condition string.',
      condition: 'Required for "conditional" type. Natural language evaluated by the LLM to decide if to transition.'
    },

    // ─── CHANNEL FLOWS (Per-Channel Overrides) ─────────────────────
    channelFlows: {
      phone: {
        connections: [
          { id: 'phone_c1', from: 'greeting', to: 'guest_discovery', type: 'default' },
          { id: 'phone_c2', from: 'guest_discovery', to: 'farewell', type: 'conditional', condition: 'El usuario quiere terminar' }
        ]
      }
    },
    _channelFlows_doc: 'Optional. Object keyed by channel name. Each overrides the default connections[] for that channel. ' +
      'Use this when a channel has different flow paths (e.g. phone skips booking because tools like create_pre_reservation are text-only). ' +
      'If a channel is NOT listed here, it uses the default connections array. ' +
      'Runtime filters tools per-channel automatically, so text-only tools simply won\'t load on phone.',

    // ─── TOOLS & CHANNELS ──────────────────────────────────────────
    enabledTools: [
      'search_accommodations',
      'get_accommodation_details',
      'create_pre_reservation',
      'search_knowledge_base',
      'identify_user_context',
      'update_user_profile'
    ],
    _enabledTools_doc: 'Array of tool IDs the agent can use. Per-stage tools[] must be a subset. ' +
      'Use list_available_tools to see all options with descriptions. ' +
      'Tools auto-sync: any tool referenced in a stage.tools[] is automatically added to enabledTools on save.',

    channels: ['web', 'whatsapp', 'phone'],
    _channels_doc: 'Array of channels the agent is published on. Valid: "web", "whatsapp", "telegram", "discord", "instagram", "phone". ' +
      'Runtime filters tools by channel compatibility — text-only tools (e.g. create_pre_reservation) won\'t load on phone. ' +
      'You can have phone + text-only tools as long as your channelFlows.phone never reaches stages with those tools.',

    // ─── WIDGET CONFIGURATION ──────────────────────────────────────
    widgetConfig: {
      // -- Appearance --
      welcomeMessage: '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte?',
      placeholder: 'Escribí tu mensaje...',
      position: 'bottom-right',
      headerText: 'MI AGENTE 🤖',
      starterPrompt: '¿Necesitas ayuda?',
      defaultLocale: 'es',
      avatarScale: 1.2,
      showPromptAvatar: true,

      // -- 3D Avatar for Voice Calls --
      avatar3dUrl: 'https://example.com/model.glb',

      // -- Light Mode CSS Variables --
      cssVariables: {
        // Brand colors (preserved in both light AND dark mode)
        primary: '210 100% 50%',
        primaryForeground: '0 0% 100%',

        // Light mode surfaces
        background: '0 0% 100%',
        foreground: '210 20% 12%',
        card: '0 0% 100%',
        cardForeground: '210 20% 12%',
        muted: '210 20% 96%',
        mutedForeground: '210 10% 45%',
        border: '210 20% 90%',
        destructive: '0 84% 60%',

        // Sizing
        radius: '0.75rem',
        windowBorderRadius: '24px',
        launcherBorderRadius: '50%',
        windowHeight: '700px',
        windowBottom: '24px',

        // Spacing (design system)
        spacing1: '0.25rem',
        spacing2: '0.5rem',
        spacing3: '0.75rem',
        spacing4: '1rem',
        spacing5: '1.25rem',
        spacing6: '1.5rem',
        spacing7: '1.75rem',
        spacing8: '2rem'
      },

      // -- Dark Mode CSS Variables (override surfaces, brand stays) --
      darkCssVariables: {
        background: '222 47% 6%',
        foreground: '210 40% 98%',
        card: '217 33% 12%',
        cardForeground: '210 40% 98%',
        muted: '217 33% 17%',
        mutedForeground: '215 20% 65%',
        border: '217 33% 17%',
        destructive: '0 63% 31%'
      },

      // -- Animations --
      animations: {
        enabled: true,
        messageEntry: 'spring',
        typingIndicator: 'dots',
        buttonEffects: true,
        smoothScroll: true,
        windowTransitions: true,
        launcherPulse: true,
        speedMultiplier: 1.0,
        staggerDelay: 50
      },

      // -- Visual Effects --
      effects: {
        glassmorphism: true,
        gradients: true,
        softShadows: true,
        glowEffects: true,
        shimmerLoading: true,
        hoverLift: true,
        particles: false,
        soundEffects: false,
        hapticFeedback: true
      }
    },
    _widgetConfig_doc: {
      cssVariables: 'HSL values WITHOUT the hsl() wrapper. "primary" and "primaryForeground" are your brand colors — they are preserved in both light and dark mode.',
      darkCssVariables: 'Optional. Overrides ONLY the surface colors (background, card, muted, border, etc.) for dark mode. ' +
        'primary/primaryForeground from cssVariables are ALWAYS preserved. Dark mode activates automatically when the host page uses prefers-color-scheme: dark.',
      avatar3dUrl: 'Optional. URL to a .glb/.vrm 3D model. Displayed as the voice call avatar orb instead of the 2D image.',
      avatarScale: 'Optional. Number (default 1). Controls avatar zoom. 1.2 = 20% larger.',
      showPromptAvatar: 'Optional. Boolean. Shows a mini avatar next to the starter prompt bubble.',
      defaultLocale: 'Optional. "es" | "en" | "pt" | "fr". Sets the widget UI language.',
      starterPrompt: 'Optional. String. Small bubble shown when the widget is closed to invite interaction.',
      animations: {
        enabled: 'Master toggle. false disables ALL animations.',
        messageEntry: '"slide" | "fade" | "scale" | "spring" | "none". How new messages appear.',
        typingIndicator: '"dots" | "wave" | "pulse" | "none". Style of the "agent is typing" indicator.',
        speedMultiplier: 'Number. 0.5 = 2x faster, 2 = 2x slower. Default: 1.',
        staggerDelay: 'Number (ms). Delay between sequential message animations. Default: 50.'
      },
      effects: {
        glassmorphism: 'Frosted glass blur on header and overlays.',
        gradients: 'Gradient backgrounds on cards and surfaces.',
        particles: 'Confetti/particles on certain actions (e.g. booking confirmed). Off by default.',
        soundEffects: 'UI sounds on send/receive. Off by default.',
        hapticFeedback: 'Vibration on mobile when interacting. On by default.'
      }
    },

    // ─── VOICE CONFIGURATION ───────────────────────────────────────
    voice: {
      profile: 'Profesional Femenina',
      widgetCallEnabled: true
    },
    _voice_doc: {
      profile: 'Display name of a voice profile. Resolved to internal ID on save. Use one from the catalog below.',
      widgetCallEnabled: 'Boolean. Enables the phone icon in the widget for browser-based voice calls.',
      _adminOnly: 'liveModel (e.g. "gemini-2.0-flash-live-001") is admin-only and auto-preserved on import.',
      _availableProfiles: [
        { displayName: 'Profesional Femenina', id: 'kore', gender: 'F', tone: 'Cálida', description: 'Voz femenina cálida y profesional' },
        { displayName: 'Amigable Femenina', id: 'aoede', gender: 'F', tone: 'Amigable', description: 'Voz femenina joven y amigable' },
        { displayName: 'Serena Femenina', id: 'leda', gender: 'F', tone: 'Serena', description: 'Voz femenina suave y tranquilizadora' },
        { displayName: 'Energético Masculino', id: 'puck', gender: 'M', tone: 'Energético', description: 'Voz masculina joven y dinámica' },
        { displayName: 'Formal Masculino', id: 'charon', gender: 'M', tone: 'Formal', description: 'Voz masculina grave y profesional' },
        { displayName: 'Cálido Masculino', id: 'fenrir', gender: 'M', tone: 'Cálido', description: 'Voz masculina amigable y cercana' },
        { displayName: 'Neutro Profesional', id: 'orus', gender: 'NB', tone: 'Profesional', description: 'Voz neutral y profesional' },
        { displayName: 'Suave Neutral', id: 'zephyr', gender: 'NB', tone: 'Suave', description: 'Voz suave y relajante' }
      ],
      _importNote: 'Podés pasar el displayName (ej: "Profesional Femenina"), el ID interno (ej: "kore"), o el nombre legacy Gemini (ej: "Kore"). Todos se resuelven al mismo perfil.'
    },

    // ─── PER-CHANNEL PROMPTS ───────────────────────────────────────
    channelPrompts: {
      whatsapp: 'Recordá que estás hablando por WhatsApp. Usá mensajes cortos y directos. Evitá markdown complejo.',
      phone: 'Estás en una llamada telefónica. Hablá de forma natural, sin usar formato visual. Sé conciso.'
    },
    _channelPrompts_doc: 'Optional. Object keyed by channel name. These prompts are MERGED into the base system prompt when that channel is active. ' +
      'Use this to adapt the agent\'s behavior per channel (e.g. shorter messages on WhatsApp, no markdown on phone).',

    // ─── KNOWLEDGE BASE ────────────────────────────────────────────
    knowledgeDocumentIds: ['doc_abc123', 'doc_def456'],
    _knowledgeDocumentIds_doc: 'Optional. Array of MongoDB IDs of knowledge base documents for RAG. ' +
      'The agent will search these documents for context when the search_knowledge_base tool is invoked.',

    // ─── READ-ONLY FIELDS (visible in export, ignored on import) ──
    _readOnlyFields: {
      apiKey: 'agent_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      _doc: 'The agent API key is auto-generated and shown in export. Use it for external integrations (widget embed, API calls). Cannot be modified via import.'
    }
  }

  return {
    success: true,
    data: reference,
    message: 'Complete agent configuration reference. Fields prefixed with _ are documentation-only and should be removed when using import_agent_json. ' +
      'Workflow: export_agent_json → edit local file → import_agent_json(filePath: "./agents/my-agent.json")'
  }
}
