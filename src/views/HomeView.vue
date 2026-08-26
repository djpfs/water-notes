<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AvatarIcon from '@/components/AvatarIcon.vue'
import CupShortcutBar from '@/components/CupShortcutBar.vue'
import DaySummaryModal from '@/components/DaySummaryModal.vue'
import EditEntrySheet from '@/components/EditEntrySheet.vue'
import EntryList from '@/components/EntryList.vue'
import GoalCelebration from '@/components/GoalCelebration.vue'
import QuickAddSheet from '@/components/QuickAddSheet.vue'
import UndoToast from '@/components/UndoToast.vue'
import WaterVessel from '@/components/WaterVessel.vue'
import { useAppStore } from '@/stores/app'
import type { Cup, DayStat, WaterEntry } from '@/types'
import { formatVolume } from '@/utils/date'
import { hapticLight, hapticSuccess, soundGoal, soundSip } from '@/utils/feedback'

const router = useRouter()
const store = useAppStore()

const sheetOpen = ref(false)
const celebrateOpen = ref(false)
const editOpen = ref(false)
const editing = ref<WaterEntry | null>(null)
const toastMessage = ref('')
const undoEntry = ref<WaterEntry | null>(null)
const summaryOpen = ref(false)
const yesterday = ref<DayStat | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined
let dayCheckTimer: ReturnType<typeof setInterval> | undefined

watch(
  () => store.todayConsumedMl,
  async () => {
    await nextTick()
    if (store.shouldCelebrate()) {
      celebrateOpen.value = true
      store.markCelebratedToday()
      hapticSuccess()
      soundGoal()
    }
  },
)

function register(ml: number) {
  store.addEntry(ml)
  hapticLight()
  soundSip()
}

function onCup(cup: Cup) {
  register(cup.ml)
}

function onManual(ml: number) {
  register(ml)
}

function onSuggested() {
  if (store.suggestedSipMl > 0) register(store.suggestedSipMl)
}

function onRemove(id: string) {
  const removed = store.removeEntry(id)
  if (!removed) return
  undoEntry.value = removed
  toastMessage.value = 'Lançamento removido'
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
    undoEntry.value = null
  }, 5000)
}

function onUndo() {
  if (undoEntry.value) {
    store.restoreEntry(undoEntry.value)
  }
  toastMessage.value = ''
  undoEntry.value = null
}

function onEdit(entry: WaterEntry) {
  editing.value = entry
  editOpen.value = true
}

function onSaveEdit(ml: number) {
  if (!editing.value) return
  store.updateEntry(editing.value.id, ml)
  hapticLight()
}

function onCelebrateDone() {
  celebrateOpen.value = false
}

function checkDayRollover() {
  const summary = store.peekYesterdaySummary()
  if (summary) {
    yesterday.value = summary
    summaryOpen.value = true
  } else {
    store.touchActiveDate()
  }
}

function closeSummary() {
  summaryOpen.value = false
  store.acknowledgeDayRollover()
}

onMounted(() => {
  checkDayRollover()
  dayCheckTimer = setInterval(checkDayRollover, 60_000)
  document.addEventListener('visibilitychange', onVisibility)
})

onUnmounted(() => {
  if (toastTimer) clearTimeout(toastTimer)
  if (dayCheckTimer) clearInterval(dayCheckTimer)
  document.removeEventListener('visibilitychange', onVisibility)
})

function onVisibility() {
  if (document.visibilityState === 'visible') checkDayRollover()
}
</script>

<template>
  <main class="safe-pb safe-pt flex min-h-dvh flex-col px-5 pb-6">
    <header class="flex items-center justify-between pt-1">
      <div class="flex items-center gap-3">
        <AvatarIcon :id="store.profile.avatarId" :size="44" />
        <div>
          <p class="text-xs font-medium text-ink-soft">Olá,</p>
          <p class="font-display text-lg font-bold leading-tight text-ink">
            {{ store.profile.nickname }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="h-11 rounded-xl px-3 text-sm font-semibold text-teal"
          @click="router.push({ name: 'history' })"
        >
          Histórico
        </button>
        <button
          type="button"
          class="h-11 rounded-xl px-3 text-sm font-semibold text-teal"
          @click="router.push({ name: 'settings' })"
        >
          Ajustes
        </button>
      </div>
    </header>

    <div
      v-if="store.streak > 0"
      class="mt-3 rounded-2xl bg-teal/10 px-4 py-2 text-center text-sm font-semibold text-teal-deep"
    >
      Sequência: {{ store.streak }} dia{{ store.streak === 1 ? '' : 's' }}
    </div>

    <section class="mt-4">
      <WaterVessel
        :progress="store.progress"
        :consumed-ml="store.todayConsumedMl"
        :goal-ml="store.dailyGoalMl"
      />
      <p class="mt-3 text-center text-sm text-ink-soft">
        <template v-if="store.todayConsumedMl === 0">
          Ainda sem registros hoje — um gole já conta.
        </template>
        <template v-else-if="store.goalReached">
          Meta atingida — pode continuar registrando.
        </template>
        <template v-else>
          Faltam <span class="font-semibold text-ink">{{ formatVolume(store.remainingMl) }}</span>
        </template>
      </p>
    </section>

    <section
      v-if="!store.goalReached && store.suggestedSipMl > 0"
      class="mt-4 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line"
    >
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Próximo gole
          </p>
          <p class="font-display text-xl font-bold text-ink tabular-nums">
            {{ formatVolume(store.suggestedSipMl) }}
          </p>
          <p class="text-xs text-ink-soft">
            Até {{ String(store.profile.bedtimeHour).padStart(2, '0') }}:{{
              String(store.profile.bedtimeMinute).padStart(2, '0')
            }}
          </p>
        </div>
        <button
          type="button"
          class="h-11 rounded-xl bg-teal px-4 text-sm font-semibold text-surface-raised"
          @click="onSuggested"
        >
          Registrar
        </button>
      </div>
    </section>

    <section class="mt-6">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Atalhos
        </h2>
        <button
          type="button"
          class="text-sm font-semibold text-teal"
          @click="sheetOpen = true"
        >
          Outro valor
        </button>
      </div>
      <CupShortcutBar :cups="store.cups" @select="onCup" />
    </section>

    <div class="mt-6 flex-1">
      <EntryList
        :entries="store.todayEntries"
        @remove="onRemove"
        @edit="onEdit"
      />
    </div>

    <QuickAddSheet v-model:open="sheetOpen" @confirm="onManual" />
    <EditEntrySheet v-model:open="editOpen" :entry="editing" @save="onSaveEdit" />
    <GoalCelebration
      v-model:open="celebrateOpen"
      :nickname="store.profile.nickname"
      @done="onCelebrateDone"
    />
    <DaySummaryModal
      v-model:open="summaryOpen"
      :summary="yesterday"
      :streak="store.streak"
      @continue="closeSummary"
    />
    <UndoToast
      :message="toastMessage"
      action-label="Desfazer"
      @action="onUndo"
      @close="toastMessage = ''"
    />
  </main>
</template>
