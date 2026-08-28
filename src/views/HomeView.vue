<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import ProfileAvatar from '@/components/ProfileAvatar.vue'
import ConfirmSheet from '@/components/ConfirmSheet.vue'
import CupShortcutBar from '@/components/CupShortcutBar.vue'
import DaySummaryModal from '@/components/DaySummaryModal.vue'
import EditEntrySheet from '@/components/EditEntrySheet.vue'
import EntryList from '@/components/EntryList.vue'
import GoalCelebration from '@/components/GoalCelebration.vue'
import QuickAddSheet from '@/components/QuickAddSheet.vue'
import UserProfileModal from '@/components/UserProfileModal.vue'
import { useToast } from '@/composables/useToast'
import WaterVessel from '@/components/WaterVessel.vue'
import { fetchMe, pullAndMerge } from '@/composables/useCloudSync'
import { usePwaUpdate } from '@/composables/usePwaUpdate'
import { usePullToRefresh } from '@/composables/usePullToRefresh'
import { useAppStore } from '@/stores/app'
import type { Cup, DayStat, WaterEntry } from '@/types'
import { formatVolume } from '@/utils/date'
import { hapticSuccess, soundGoal, soundSip } from '@/utils/feedback'
import { canShare, shareDailyProgress } from '@/utils/share'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const { t } = useI18n()

const sheetOpen = ref(false)
const celebrateOpen = ref(false)
const editOpen = ref(false)
const editing = ref<WaterEntry | null>(null)
const undoEntry = ref<WaterEntry | null>(null)
const summaryOpen = ref(false)
const profileOpen = ref(false)
const missedSummaries = ref<DayStat[]>([])
const deleteConfirmOpen = ref(false)
const pendingDeleteId = ref<string | null>(null)
const { show: showToast } = useToast()
const shareSupported = canShare()
const { checkForUpdate, needRefresh } = usePwaUpdate()
const themeLabel = computed(() => {
  if (store.theme === 'dark') return t('home.themeDark')
  if (store.theme === 'light') return t('home.themeLight')
  return t('home.themeSystem')
})
let dayCheckTimer: ReturnType<typeof setInterval> | undefined

const mainRef = ref<HTMLElement | null>(null)
const { pullDistance, refreshing, threshold, bind } = usePullToRefresh(
  async () => {
    const [hasUpdate, syncResult] = await Promise.all([
      checkForUpdate().catch(() => false),
      (async () => {
        const user = await fetchMe()
        if (!user) return 'skipped' as const
        try {
          return await pullAndMerge()
        } catch {
          return 'error' as const
        }
      })(),
    ])

    const appNeedsUpdate = hasUpdate || needRefresh.value
    const parts: string[] = []

    if (appNeedsUpdate) parts.push(t('toast.appUpdate'))
    if (syncResult === 'pulled') parts.push(t('toast.dataRestored'))
    else if (syncResult === 'merged') parts.push(t('toast.dataSynced'))
    else if (syncResult === 'empty') parts.push(t('toast.dataUploaded'))
    else if (syncResult === 'error') parts.push(t('toast.syncFailed'))
    else if (syncResult === 'skipped') parts.push(t('toast.loginRequiredSync'))

    showToast(parts.length ? parts.join(' · ') : t('toast.allUpdated'))
  },
)

const pullHint = computed(() => {
  if (refreshing.value) return t('home.pullUpdating')
  if (pullDistance.value >= threshold) return t('home.pullRelease')
  return t('home.pullRefresh')
})

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
  pendingDeleteId.value = id
  deleteConfirmOpen.value = true
}

function confirmRemove() {
  if (!pendingDeleteId.value) return
  const removed = store.removeEntry(pendingDeleteId.value)
  pendingDeleteId.value = null
  if (!removed) return
  undoEntry.value = removed
  showToast(t('toast.entryRemoved'), {
    action: {
      label: t('toast.undo'),
      onClick: () => {
        if (undoEntry.value) {
          store.restoreEntry(undoEntry.value)
          undoEntry.value = null
        }
      },
    },
  })
}

function onEdit(entry: WaterEntry) {
  editing.value = entry
  editOpen.value = true
}

function onSaveEdit(ml: number) {
  if (!editing.value) return
  store.updateEntry(editing.value.id, ml)
}

function onCelebrateDone() {
  celebrateOpen.value = false
}

function checkDayRollover() {
  const summaries = store.peekMissedSummaries()
  if (summaries.length) {
    missedSummaries.value = summaries
    summaryOpen.value = true
  } else {
    store.touchActiveDate()
  }
}

function closeSummary() {
  summaryOpen.value = false
  store.acknowledgeDayRollover()
}

async function onShare() {
  try {
    const mode = await shareDailyProgress()
    showToast(
      mode === 'shared'
        ? t('toast.shared')
        : mode === 'downloaded'
          ? t('toast.downloaded')
          : t('toast.copied'),
    )
  } catch {
    /* usuário cancelou */
  }
}

function consumeAddQuery() {
  const raw = route.query.add
  const value = Array.isArray(raw) ? raw[0] : raw
  const ml = Number(value)
  if (!Number.isFinite(ml) || ml <= 0) return
  register(ml)
  void router.replace({ name: 'home' })
}

onMounted(() => {
  bind(mainRef.value)
  checkDayRollover()
  consumeAddQuery()
  dayCheckTimer = setInterval(checkDayRollover, 60_000)
  document.addEventListener('visibilitychange', onVisibility)
})

