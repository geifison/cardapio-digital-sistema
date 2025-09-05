<script setup>
import { reactive, computed, ref } from 'vue'
import { useCart } from '../stores/cart'

const cart = useCart()
const form = reactive({
  nome: cart.customer?.nome || '',
  telefone: cart.customer?.telefone || '',
  tipoEntrega: 'delivery',
  endereco: cart.customer?.endereco || '',
  numero: cart.customer?.numero || '',
  bairro: cart.customer?.bairro || '',
  referencia: cart.customer?.referencia || '',
  pagamento: 'pix',
  cupom: ''
})

const currency = (v)=> v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const errors = ref({})

const validate = () => {
  const e = {}
  if(!form.nome) e.nome = 'Informe seu nome'
  if(!/^\(?:(?:\+|00)55)?\s?(?:\(?\d{2}\)?\s?)?(?:9?\d{4})-?\d{4}$/.test(form.telefone)) e.telefone = 'Telefone inválido'
  if(form.tipoEntrega==='delivery' && !form.endereco) e.endereco = 'Endereço é obrigatório'
  errors.value = e
  return !Object.keys(e).length
}

const applyCoupon = () => cart.applyCoupon(form.cupom)

const mensagemWhatsApp = computed(()=>{
  const lines = []
  lines.push('*Novo Pedido*')
  lines.push('')
  cart.items.forEach((it,idx)=>{
    lines.push(`${idx+1}. ${it.title} ${it.size?`(${it.size})`:''} x${it.qty} — ${currency(it.price)}`)
    if(it.options?.length) lines.push(`   • Opções: ${it.options.join(', ')}`)
  })
  lines.push('')
  lines.push(`Subtotal: ${currency(cart.subtotal)}`)
  lines.push(`Entrega: ${currency(cart.deliveryFee)}`)
  if(cart.discount) lines.push(`Desconto: -${currency(cart.discount)}`)
  lines.push(`*Total: ${currency(cart.total)}*`)
  lines.push('')
  lines.push('*Cliente*')
  lines.push(`${form.nome} • ${form.telefone}`)
  if(form.tipoEntrega==='delivery'){
    lines.push(`Entrega em: ${form.endereco}, ${form.numero} - ${form.bairro}`)
    if(form.referencia) lines.push(`Ref.: ${form.referencia}`)
  } else {
    lines.push('Retirada no balcão')
  }
  lines.push('')
  lines.push(`Pagamento: ${form.pagamento.toUpperCase()}`)
  return encodeURIComponent(lines.join('\n'))
})

const finalizar = () => {
  if(!cart.items.length) return alert('Seu carrinho está vazio.')
  if(!validate()) return

  cart.setCustomer({
    nome: form.nome,
    telefone: form.telefone,
    endereco: form.endereco,
    numero: form.numero,
    bairro: form.bairro,
    referencia: form.referencia
  })

  const numeroLoja = '5599999999999' // coloque o número do WhatsApp aqui com DDI/DDD
  const url = `https://wa.me/${numeroLoja}?text=${mensagemWhatsApp.value}`
  window.open(url, '_blank')
}
</script>

<template>
  <div class="container" style="padding-top:96px;max-width:900px">
    <h2>Finalizar Pedido</h2>

    <div class="grid" style="grid-template-columns: 1.2fr .8fr; gap: 20px">
      <div class="card">
        <div class="content">
          <h3>Dados do Cliente</h3>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">
            <div style="grid-column: span 2">
              <label>Nome</label>
              <input v-model="form.nome" placeholder="Seu nome completo" />
              <small class="muted" v-if="errors.nome">{{ errors.nome }}</small>
            </div>
            <div>
              <label>Telefone (WhatsApp)</label>
              <input v-model="form.telefone" placeholder="(99) 99999-9999" />
              <small class="muted" v-if="errors.telefone">{{ errors.telefone }}</small>
            </div>
            <div>
              <label>Entrega ou retirada</label>
              <select v-model="form.tipoEntrega">
                <option value="delivery">Entrega</option>
                <option value="retirada">Retirada</option>
              </select>
            </div>

            <template v-if="form.tipoEntrega==='delivery'">
              <div style="grid-column: span 2">
                <label>Endereço</label>
                <input v-model="form.endereco" placeholder="Rua/Avenida, complemento" />
                <small class="muted" v-if="errors.endereco">{{ errors.endereco }}</small>
              </div>
              <div>
                <label>Número</label>
                <input v-model="form.numero" />
              </div>
              <div>
                <label>Bairro</label>
                <input v-model="form.bairro" />
              </div>
              <div style="grid-column: span 2">
                <label>Ponto de referência (opcional)</label>
                <input v-model="form.referencia" />
              </div>
            </template>

            <div>
              <label>Pagamento</label>
              <select v-model="form.pagamento">
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
            <div>
              <label>Cupom</label>
              <div style="display:flex;gap:8px">
                <input v-model="form.cupom" placeholder="FRETEZERO ou 10OFF" />
                <button class="btn secondary" type="button" @click="applyCoupon">Aplicar</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="content">
          <h3>Resumo</h3>
          <div v-if="cart.items.length; else vazio">
            <div v-for="(it,idx) in cart.items" :key="idx" style="display:flex;justify-content:space-between;margin:6px 0">
              <div>
                <strong>{{ it.title }}</strong>
                <small class="muted" v-if="it.size"> ({{ it.size }})</small>
                <div class="muted" v-if="it.options?.length">Opções: {{ it.options.join(', ') }}</div>
              </div>
              <span>{{ it.qty }} x {{ currency(it.price) }}</span>
            </div>
            <hr style="border-color:#1f2937"/>
            <div style="display:flex;justify-content:space-between"><span>Subtotal</span><strong>{{ currency(cart.subtotal) }}</strong></div>
            <div style="display:flex;justify-content:space-between"><span>Entrega</span><strong>{{ currency(cart.deliveryFee) }}</strong></div>
            <div style="display:flex;justify-content:space-between"><span>Desconto</span><strong>-{{ currency(cart.discount) }}</strong></div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:1.1rem"><span>Total</span><strong>{{ currency(cart.total) }}</strong></div>
            <button class="btn" style="width:100%;margin-top:12px" @click="finalizar">Enviar pelo WhatsApp</button>
          </div>
          <template #fallback></template>
          <template v-if="false"></template>
          <template #default></template>
          <template #empty></template>
          <template #loading></template>
          <template #error></template>
          <template #success></template>
          <template #vazio></template>
          <template #">
          </template>
          <template #footer></template>
          <template v-slot:vazio>
            <div class="empty">Seu carrinho está vazio.</div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
