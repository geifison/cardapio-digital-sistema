<script setup>
import HeaderBar from './components/HeaderBar.vue'
import CartDrawer from './components/CartDrawer.vue'
</script>

<template>
  <HeaderBar />
  <router-view />
  <CartDrawer />
</template>
