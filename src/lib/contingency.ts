// ===========================================================
// lib/contingency.ts - Sistema de Flags de Contingência
// ===========================================================
// Permite desativar funcionalidades rapidamente em caso de incidente
// Todas as flags são lidas do banco (Settings) com cache em memória

import prisma from './prisma';

// ============================================================
// FLAGS DISPONÍVEIS
// ============================================================

export const CONTINGENCY_FLAGS = {
  MAINTENANCE_MODE: {
    key: 'flag:maintenance_mode',
    description: 'Modo manutenção - bloqueia todas as operações',
    defaultValue: false,
  },
  DISABLE_PAYMENTS: {
    key: 'flag:disable_payments',
    description: 'Desativa criação de pagamentos (Asaas)',
    defaultValue: false,
  },
  DISABLE_BOOKINGS: {
    key: 'flag:disable_bookings',
    description: 'Desativa criação de novas reservas',
    defaultValue: false,
  },
  DISABLE_EMAILS: {
    key: 'flag:disable_emails',
    description: 'Desativa envio de emails',
    defaultValue: false,
  },
  DISABLE_WEBHOOKS: {
    key: 'flag:disable_webhooks',
    description: 'Ignora webhooks recebidos',
    defaultValue: false,
  },
} as const;

export type ContingencyFlagKey = keyof typeof CONTINGENCY_FLAGS;

// ============================================================
// CACHE EM MEMÓRIA (TTL 30 segundos)
// ============================================================

interface CacheEntry {
  value: boolean;
  expiresAt: number;
}

const flagCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 segundos

// ============================================================
// FUNÇÕES PRINCIPAIS
// ============================================================

/**
 * Verifica se uma flag de contingência está ativa
 * Usa cache em memória para performance
 */
export async function isContingencyActive(flag: ContingencyFlagKey): Promise<boolean> {
  const flagConfig = CONTINGENCY_FLAGS[flag];
  const key = flagConfig.key;

  // Verificar cache
  const cached = flagCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { key },
    });

    const value = Boolean(setting?.isActive && setting.value === 'true');
    
    // Atualizar cache
    flagCache.set(key, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return value;
  } catch (error) {
    console.error(`[CONTINGENCY] Erro ao verificar flag ${flag}:`, error);
    // Em caso de erro, retorna default (geralmente false = sistema funciona)
    return flagConfig.defaultValue;
  }
}

/**
 * Ativa/desativa uma flag de contingência
 */
export async function setContingencyFlag(
  flag: ContingencyFlagKey,
  active: boolean
): Promise<void> {
  const flagConfig = CONTINGENCY_FLAGS[flag];
  
  await prisma.setting.upsert({
    where: { key: flagConfig.key },
    create: {
      key: flagConfig.key,
      value: String(active),
      type: 'boolean',
      category: 'contingency',
      description: flagConfig.description,
      isActive: active,
    },
    update: {
      value: String(active),
      isActive: active,
    },
  });

  // Limpar cache
  flagCache.delete(flagConfig.key);
}

/**
 * Obtém status de todas as flags
 */
export async function getAllContingencyFlags(): Promise<Record<ContingencyFlagKey, boolean>> {
  const result: Partial<Record<ContingencyFlagKey, boolean>> = {};

  for (const [key] of Object.entries(CONTINGENCY_FLAGS)) {
    result[key as ContingencyFlagKey] = await isContingencyActive(key as ContingencyFlagKey);
  }

  return result as Record<ContingencyFlagKey, boolean>;
}

/**
 * Inicializa todas as flags no banco (se não existirem)
 */
export async function initializeContingencyFlags(): Promise<void> {
  for (const [, config] of Object.entries(CONTINGENCY_FLAGS)) {
    try {
      await prisma.setting.upsert({
        where: { key: config.key },
        create: {
          key: config.key,
          value: String(config.defaultValue),
          type: 'boolean',
          category: 'contingency',
          description: config.description,
          isActive: config.defaultValue,
        },
        update: {}, // Não atualiza se já existir
      });
    } catch (error) {
      console.warn(`[CONTINGENCY] Falha ao inicializar flag ${config.key}`);
    }
  }
}

// ============================================================
// HELPERS PARA USO NAS APIS
// ============================================================

/**
 * Verifica modo manutenção
 * Retorna mensagem de erro se em manutenção
 */
export async function checkMaintenanceMode(): Promise<{ blocked: boolean; message?: string }> {
  if (await isContingencyActive('MAINTENANCE_MODE')) {
    return {
      blocked: true,
      message: 'Sistema em manutenção. Tente novamente em alguns minutos.',
    };
  }
  return { blocked: false };
}

/**
 * Verifica se pagamentos estão habilitados
 */
export async function checkPaymentsEnabled(): Promise<{ blocked: boolean; message?: string }> {
  if (await isContingencyActive('DISABLE_PAYMENTS')) {
    return {
      blocked: true,
      message: 'Pagamentos temporariamente indisponíveis. Tente novamente em breve.',
    };
  }
  return { blocked: false };
}

/**
 * Verifica se reservas estão habilitadas
 */
export async function checkBookingsEnabled(): Promise<{ blocked: boolean; message?: string }> {
  if (await isContingencyActive('DISABLE_BOOKINGS')) {
    return {
      blocked: true,
      message: 'Novas reservas temporariamente indisponíveis.',
    };
  }
  return { blocked: false };
}
