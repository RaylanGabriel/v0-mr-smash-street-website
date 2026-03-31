// Rate limiting simples para o frontend
// Armazena timestamps das últimas tentativas

interface RateLimitEntry {
  attempts: number
  firstAttempt: number
  blocked: boolean
  blockedUntil: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_WINDOW_MS = 60 * 1000 // 1 minuto
const DEFAULT_BLOCK_DURATION_MS = 5 * 60 * 1000 // 5 minutos de bloqueio

export interface RateLimitConfig {
  maxAttempts?: number
  windowMs?: number
  blockDurationMs?: number
}

export interface RateLimitResult {
  allowed: boolean
  remainingAttempts: number
  blockedUntil?: Date
  message?: string
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig = {}
): RateLimitResult {
  const {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    windowMs = DEFAULT_WINDOW_MS,
    blockDurationMs = DEFAULT_BLOCK_DURATION_MS,
  } = config

  const now = Date.now()
  let entry = rateLimitMap.get(key)

  // Limpa entradas antigas
  if (entry && now - entry.firstAttempt > windowMs && !entry.blocked) {
    rateLimitMap.delete(key)
    entry = undefined
  }

  // Verifica se está bloqueado
  if (entry?.blocked) {
    if (now < entry.blockedUntil) {
      return {
        allowed: false,
        remainingAttempts: 0,
        blockedUntil: new Date(entry.blockedUntil),
        message: `Muitas tentativas. Tente novamente em ${Math.ceil((entry.blockedUntil - now) / 1000)} segundos.`,
      }
    } else {
      // Desbloqueia
      rateLimitMap.delete(key)
      entry = undefined
    }
  }

  // Cria nova entrada se não existir
  if (!entry) {
    entry = {
      attempts: 1,
      firstAttempt: now,
      blocked: false,
      blockedUntil: 0,
    }
    rateLimitMap.set(key, entry)
    return {
      allowed: true,
      remainingAttempts: maxAttempts - 1,
    }
  }

  // Incrementa tentativas
  entry.attempts++

  // Verifica se excedeu o limite
  if (entry.attempts > maxAttempts) {
    entry.blocked = true
    entry.blockedUntil = now + blockDurationMs
    return {
      allowed: false,
      remainingAttempts: 0,
      blockedUntil: new Date(entry.blockedUntil),
      message: `Muitas tentativas. Tente novamente em ${Math.ceil(blockDurationMs / 1000)} segundos.`,
    }
  }

  return {
    allowed: true,
    remainingAttempts: maxAttempts - entry.attempts,
  }
}

export function resetRateLimit(key: string): void {
  rateLimitMap.delete(key)
}
