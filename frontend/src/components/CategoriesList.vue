<script setup lang="ts">
import { onMounted, ref, watchEffect } from 'vue'
import { getCategories } from '../lib/api'
import type { Category } from '../types'
import { Button } from '@/components/ui/button'

const modelValue = defineModel<number | null>({ default: null })

const categories = ref<Category[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    categories.value = await getCategories()
  } catch (e: any) {
    error.value = e?.message ?? 'Erro ao carregar categorias'
  } finally {
    loading.value = false
  }
})

function select(catId: number | null) {
  modelValue.value = catId
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="loading" class="flex gap-2">
      <div class="h-8 w-20 bg-muted/40 rounded" />
      <div class="h-8 w-24 bg-muted/40 rounded" />
      <div class="h-8 w-16 bg-muted/40 rounded" />
    </div>
    <div v-else-if="error" class="text-red-600 text-sm">{{ error }}</div>
    <div v-else class="flex gap-2 overflow-x-auto pb-1 [&>*]:shrink-0">
      <Button
        variant="outline"
        size="sm"
        :class="!modelValue ? 'bg-primary text-primary-foreground border-primary' : ''"
        @click="select(null)"
      >Todos</Button>
      <Button
        v-for="cat in categories"
        :key="cat.id"
        variant="outline"
        size="sm"
        :class="modelValue === cat.id ? 'bg-primary text-primary-foreground border-primary' : ''"
        @click="select(cat.id)"
      >{{ cat.name }}</Button>
    </div>
  </div>
</template>