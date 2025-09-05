<script setup>
import { ref, computed } from 'vue'
import { useCart } from '../stores/cart'

const props = defineProps({
  product: { type: Object, required: true }
})

const cart = useCart()
const qty = ref(1)
const size = ref(props.product.sizes ? props.product.sizes[0] : null)
const chosen = ref([])

const basePrice = computed(()=> props.product.price + chosen.value.reduce((a,o)=>a+o.price,0))
const priceText = computed(()=> basePrice.value.toLocaleString('pt-BR', { style:'currency', currency:'BRL' }))

const toggleOption = (opt) => {
  const i = chosen.value.findIndex(o=>o.id===opt.id)
  if(i>=0) chosen.value.splice(i,1)
  else chosen.value.push(opt)
}

const addToCart = () => {
  cart.add({
    id: props.product.id,
    title: props.product.title,
    image: props.product.image,
    price: basePrice.value,
    size: size.value,
    options: chosen.value.map(o=>o.id)
  })
  qty.value = 1
  chosen.value = []
}
</script>

<template>
  <div class="card">
    <img :src="product.image" :alt="product.title" />
    <div class="content">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <h3 style="margin:0;font-size:1.1rem">{{ product.title }}</h3>
        <span class="price">{{ priceText }}</span>
      </div>
      <p class="muted" style="min-height:44px">{{ product.description }}</p>

      <div v-if="product.sizes" style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap">
        <span class="muted" style="font-size:.85rem">Tamanho:</span>
        <button v-for="s in product.sizes" :key="s" class="tab" :class="{active:size===s}" @click="size=s">{{ s }}</button>
      </div>

      <div v-if="product.options?.length" style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px">
        <button v-for="o in product.options" :key="o.id" class="tab" :class="{active:chosen.some(x=>x.id===o.id)}" @click="toggleOption(o)">
          {{ o.label }} <small v-if="o.price"> (+{{ o.price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }})</small>
        </button>
      </div>

      <button class="btn" @click="addToCart">
        Adicionar
      </button>
    </div>
  </div>
</template>
