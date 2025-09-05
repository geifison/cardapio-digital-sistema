<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Product } from '@/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Heart, MessageCircle, X } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  product: Product | null
  likes: number
  comments: { user: string; text: string }[]
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'like', id: number): void
  (e: 'comment', payload: { id: number; text: string }): void
}>()

const openProxy = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const commentText = ref('')

function handleLike() {
  if (!props.product) return
  emit('like', props.product.id)
}

function handleSubmitComment() {
  if (!props.product) return
  const text = commentText.value.trim()
  if (!text) return
  emit('comment', { id: props.product.id, text })
  commentText.value = ''
}

watch(
  () => props.product,
  () => {
    commentText.value = ''
  }
)
</script>

<template>
  <Sheet v-model:open="openProxy">
    <SheetContent side="right" class="p-0 w-full sm:max-w-lg">
      <div v-if="product" class="flex flex-col h-full">
        <!-- Header imagem -->
        <div class="relative w-full aspect-square bg-muted">
          <img :src="product.image_url || 'https://placehold.co/800x800/ddd/333?text=Produto'" :alt="product.name" class="w-full h-full object-cover" />
          <SheetClose as-child>
            <Button size="icon" variant="secondary" class="absolute top-3 right-3">
              <X class="h-4 w-4" />
            </Button>
          </SheetClose>
        </div>

        <!-- Conteúdo -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-xl font-semibold leading-tight">{{ product.name }}</h3>
              <p class="text-sm text-muted-foreground mt-1">{{ product.description }}</p>
            </div>
            <div class="text-right shrink-0">
              <div class="text-lg font-bold text-primary">
                {{ typeof product.price === 'number' ? product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : product.price }}
              </div>
            </div>
          </div>

          <!-- Ações -->
          <div class="flex items-center gap-3 pt-2">
            <Button variant="outline" size="sm" @click.stop="handleLike">
              <Heart class="h-4 w-4 mr-2" /> Curtir <span class="ml-2 font-semibold">{{ likes }}</span>
            </Button>
            <Button variant="ghost" size="sm">
              <MessageCircle class="h-4 w-4 mr-2" /> Comentar
            </Button>
          </div>

          <!-- Comentários -->
          <div class="mt-2 space-y-2">
            <div v-if="!comments || comments.length === 0" class="text-sm text-muted-foreground">Seja o primeiro a comentar.</div>
            <div v-else>
              <div v-for="(c, idx) in comments" :key="idx" class="text-sm">
                <span class="font-medium">{{ c.user }}:</span>
                <span class="ml-1 text-foreground/90">{{ c.text }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="border-t p-3 flex items-center gap-2">
          <Input v-model="commentText" placeholder="Adicionar um comentário…" @keydown.enter.prevent="handleSubmitComment" />
          <Button @click="handleSubmitComment">Publicar</Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>