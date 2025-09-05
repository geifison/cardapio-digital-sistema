<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Separator } from '@/components/ui/separator'
import { getCompanyInfo, getMapboxPublicKey } from '@/lib/api'
import { normalizeImageUrl } from '@/lib/utils'

const company = ref<any>(null)
const mapboxKey = ref<string | null>(null)
const mapEl = ref<HTMLElement | null>(null)

const brand = computed(() => company.value?.company_color || '')
function isValidHex(hex: string) {
  return /^#([0-9a-fA-F]{6})$/.test(hex)
}
function pickTextColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 128 ? '#111827' : '#ffffff'
}
const bgStyle = computed(() => {
  const c = brand.value
  if (isValidHex(c)) {
    return { backgroundColor: c, color: pickTextColor(c) }
  }
  return {}
})

function buildMapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

async function loadMapboxGL() {
  if ((window as any).mapboxgl) return (window as any).mapboxgl
  await new Promise<void>((resolve, reject) => {
    if (!document.querySelector('link[data-mapbox-gl]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css'
      link.setAttribute('data-mapbox-gl', '1')
      document.head.appendChild(link)
    }
    const script = document.createElement('script')
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar Mapbox GL'))
    document.head.appendChild(script)
  })
  return (window as any).mapboxgl
}

async function initMap() {
  if (!mapEl.value || !company.value?.latitude || !company.value?.longitude || !mapboxKey.value) return
  try {
    const mapboxgl = await loadMapboxGL()
    mapboxgl.accessToken = mapboxKey.value
    const map = new mapboxgl.Map({
      container: mapEl.value,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [Number(company.value.longitude), Number(company.value.latitude)],
      zoom: 14,
      attributionControl: false,
    })
    new mapboxgl.Marker().setLngLat([Number(company.value.longitude), Number(company.value.latitude)]).addTo(map)
  } catch (e) {
    // silencioso
  }
}

onMounted(async () => {
  try {
    const [info, key] = await Promise.all([getCompanyInfo(), getMapboxPublicKey()])
    company.value = info
    mapboxKey.value = key
    setTimeout(initMap, 0)
  } catch {}
})
</script>

<template>
  <Separator class="my-0" />
  <footer :style="bgStyle" class="w-full">
    <div class="mx-auto max-w-5xl px-4 py-6 grid gap-6 md:grid-cols-3">
      <div class="flex items-center gap-3">
        <img v-if="company?.logo_url" :src="normalizeImageUrl(company?.logo_url)" alt="Logo" class="h-10 w-auto rounded bg-white/90 p-1" />
        <div>
          <h2 class="text-base font-semibold">{{ company?.company_name ?? 'Minha Empresa' }}</h2>
          <p v-if="company?.cnpj" class="text-sm opacity-90">CNPJ: {{ company?.cnpj }}</p>
        </div>
      </div>
      <div class="text-sm space-y-1">
        <p v-if="company?.address">
          {{ company.address }}
          <span v-if="company?.zip_code">- {{ company.zip_code }}</span>
        </p>
        <p v-if="company?.phone">
          <a :href="`tel:${company.phone}`" class="underline underline-offset-2">Telefone: {{ company.phone }}</a>
        </p>
        <p v-if="company?.latitude && company?.longitude">
          <a :href="buildMapsLink(company.latitude, company.longitude)" target="_blank" rel="noopener" class="underline underline-offset-2">Abrir no mapa</a>
        </p>
      </div>
      <div>
        <div v-if="mapboxKey && company?.latitude && company?.longitude" ref="mapEl" class="h-40 w-full rounded-md overflow-hidden ring-1 ring-black/10"></div>
        <div v-else class="text-sm opacity-90">
          <p>Mapa indisponível.</p>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
</style>