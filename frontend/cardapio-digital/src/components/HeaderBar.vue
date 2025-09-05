<script setup>
import { computed, ref } from 'vue'
import { useCart } from '../stores/cart'
import { useRoute, useRouter } from 'vue-router'

const cart = useCart()
const router = useRouter()
const route = useRoute()
const q = ref('')

const goHome = () => router.push('/')
const goCheckout = () => router.push('/checkout')

const qty = computed(()=>cart.quantity)
</script>

<template>
  <div class="toolbar">
    <div class="container toolbar-inner">
      <div style="display:flex;align-items:center;gap:10px;cursor:pointer" @click="goHome">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M12 2l9 7-1.5 2L18 9.5V20a2 2 0 0 1-2 2h-2v-6H10v6H8a2 2 0 0 1-2-2V9.5L4.5 11 3 9l9-7z" fill="#16a34a"/>
        </svg>
        <strong style="font-size:1.1rem">Burger & Pizza</strong>
        <span class="badge">Delivery</span>
      </div>

      <div class="search" v-if="route.name==='Menu'">
        <input v-model="q" placeholder="Buscar no cardápio..." @input="$emit('search', q)" />
      </div>

      <div style="display:flex;gap:10px">
        <button class="btn secondary" @click="goHome" v-if="route.name!=='Menu'">Cardápio</button>
        <button class="btn" @click="goCheckout">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M7 4h-2l-2 12a2 2 0 0 0 2 2h14l2-10H7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Carrinho ({{ qty }})
        </button>
      </div>
    </div>
  </div>
</template>