watch(
  () => route.query.add,
  () => consumeAddQuery(),
)

onUnmounted(() => {
  if (dayCheckTimer) clearInterval(dayCheckTimer)
  document.removeEventListener('visibilitychange', onVisibility)
})

function onVisibility() {
  if (document.visibilityState === 'visible') checkDayRollover()
}
</script>

<template>
  <main ref="mainRef" class="safe-pb flex min-h-dvh overscroll-y-contain flex-col px-5 pb-6">
    <header class="app-bar flex items-center justify-between gap-2">
      <button
        type="button"
        class="flex min-w-0 items-center gap-3 rounded-xl text-left active:opacity-80"
        :aria-label="t('home.profile')"
        @click="profileOpen = true"
      >
        <ProfileAvatar
          :avatar-id="store.profile.avatarId"
          :use-profile-photo="store.profile.useProfilePhoto"
          :photo-url="store.profile.photoUrl"
          :size="44"
        />
        <div class="min-w-0">
          <p class="text-xs font-medium text-ink-soft">{{ t('home.greeting') }}</p>
          <p class="truncate font-display text-lg font-bold leading-tight text-ink">
            {{ store.profile.nickname }}
          </p>
        </div>
      </button>
      <div class="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft"
          :aria-label="themeLabel"
          @click="store.cycleTheme()"
        >
          <svg
            v-if="store.theme === 'dark'"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M21 14.3A9 9 0 1110.7 3 7 7 0 0021 14.3z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linejoin="round"
            />
          </svg>
          <svg
            v-else-if="store.theme === 'light'"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2" />
            <path
              d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <svg
            v-else
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="4"
              width="20"
              height="14"
              rx="2"
              stroke="currentColor"
              stroke-width="2"
            />
            <path d="M8 20h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
        <button
          v-if="shareSupported"
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft"
          :aria-label="t('nav.share')"
          @click="onShare"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft"
          :aria-label="t('home.history')"
          @click="router.push({ name: 'history' })"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 12a9 9 0 109-9M3 5v4h4"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M12 7v5l3 2"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft"
          :aria-label="t('home.settings')"
          @click="router.push({ name: 'settings' })"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9c.2.6.7 1 1.4 1.1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </header>

    <div
      class="flex select-none items-center justify-center overflow-hidden text-sm text-ink-soft transition-[height] duration-200"
      :style="{ height: pullDistance > 0 || refreshing ? `${Math.max(pullDistance, refreshing ? threshold : 0)}px` : '0px' }"
      aria-live="polite"
    >
      <div
        v-if="pullDistance > 0 || refreshing"
        class="flex items-center gap-2"
      >
        <svg
          class="size-4 shrink-0 text-teal"
          :class="refreshing ? 'animate-spin' : ''"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 4a8 8 0 018 8"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <span>{{ pullHint }}</span>
      </div>
    </div>

    <div
      v-if="store.streak > 0"
      class="mt-3 rounded-2xl bg-teal/10 px-4 py-2 text-center text-sm font-semibold text-teal-deep"
    >
      {{ t('home.streakLabel') }}
      {{ store.streak }}
      {{ store.streak === 1 ? t('home.streakDay') : t('home.streakDays') }}
    </div>

    <section class="mt-4">
      <WaterVessel
        :progress="store.progress"
        :consumed-ml="store.todayConsumedMl"
        :goal-ml="store.dailyGoalMl"
      />
      <p class="mt-3 text-center text-sm text-ink-soft">
        <template v-if="store.todayConsumedMl === 0">
          {{ t('home.noEntries') }}
        </template>
        <template v-else-if="store.goalReached">
          {{ t('home.goalReached') }}
        </template>
        <template v-else>
          {{ t('home.remaining', { amount: formatVolume(store.remainingMl) }) }}
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
            {{ t('home.nextSip') }}
          </p>
          <p class="font-display text-xl font-bold text-ink tabular-nums">
            {{ formatVolume(store.suggestedSipMl) }}
          </p>
          <p class="text-xs text-ink-soft">
            {{
              t('home.until', {
                time: `${String(store.profile.bedtimeHour).padStart(2, '0')}:${String(store.profile.bedtimeMinute).padStart(2, '0')}`,
              })
            }}
          </p>
        </div>
        <button
          type="button"
          class="h-11 rounded-xl bg-teal px-4 text-sm font-semibold text-surface-raised"
          @click="onSuggested"
        >
          {{ t('home.register') }}
        </button>
      </div>
    </section>

    <section class="mt-6">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-soft">
          {{ t('home.shortcuts') }}
        </h2>
        <button
          type="button"
          class="text-sm font-semibold text-teal"
          @click="sheetOpen = true"
        >
          {{ t('home.otherAmount') }}
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
      :summaries="missedSummaries"
      :streak="store.streak"
      @continue="closeSummary"
    />
    <UserProfileModal
      v-model:open="profileOpen"
      @settings="router.push({ name: 'settings' })"
    />
    <ConfirmSheet
      v-model:open="deleteConfirmOpen"
      :title="t('home.deleteEntryTitle')"
      :message="t('home.deleteEntryMessage')"
      :confirm-label="t('home.deleteEntryConfirm')"
      @confirm="confirmRemove"
    />
  </main>
</template>
