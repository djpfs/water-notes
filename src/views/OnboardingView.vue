<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AvatarPicker from '@/components/AvatarPicker.vue'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const store = useAppStore()

const step = ref(0)
const nickname = ref('')
const weightKg = ref('70')
const avatarId = ref('drop')

const steps = ['Como te chamamos?', 'Qual seu peso?', 'Escolha um avatar']

const weightNumber = computed(() => {
  const n = Number(String(weightKg.value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
})

const canNext = computed(() => {
  if (step.value === 0) return nickname.value.trim().length >= 2
  if (step.value === 1) return weightNumber.value >= 20 && weightNumber.value <= 300
  return Boolean(avatarId.value)
})

function next() {
  if (!canNext.value) return
  if (step.value < 2) {
    step.value += 1
    return
  }
  store.completeOnboarding({
    nickname: nickname.value,
    weightKg: weightNumber.value,
    avatarId: avatarId.value,
  })
  router.push({ name: 'goal-reveal' })
}

function back() {
  if (step.value > 0) step.value -= 1
}
</script>

<template>
  <main class="safe-pb safe-pt flex min-h-dvh flex-col px-5">
    <header class="mb-8 pt-2">
      <p class="text-xs font-semibold uppercase tracking-wider text-teal">
        Passo {{ step + 1 }} de 3
      </p>
      <div class="mt-3 flex gap-1.5">
        <span
          v-for="i in 3"
          :key="i"
          class="h-1.5 flex-1 rounded-full transition-colors duration-300"
          :class="i - 1 <= step ? 'bg-teal' : 'bg-line'"
        />
      </div>
      <h1 class="mt-6 font-display text-3xl font-bold text-ink">
        {{ steps[step] }}
      </h1>
    </header>

    <div class="flex-1">
      <div v-if="step === 0">
        <label class="block">
          <span class="mb-2 block text-sm font-medium text-ink-soft">Apelido</span>
          <input
            v-model="nickname"
            type="text"
            maxlength="24"
            autocomplete="nickname"
            placeholder="Ex.: João"
            class="h-14 w-full rounded-2xl bg-surface px-4 text-lg text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
          />
        </label>
      </div>

      <div v-else-if="step === 1">
        <label class="block">
          <span class="mb-2 block text-sm font-medium text-ink-soft">Peso em kg</span>
          <div class="relative">
            <input
              v-model="weightKg"
              type="number"
              inputmode="decimal"
              min="20"
              max="300"
              step="0.1"
              class="h-14 w-full rounded-2xl bg-surface px-4 pr-14 font-display text-2xl font-bold text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
            />
            <span class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-soft">
              kg
            </span>
          </div>
        </label>
        <p class="mt-3 text-sm text-ink-soft">
          Usamos 35 ml por kg para calcular sua meta diária.
        </p>
      </div>

      <div v-else>
        <AvatarPicker v-model="avatarId" />
      </div>
    </div>

    <div class="mt-6 flex gap-3">
      <button
        v-if="step > 0"
        type="button"
        class="h-13 min-h-12 flex-1 rounded-2xl bg-mist-deep font-semibold text-ink-soft"
        @click="back"
      >
        Voltar
      </button>
      <button
        type="button"
        class="h-13 min-h-12 flex-[1.4] rounded-2xl bg-teal font-semibold text-surface-raised disabled:opacity-40"
        :disabled="!canNext"
        @click="next"
      >
        {{ step === 2 ? 'Continuar' : 'Avançar' }}
      </button>
    </div>
  </main>
</template>
