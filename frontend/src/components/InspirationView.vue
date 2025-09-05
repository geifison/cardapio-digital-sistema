<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getCategories, getProducts, getCompanyInfo } from '@/lib/api'
import type { Category, Product } from '@/types'
import ProductDetailsSheet from './ProductDetailsSheet.vue'
import { Grid as GridIcon, Star } from 'lucide-vue-next'

const categories = ref<Category[]>([])
const products = ref<Product[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const selectedCategory = ref<'Todos' | number>('Todos')
const openDetails = ref(false)
const selectedProduct = ref<Product | null>(null)

// state local para likes e comentarios
const likes = ref<Record<number, number>>({})
const comments = ref<Record<number, { user: string; text: string }[]>>({})

// perfil
const companyName = ref<string>('')
const companyBio = ref<string>('')
const companyRating = ref<number>(4.8)
const profileInitials = computed(() => (companyName.value || 'Loja').slice(0, 2).toUpperCase())

onMounted(async () => {
  try {
    loading.value = true
    const [cats, prods, info] = await Promise.all([
      getCategories(),
      getProducts(),
      // pode falhar; seguimos com placeholders
      getCompanyInfo().catch(() => null)
    ])
    categories.value = cats
    products.value = prods

    // init likes/comments
    for (const p of prods) {
      likes.value[p.id] = 0
      comments.value[p.id] = []
    }

    if (info) {
      companyName.value = (info as any)?.company_name || (info as any)?.name || 'Estabelecimento'
      companyBio.value = (info as any)?.company_description || (info as any)?.description || 'Sabor que conquista desde sempre.'
      const ratingMaybe = Number((info as any)?.rating)
      if (!Number.isNaN(ratingMaybe) && ratingMaybe > 0) companyRating.value = ratingMaybe
    } else {
      companyName.value = 'Estabelecimento'
      companyBio.value = 'Sabor que conquista desde sempre.'
    }
  } catch (e: any) {
    error.value = e?.message ?? 'Falha ao carregar dados'
  } finally {
    loading.value = false
  }
})

const filtered = computed(() => {
  if (selectedCategory.value === 'Todos') return products.value
  return products.value.filter(p => p.category_id === selectedCategory.value)
})

function openProduct(p: Product) {
  selectedProduct.value = p
  openDetails.value = true
}

function onLike(id: number) {
  likes.value[id] = (likes.value[id] || 0) + 1
}

function onComment(payload: { id: number; text: string }) {
  const list = comments.value[payload.id] || []
  list.push({ user: 'visitante', text: payload.text })
  comments.value[payload.id] = list
}
</script>

<template>
  <section class="max-w-5xl mx-auto px-4 py-4">
    <div v-if="loading" class="text-sm text-muted-foreground">Carregando…</div>
    <div v-else-if="error" class="text-sm text-destructive">{{ error }}</div>

    <div v-else class="space-y-4">
      <!-- Header com imagem de capa fictícia e avatar central -->
      <div class="relative w-full h-40 md:h-48 overflow-hidden rounded-md bg-[url('https://placehold.co/1200x400/000/FFF?text=Sua+Marca')] bg-cover bg-center">
        <div class="absolute left-1/2 -translate-x-1/2 -bottom-8 z-10">
          <div class="w-24 h-24 md:w-28 md:h-28 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold border-4 border-background shadow">
            {{ profileInitials }}
          </div>
        </div>
      </div>

      <div class="bg-background rounded-md p-4 pt-12 text-center">
        <div class="flex items-center justify-center gap-3 mb-2">
          <h2 class="text-2xl md:text-3xl font-light">{{ companyName }}</h2>
          <div class="flex items-center text-foreground/80">
            <span class="font-semibold">{{ companyRating }}</span>
            <Star class="h-4 w-4 text-amber-500 ml-1" />
          </div>
        </div>
        <p class="text-sm text-muted-foreground">{{ companyBio }}</p>
      </div>

      <!-- Abas/Categorias -->
      <div class="border-t mt-2 flex justify-center gap-3 py-2">
        <button
          class="uppercase text-xs font-semibold -mt-2 pt-2"
          :class="selectedCategory === 'Todos' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'"
          @click="selectedCategory = 'Todos'"
        >
          <GridIcon class="inline h-4 w-4 mr-1" /> Todos
        </button>
        <button v-for="c in categories" :key="c.id"
          class="uppercase text-xs font-semibold -mt-2 pt-2"
          :class="selectedCategory === c.id ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'"
          @click="selectedCategory = c.id"
        >
          {{ c.name }}
        </button>
      </div>

      <!-- Grade -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="p in filtered" :key="p.id" class="bg-muted rounded-lg overflow-hidden flex cursor-pointer hover:shadow transition" @click="openProduct(p)">
          <div class="w-1/2">
            <img :src="p.image_url || 'https://placehold.co/600x600/ddd/333?text=Produto'" :alt="p.name" class="w-full h-full object-cover" />
          </div>
          <div class="w-1/2 p-4 flex flex-col justify-center">
            <h3 class="font-semibold">{{ p.name }}</h3>
            <p class="font-bold text-primary mt-1">
              {{ typeof p.price === 'number' ? p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : p.price }}
            </p>
          </div>
        </div>
      </div>

      <!-- Sheet de detalhes -->
      <ProductDetailsSheet
        v-model:open="openDetails"
        :product="selectedProduct"
        :likes="selectedProduct ? (likes[selectedProduct.id] || 0) : 0"
        :comments="selectedProduct ? (comments[selectedProduct.id] || []) : []"
        @like="onLike"
        @comment="onComment"
      />
    </div>
  </section>
</template>