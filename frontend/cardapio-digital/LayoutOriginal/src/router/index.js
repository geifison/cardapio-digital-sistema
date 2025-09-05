import { createRouter, createWebHashHistory } from 'vue-router'
import Menu from '../pages/Menu.vue'
import Checkout from '../pages/Checkout.vue'

const routes = [
  { path: '/', name: 'Menu', component: Menu },
  { path: '/checkout', name: 'Checkout', component: Checkout },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

export default router
