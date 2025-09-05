<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import type { BusinessHours, PauseState } from '@/types'

const props = defineProps<{
  status: { label: string; open: boolean | null; paused?: boolean; message?: string }
  hours: BusinessHours | null
  pause: PauseState
  loading: boolean
}>()

const open = ref(false)

const showOverlay = computed(() => !props.loading && ((props.status as any).paused || props.status.open === false))

watchEffect(() => {
  open.value = showOverlay.value
})
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="bottom" class="sm:max-w-[560px]">
      <SheetHeader>
        <SheetTitle>
          {{ (props.status as any).paused ? 'Estabelecimento em Pausa' : 'Estamos Fechados' }}
        </SheetTitle>
        <SheetDescription>
          <template v-if="(props.status as any).paused">
            {{ (props.status as any).message || 'Temporariamente indisponível para novos pedidos.' }}
          </template>
          <template v-else>
            Voltaremos no próximo horário de funcionamento.
          </template>
        </SheetDescription>
      </SheetHeader>
      <div class="mt-4 space-y-3">
        <div class="text-sm text-muted-foreground">Horários de hoje</div>
        <div class="rounded-md border p-3 text-sm">
          <template v-if="props.hours">
            <div v-for="(cfg, day) in props.hours" :key="day" v-show="day === new Date().toLocaleDateString('en-US',{weekday:'long'}).toLowerCase()">
              <span class="font-medium capitalize">{{ day }}</span>:
              <span v-if="cfg.closed">Fechado</span>
              <span v-else-if="cfg.open==='00:00' && cfg.close==='00:00'">24 horas</span>
              <span v-else>{{ cfg.open }} - {{ cfg.close }}</span>
            </div>
          </template>
          <template v-else>
            Não foi possível carregar horários.
          </template>
        </div>
        <Separator />
        <p class="text-xs text-muted-foreground">As informações são atualizadas automaticamente.</p>
      </div>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
</style>