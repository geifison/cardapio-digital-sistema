<script setup lang="ts">
import { onMounted, ref } from 'vue'
import CategoriesList from './components/CategoriesList.vue'
import ProductsGrid from './components/ProductsGrid.vue'
import { Input } from '@/components/ui/input'
import { getCompanyInfo } from './lib/api'
import { Badge } from '@/components/ui/badge'
import { useBusinessStatus } from '@/lib/useBusinessStatus'
import BusinessStatusOverlay from '@/components/BusinessStatusOverlay.vue'
import InspirationView from '@/components/InspirationView.vue'
import { Button } from '@/components/ui/button'
import Footer from '@/components/Footer.vue'

const search = ref('')
const selectedCategoryId = ref<number | null>(null)
const showInspiration = ref(false)

const { status, hours, pause, loading: statusLoading } = useBusinessStatus()

onMounted(async () => {
  try {
    const info = await getCompanyInfo()
    const brand = info?.company_color as string | undefined
    if (brand && /^#([0-9a-fA-F]{6})$/.test(brand)) {
      const root = document.documentElement
      root.style.setProperty('--primary', brand)
      root.style.setProperty('--primary-foreground', '#ffffff')
      root.style.setProperty('--ring', brand)
    }
  } catch {
    // silencioso
  }
})
</script>

<template>
  <main class="mx-auto max-w-5xl px-4 py-4">
    <header class="flex items-center justify-between gap-3 py-2">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-semibold">Cardápio</h1>
        <Badge v-if="!statusLoading && status.open === true" variant="default">Aberto</Badge>
        <Badge v-else-if="!statusLoading && status.paused" variant="destructive">Pausado</Badge>
        <Badge v-else-if="!statusLoading && status.open === false" variant="secondary">Fechado</Badge>
      </div>
      <div class="flex items-center gap-2">
        <div class="hidden md:block w-64">
          <Input v-model="search" placeholder="Buscar produtos..." class="w-full" />
        </div>
        <Button variant="outline" @click="showInspiration = !showInspiration">{{ showInspiration ? 'Ver lista' : 'Ver inspiração' }}</Button>
      </div>
    </header>

    <section v-if="!showInspiration" class="mt-3 space-y-4">
      <div class="md:hidden">
        <Input v-model="search" placeholder="Buscar produtos..." class="w-full" />
      </div>
      <CategoriesList v-model="selectedCategoryId" />
      <ProductsGrid :selectedCategoryId="selectedCategoryId" :searchQuery="search" />
    </section>

    <section v-else class="mt-3">
      <InspirationView />
    </section>

    <BusinessStatusOverlay :status="status" :hours="hours" :pause="pause" :loading="statusLoading" />
  </main>
  <Footer />
</template>

<style scoped>
</style>
