import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getBusinessHours, getPauseState } from './api'
import type { BusinessHours, PauseState } from '@/types'

// Utilidades de tempo
function parseHM(hm: string): number {
  // retorna minutos desde 00:00
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

function nowInMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function todayWeekdayIndex(): number {
  // 0 = sunday ... 6 = saturday
  return new Date().getDay()
}

const order: Array<keyof BusinessHours> = [
  'sunday','monday','tuesday','wednesday','thursday','friday','saturday'
]

function isOpenNow(hours: BusinessHours) {
  const idx = todayWeekdayIndex()
  const key = order[idx]
  const cfg = hours[key]
  if (!cfg || cfg.closed) return { open: false }
  const o = parseHM(cfg.open)
  const c = parseHM(cfg.close)
  const now = nowInMinutes()
  if (o === 0 && c === 0) return { open: true } // 24h

  // janela simples no mesmo dia
  return { open: now >= o && now < c }
}

function nextChangeInMs(hours: BusinessHours): number {
  const idx = todayWeekdayIndex()
  const key = order[idx]
  const cfg = hours[key]
  if (!cfg) return 60_000
  const now = nowInMinutes()
  const o = parseHM(cfg.open)
  const c = parseHM(cfg.close)
  const points: number[] = []
  if (!(cfg.closed)) {
    if (!(o === 0 && c === 0)) {
      points.push(o, c)
    }
  }
  points.push(0, 24 * 60) // bordas do dia
  // próximo ponto futuro em minutos
  const future = points
    .map(p => p - now)
    .filter(delta => delta > 0)
    .sort((a, b) => a - b)[0]
  const minutes = future ?? 5 // fallback 5 minutos
  return Math.max(30_000, minutes * 60_000) // mínimo 30s
}

export function useBusinessStatus(pollMs = 60_000) {
  const hours = ref<BusinessHours | null>(null)
  const pause = ref<PauseState>({ paused: false, message: '' })
  const loading = ref(true)
  const error = ref<string | null>(null)
  let timer: number | null = null
  let poller: number | null = null

  const status = computed(() => {
    if (!hours.value) return { label: 'Carregando...', open: null as null | boolean }
    const openInfo = isOpenNow(hours.value)
    const isPaused = pause.value.paused === true
    if (isPaused) return { label: 'Pausado', open: false, paused: true, message: pause.value.message }
    return openInfo.open
      ? { label: 'Aberto', open: true }
      : { label: 'Fechado', open: false }
  })

  async function refresh() {
    try {
      loading.value = true
      error.value = null
      const [h, p] = await Promise.all([
        getBusinessHours(),
        getPauseState(),
      ])
      hours.value = h
      pause.value = p
    } catch (e: any) {
      error.value = e?.message ?? 'Erro ao carregar status'
    } finally {
      loading.value = false
    }
  }

  function setupTimers() {
    if (timer) window.clearTimeout(timer)
    if (hours.value) {
      const ms = nextChangeInMs(hours.value)
      timer = window.setTimeout(async () => {
        await refresh()
        setupTimers()
      }, ms) as any
    }
    if (poller) window.clearInterval(poller)
    poller = window.setInterval(refresh, pollMs) as any
  }

  onMounted(async () => {
    await refresh()
    setupTimers()
  })
  onUnmounted(() => {
    if (timer) window.clearTimeout(timer)
    if (poller) window.clearInterval(poller)
  })

  return { hours, pause, status, loading, error, refresh }
}