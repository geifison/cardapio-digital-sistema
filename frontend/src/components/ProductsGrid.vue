<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { getProducts } from '../lib/api'
import type { Product } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{ selectedCategoryId: number | null, searchQuery: string }>()

const products = ref<Product[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(load)
watch(() => [props.selectedCategoryId, props.searchQuery], () => {
  // Nada a fazer aqui além de reavaliar o computed
})

async function load() {
  loading.value = true
  error.value = null
  try {
    const data = await getProducts()
    products.value = data || []
  } catch (e: any) {
    error.value = e?.message ?? 'Erro ao carregar produtos'
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const q = (props.searchQuery || '').toLowerCase().trim()
  return products.value.filter((p) => {
    const byCat = props.selectedCategoryId ? p.category_id === props.selectedCategoryId : true
    const byName = q ? (p.name?.toLowerCase()?.includes(q) || p.description?.toLowerCase()?.includes(q)) : true
    return byCat && byName
  })
})

function formatPrice(value: number | string | null | undefined) {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value)
  if (!isFinite(n)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function imgSrc(p: Product) {
  let raw = (p.image_url ?? '').toString().trim()
  if (!raw) return '/placeholder.svg'
  // strip host if present
  raw = raw.replace(/^https?:\/\/[^/]+/i, '')
  // ensure leading slash and collapse multiple slashes
  if (!raw.startsWith('/')) raw = '/' + raw
  raw = raw.replace(/\/+/g, '/')
  // if points to uploads, force single app prefix
  if (raw.includes('/uploads/')) {
    const idx = raw.indexOf('/uploads/')
    const tail = raw.slice(idx) // from /uploads/...
    const path = '/cardapio-digital-sistema' + tail
    return `http://localhost${path}`
  }
  // otherwise, if already under app base
  raw = raw.replace(/(\/cardapio-digital-sistema)+/g, '/cardapio-digital-sistema')
  return `http://localhost${raw}`
}
</script>

<template>
  <div class="mt-2">
    <div v-if="loading" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <div v-for="i in 8" :key="i" class="space-y-2">
        <div class="aspect-square w-full bg-muted/40 rounded" />
        <div class="h-3 w-3/4 bg-muted/40 rounded" />
        <div class="h-3 w-1/2 bg-muted/40 rounded" />
      </div>
    </div>
    <div v-else-if="error" class="text-red-600 text-sm">{{ error }}</div>
    <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <Card v-for="p in filtered" :key="p.id" class="overflow-hidden">
        <img :src="imgSrc(p)" :alt="p.name" class="w-full aspect-square object-cover" loading="lazy" />
        <CardHeader class="py-3">
          <CardTitle class="text-base leading-tight line-clamp-2">{{ p.name }}</CardTitle>
        </CardHeader>
        <CardContent class="py-0 pb-3 space-y-1">
          <div class="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">{{ p.description }}</div>
          <div class="flex items-center justify-between pt-1">
            <span class="font-semibold">{{ formatPrice(p.price) }}</span>
            <Badge variant="secondary">{{ p.category_name || p.type || 'Produto' }}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>