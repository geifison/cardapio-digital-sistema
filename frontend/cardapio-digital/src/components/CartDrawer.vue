<script setup>
import { computed, ref } from 'vue'
import { useCart } from '../stores/cart'
import { useRouter } from 'vue-router'

const cart = useCart()
const router = useRouter()
const open = ref(false)

const currency = (v)=> v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const hasItems = computed(()=> cart.items.length > 0)

const goCheckout = () => {
  open.value = false
  router.push('/checkout')
}
</script>

<template>
  <div class="cart-fab" v-show="!open">
    <button class="btn" @click="open = true">
      Ver Carrinho • {{ cart.quantity }} itens · {{ currency(cart.subtotal) }}
    </button>
  </div>

  <div v-if="open" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100" @click.self="open=false">
    <div style="position:absolute;right:0;top:0;bottom:0;width:380px;background:#0b1225;border-left:1px solid #1f2937;padding:16px;overflow:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0">Seu Carrinho</h3>
        <button class="btn secondary" @click="open=false">Fechar</button>
      </div>

      <div v-if="!hasItems" class="empty">Seu carrinho está vazio.</div>

      <div v-else class="grid" style="gap:12px">
        <div v-for="(it,idx) in cart.items" :key="idx" class="card" style="display:flex">
          <img :src="it.image" style="width:96px;height:96px;object-fit:cover">
          <div class="content" style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:start">
              <div>
                <strong>{{ it.title }}</strong>
                <div class="muted" v-if="it.size">Tam: {{ it.size }}</div>
                <div class="muted" v-if="it.options?.length">Opções: {{ it.options.join(', ') }}</div>
              </div>
              <span>{{ currency(it.price) }}</span>
            </div>

            <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
              <button class="tab" @click="cart.setQty(idx, it.qty-1)">-</button>
              <span>{{ it.qty }}</span>
              <button class="tab" @click="cart.setQty(idx, it.qty+1)">+</button>
              <button class="tab" style="margin-left:auto" @click="cart.remove(idx)">Remover</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasItems" style="margin-top:16px;border-top:1px solid #1f2937;padding-top:12px">
        <div style="display:flex;justify-content:space-between"><span>Subtotal</span><strong>{{ currency(cart.subtotal) }}</strong></div>
        <div style="display:flex;justify-content:space-between"><span>Entrega</span><strong>{{ currency(cart.deliveryFee) }}</strong></div>
        <div style="display:flex;justify-content:space-between"><span>Desconto</span><strong>-{{ currency(cart.discount) }}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:1.2rem"><span>Total</span><strong>{{ currency(cart.total) }}</strong></div>
        <button class="btn" style="width:100%;margin-top:12px" @click="goCheckout">Finalizar Pedido</button>
      </div>
    </div>
  </div>
</template>
