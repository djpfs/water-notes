<script setup lang="ts">
import { onUnmounted, watch } from 'vue'

const props = defineProps<{
  open: boolean
  nickname: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  done: []
}>()

const particles = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${8 + ((i * 37) % 84)}%`,
  delay: `${(i % 8) * 0.08}s`,
  size: 6 + (i % 5) * 3,
  hue: 70 + (i % 6) * 12,
}))

let timer: ReturnType<typeof setTimeout> | undefined

function dismiss() {
  if (timer) clearTimeout(timer)
  emit('update:open', false)
  emit('done')
}

watch(
  () => props.open,
  (isOpen) => {
    if (timer) clearTimeout(timer)
    if (isOpen) timer = setTimeout(dismiss, 3200)
  },
  { immediate: true },
)

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="celebrate">
      <div
        v-if="open"
        class="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-teal-deep/88 px-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebrate-title"
        @click="dismiss"
      >
        <span
          v-for="p in particles"
          :key="p.id"
          class="particle absolute top-[-10%]"
          :style="{
            left: p.left,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: p.delay,
            background: `oklch(0.82 0.14 ${p.hue})`,
          }"
        />

        <div class="relative z-10 max-w-sm text-center" @click.stop>
          <div class="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-amber/90 shadow-lg">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                stroke="oklch(0.35 0.06 70)"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <h2 id="celebrate-title" class="font-display text-3xl font-bold text-surface-raised">
            Meta batida!
          </h2>
          <p class="mt-2 text-base text-mist">
            Mandou bem, {{ nickname }}. Hidratação em dia.
          </p>
          <button
            type="button"
            class="mt-8 h-12 min-w-[10rem] rounded-2xl bg-surface-raised px-6 font-semibold text-teal-deep"
            @click="dismiss"
          >
            Continuar
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.particle {
  border-radius: 999px;
  animation: fall 2.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
}

@keyframes fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  100% {
    transform: translateY(110vh) rotate(220deg);
    opacity: 0.2;
  }
}

.celebrate-enter-active,
.celebrate-leave-active {
  transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.celebrate-enter-from,
.celebrate-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .particle {
    animation: none;
    opacity: 0;
  }
}
</style>
