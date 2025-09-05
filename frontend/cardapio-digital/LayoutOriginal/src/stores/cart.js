import { defineStore } from 'pinia'

export const useCart = defineStore('cart', {
  state: () => ({
    items: JSON.parse(localStorage.getItem('cart_items') || '[]'),
    customer: JSON.parse(localStorage.getItem('cart_customer') || '{}'),
    deliveryFee: 7.9,
    discount: 0
  }),
  getters: {
    quantity: (state) => state.items.reduce((a,i)=>a+i.qty,0),
    subtotal: (state) => state.items.reduce((a,i)=>a + i.qty * i.price, 0),
    total: (state) => Math.max(0, state.subtotal + (state.quantity ? state.deliveryFee : 0) - state.discount),
  },
  actions: {
    add(item) {
      const key = JSON.stringify({id:item.id, size:item.size, options:item.options?.sort?.() || []})
      const idx = this.items.findIndex(i => JSON.stringify({id:i.id,size:i.size,options:i.options?.sort?.()||[]}) === key)
      if (idx >= 0) this.items[idx].qty += item.qty || 1
      else this.items.push({ ...item, qty: item.qty || 1 })
      this.persist()
    },
    remove(index) {
      this.items.splice(index,1)
      this.persist()
    },
    setQty(index, qty){
      if(qty<=0){ this.remove(index); return }
      this.items[index].qty = qty
      this.persist()
    },
    clear(){
      this.items = []
      this.persist()
    },
    setCustomer(data){
      this.customer = data
      localStorage.setItem('cart_customer', JSON.stringify(this.customer))
    },
    applyCoupon(code){
      // cupom simples de exemplo
      if(code?.toUpperCase() === 'FRETEZERO'){
        this.discount = this.deliveryFee
      } else if(code?.toUpperCase() === '10OFF'){
        this.discount = Math.min(10, this.subtotal * 0.1)
      } else {
        this.discount = 0
      }
    },
    persist(){
      localStorage.setItem('cart_items', JSON.stringify(this.items))
    }
  }
})
