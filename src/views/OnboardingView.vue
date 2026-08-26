<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AvatarPicker from '@/components/AvatarPicker.vue'
import { useAppStore } from '@/stores/app'
import { ML_PER_KG } from '@/types'
import { formatVolume } from '@/utils/date'

const router = useRouter()
const store = useAppStore()

const step = ref(0)
const nickname = ref(store.profile.nickname || '')
const weightKg = ref(String(store.profile.weightKg || 70))
const avatarId = ref(store.profile.avatarId || 'drop')
const useProfilePhoto = ref(store.profile.useProfilePhoto)
const useCustomGoal = ref(false)
const customGoal = ref('')

const steps = [
  'Como te chamamos?',
  'Qual seu peso?',
  'Escolha um avatar',
  'Sua meta diária',
]

const weightNumber = computed(() => {
  const n = Number(String(weightKg.value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
})

const suggestedGoal = computed(() =>
  Math.round(Math.max(0, weightNumber.value) * ML_PER_KG),
)

const customGoalNumber = computed(() => {
  const n = Number(String(customGoal.value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
})

const canNext = computed(() => {
  if (step.value === 0) return nickname.value.trim().length >= 2
  if (step.value === 1) return weightNumber.value >= 20 && weightNumber.value <= 300
  if (step.value === 2) {
    return useProfilePhoto.value
      ? Boolean(store.profile.photoUrl)
      : Boolean(avatarId.value)
  }
  if (step.value === 3) {
    if (!useCustomGoal.value) return true
    return customGoalNumber.value >= 500 && customGoalNumber.value <= 10000
  }
  return false
})

function finish() {
  store.completeOnboarding({
    nickname: nickname.value,
    weightKg: weightNumber.value,
    avatarId: avatarId.value,
    useProfilePhoto: useProfilePhoto.value,
    goalOverrideMl: useCustomGoal.value ? customGoalNumber.value : null,
  })
  router.push({ name: 'goal-reveal' })
}

function next() {
  if (!canNext.value) return
  if (step.value < 3) {
    if (step.value === 1) {
      customGoal.value = String(suggestedGoal.value)
    }
    step.value += 1
    return
  }
  finish()
}

function back() {
  if (step.value > 0) step.value -= 1
}
</script>

<template>
  <main class="safe-pb safe-pt flex min-h-dvh flex-col px-5">
    <header class="mb-6 pt-2">
      <div class="flex items-center justify-between">
        <p class="text-xs font-semibold uppercase tracking-wider text-teal">
          Passo {{ step + 1 }} de 4
        </p>
      </div>
      <div class="mt-3 flex gap-1.5">
        <span
          v-for="i in 4"
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
          Sugestão: {{ formatVolume(suggestedGoal) }} ({{ ML_PER_KG }} ml/kg).
        </p>
      </div>

      <div v-else-if="step === 2">
        <AvatarPicker
          v-model="avatarId"
          v-model:use-photo="useProfilePhoto"
          :photo-url="store.profile.photoUrl"
        />
      </div>

      <div v-else>
        <p class="text-sm text-ink-soft">
          Calculado: <strong class="text-ink">{{ formatVolume(suggestedGoal) }}</strong>
        </p>
        <label class="mt-4 flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
          <input v-model="useCustomGoal" type="checkbox" class="size-5 accent-[oklch(0.48_0.08_195)]" />
          <span class="text-sm font-medium text-ink">Definir meta manual</span>
        </label>
        <label v-if="useCustomGoal" class="mt-3 block">
          <span class="mb-2 block text-sm font-medium text-ink-soft">Meta em ml</span>
          <input
            v-model="customGoal"
            type="number"
            inputmode="numeric"
            min="500"
            max="10000"
            step="50"
            class="h-14 w-full rounded-2xl bg-surface px-4 font-display text-2xl font-bold text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
          />
        </label>
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
        {{ step === 3 ? 'Continuar' : 'Avançar' }}
      </button>
    </div>
  </main>
</template>
