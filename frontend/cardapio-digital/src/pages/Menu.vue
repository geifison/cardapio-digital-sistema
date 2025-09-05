<script setup>
import { ref, computed, onMounted } from 'vue'
import ProductCard from '../components/ProductCard.vue'
import { items, categories } from '../data/menu'

const search = ref('')
const active = ref('todos')

const allCategories = [{id:'todos', label:'Todos'}, ...categories]

const filtered = computed(()=> {
  let list = items
  if(active.value !== 'todos') list = list.filter(i=>i.category === active.value)
  if(search.value) {
    const s = search.value.toLowerCase()
    list = list.filter(i => [i.title, i.description].join(' ').toLowerCase().includes(s))
  }
  return list
})

const emitSearch = (q)=>{ search.value = q }
</script>

<template>
  <div class="container" style="padding-top:90px">
    <div class="tabs" style="margin-bottom:16px">
      <button v-for="c in allCategories" :key="c.id" class="tab" :class="{active:active===c.id}" @click="active=c.id">{{ c.label }}</button>
    </div>

    <div class="grid cols-3" v-if="filtered.length">
      <ProductCard v-for="p in filtered" :key="p.id" :product="p" />
    </div>
    <div v-else class="empty">Nada encontrado no cardápio.</div>
  </div>
</template>
