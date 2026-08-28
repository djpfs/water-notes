<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AvatarPicker from '@/components/AvatarPicker.vue'
import ConfirmSheet from '@/components/ConfirmSheet.vue'
import CupSheet from '@/components/CupSheet.vue'
import {
  type AuthUser,
  clearAuthCache,
  deleteAccountRemote,
  fetchMe,
  logoutRemote,
  pullAndMerge,
  pushLocal,
  startGoogleLogin,
} from '@/composables/useCloudSync'
import {
  disableNotifications,
  enableNotifications,
  sendTestNotification,
  setNotificationInterval,
  updateNotificationSettings,
} from '@/composables/useNotifications'
import { canUseRemotePush, testRemotePush } from '@/composables/useRemotePush'
import { useToast } from '@/composables/useToast'
import { useAppStore } from '@/stores/app'
import {
  ACTIVITY_LEVELS,
  APP_LOCALES,
  HEAT_LEVELS,
  ML_PER_KG,
  NOTIFICATION_INTERVALS,
  WEEKDAY_KEYS,
  WEEKLY_GOAL_DAY_OPTIONS,
  type AppLocale,
  type ThemeMode,
  type WeekdayKey,
} from '@/types'
import { formatVolume } from '@/utils/date'
import { goBackOr } from '@/utils/navigation'
import { formatClock, parseClock } from '@/utils/timeWindow'
import { APP_VERSION } from '@/version'

const router = useRouter()
const store = useAppStore()
const { t } = useI18n()
const { show: showToast } = useToast()
const locale = ref<AppLocale>(store.locale)
const remotePushOk = ref(canUseRemotePush())

const search = ref('')
const cloudUser = ref<AuthUser | null>(null)
const cloudBusy = ref(false)
const cloudMsg = ref('')
const cloudError = ref('')

const nickname = ref(store.profile.nickname)
const weightKg = ref(String(store.profile.weightKg))
const avatarId = ref(store.profile.avatarId)
const useProfilePhoto = ref(store.profile.useProfilePhoto)
const useCustomGoal = ref(store.profile.goalOverrideMl != null)
const customGoal = ref(
  String(store.profile.goalOverrideMl ?? store.defaultGoalMl),
)
const activityLevel = ref(store.profile.activityLevel)
const heatLevel = ref(store.profile.heatLevel)
const climateAdjustment = ref(String(store.profile.climateAdjustmentMl ?? 0))
const useWeekdayGoal = ref(store.profile.weekdayGoalMl != null)
const weekdayGoal = ref(String(store.profile.weekdayGoalMl ?? store.dailyGoalMl))
const useWeekendGoal = ref(store.profile.weekendGoalMl != null)
const weekendGoal = ref(String(store.profile.weekendGoalMl ?? store.dailyGoalMl))
const weeklyGoalDays = ref(String(store.profile.weeklyGoalDays ?? 5))
const bedtime = ref(
  `${String(store.profile.bedtimeHour ?? 22).padStart(2, '0')}:${String(store.profile.bedtimeMinute ?? 0).padStart(2, '0')}`,
)
const notifError = ref('')
const notifBusy = ref(false)
const windowStart = ref(
  formatClock(
    store.notifications.windowStartHour ?? 8,
    store.notifications.windowStartMinute ?? 0,
  ),
)
const windowEnd = ref(
  formatClock(
    store.notifications.windowEndHour ?? 22,
    store.notifications.windowEndMinute ?? 0,
  ),
)
const pauseWhenGoalReached = ref(
  store.notifications.pauseWhenGoalReached !== false,
)
const useWeekdayWindows = ref(store.notifications.useWeekdayWindows === true)
const adaptiveEnabled = ref(store.notifications.adaptiveEnabled !== false)
const weekdayWindowStart = ref<Record<WeekdayKey, string>>({
  sun: formatClock(
    store.notifications.weeklyWindows.sun.startHour,
    store.notifications.weeklyWindows.sun.startMinute,
  ),
  mon: formatClock(
    store.notifications.weeklyWindows.mon.startHour,
    store.notifications.weeklyWindows.mon.startMinute,
  ),
  tue: formatClock(
    store.notifications.weeklyWindows.tue.startHour,
    store.notifications.weeklyWindows.tue.startMinute,
  ),
  wed: formatClock(
    store.notifications.weeklyWindows.wed.startHour,
    store.notifications.weeklyWindows.wed.startMinute,
  ),
  thu: formatClock(
    store.notifications.weeklyWindows.thu.startHour,
    store.notifications.weeklyWindows.thu.startMinute,
  ),
  fri: formatClock(
    store.notifications.weeklyWindows.fri.startHour,
    store.notifications.weeklyWindows.fri.startMinute,
  ),
  sat: formatClock(
    store.notifications.weeklyWindows.sat.startHour,
    store.notifications.weeklyWindows.sat.startMinute,
  ),
})
const weekdayWindowEnd = ref<Record<WeekdayKey, string>>({
  sun: formatClock(
    store.notifications.weeklyWindows.sun.endHour,
    store.notifications.weeklyWindows.sun.endMinute,
  ),
  mon: formatClock(
    store.notifications.weeklyWindows.mon.endHour,
    store.notifications.weeklyWindows.mon.endMinute,
  ),
  tue: formatClock(
    store.notifications.weeklyWindows.tue.endHour,
    store.notifications.weeklyWindows.tue.endMinute,
  ),
  wed: formatClock(
    store.notifications.weeklyWindows.wed.endHour,
    store.notifications.weeklyWindows.wed.endMinute,
  ),
  thu: formatClock(
    store.notifications.weeklyWindows.thu.endHour,
    store.notifications.weeklyWindows.thu.endMinute,
  ),
  fri: formatClock(
    store.notifications.weeklyWindows.fri.endHour,
    store.notifications.weeklyWindows.fri.endMinute,
  ),
  sat: formatClock(
    store.notifications.weeklyWindows.sat.endHour,
    store.notifications.weeklyWindows.sat.endMinute,
  ),
})
const importConfirmOpen = ref(false)
const pendingImport = ref<unknown>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const feedbackSound = ref(store.feedback.sound)
const feedbackHaptic = ref(store.feedback.haptic)

const cupSheetOpen = ref(false)
const cupSheetMode = ref<'add' | 'edit'>('add')
const editingCupId = ref<string | null>(null)
const editingCupLabel = ref('')
const editingCupMl = ref(0)
const deleteConfirmOpen = ref(false)
const accountDeleteOpen = ref(false)
const deletingCupId = ref<string | null>(null)

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

const weekdayGoalNumber = computed(() => {
  const n = Number(String(weekdayGoal.value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
})

const weekendGoalNumber = computed(() => {
  const n = Number(String(weekendGoal.value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
})

const climateAdjustmentNumber = computed(() => {
  const n = Number(String(climateAdjustment.value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
})

const weeklyGoalDaysNumber = computed(() => {
  const n = Number(String(weeklyGoalDays.value).replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n) : 5
})

const profileFieldsValid = computed(() => {
  if (nickname.value.trim().length < 2) return false
  return weightNumber.value >= 20 && weightNumber.value <= 300
})

const metaValid = computed(() => {
  const customGoalValid =
    !useCustomGoal.value ||
    (customGoalNumber.value >= 500 && customGoalNumber.value <= 10000)
  const weekdayGoalValid =
    !useWeekdayGoal.value ||
    (weekdayGoalNumber.value >= 500 && weekdayGoalNumber.value <= 12000)
  const weekendGoalValid =
    !useWeekendGoal.value ||
    (weekendGoalNumber.value >= 500 && weekendGoalNumber.value <= 12000)
  const climateValid =
    climateAdjustmentNumber.value >= -1200 && climateAdjustmentNumber.value <= 1200
  const weeklyGoalDaysValid =
    weeklyGoalDaysNumber.value >= 3 && weeklyGoalDaysNumber.value <= 7
  return (
    customGoalValid &&
    weekdayGoalValid &&
    weekendGoalValid &&
    climateValid &&
    weeklyGoalDaysValid
  )
})

const themes = computed(() => [
  { id: 'system' as ThemeMode, label: t('settings.themeSystem') },
  { id: 'light' as ThemeMode, label: t('settings.themeLight') },
  { id: 'dark' as ThemeMode, label: t('settings.themeDark') },
])

const activityOptions = ACTIVITY_LEVELS
const heatOptions = HEAT_LEVELS
const weeklyGoalDayOptions = WEEKLY_GOAL_DAY_OPTIONS

const weekdayOptions = computed(() =>
  WEEKDAY_KEYS.map((id) => ({
    id,
    label: t(`settings.weekday.${id}`),
  })),
)

const sections = computed(() => [
  { id: 'conta', title: t('settings.account'), keywords: 'conta login google sync account' },
  { id: 'perfil', title: t('settings.profile'), keywords: 'perfil profile nickname peso weight avatar' },
  { id: 'meta', title: t('settings.goal'), keywords: 'meta goal ml peso weight bedtime' },
  { id: 'lembretes', title: t('settings.reminders'), keywords: 'lembretes reminders push notificação notification vapid' },
  { id: 'aparencia', title: t('settings.appearance'), keywords: 'aparência appearance tema theme' },
  { id: 'feedback', title: t('settings.feedback'), keywords: 'feedback som sound haptic vibração' },
  { id: 'idioma', title: t('settings.language'), keywords: 'idioma language english português locale' },
  { id: 'copos', title: t('settings.cups'), keywords: 'copos cups atalhos shortcuts' },
  { id: 'dados', title: t('settings.data'), keywords: 'dados data backup export import' },
  { id: 'sobre', title: t('settings.about'), keywords: 'sobre about versão version' },
])

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return new Set(sections.value.map((s) => s.id))
  return new Set(
    sections.value
      .filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.keywords.includes(q),
      )
      .map((s) => s.id),
  )
})

function show(id: string) {
  return visible.value.has(id)
}

function intervalOptionLabel(minutes: number): string {
  const lang = locale.value
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    const unit =
      lang === 'en'
        ? `hour${hours === 1 ? '' : 's'}`
        : `hora${hours === 1 ? '' : 's'}`
    return t('settings.everyLabel', { value: `${hours} ${unit}` })
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) {
    return t('settings.everyLabel', { value: `${mins} min` })
  }
  const value = lang === 'en' ? `${hours}h ${mins}m` : `${hours}h ${mins}`
  return t('settings.everyLabel', { value })
}

function updateWeekdayWindowInputsFromStore() {
  for (const key of WEEKDAY_KEYS) {
    const window = store.notifications.weeklyWindows[key]
    weekdayWindowStart.value[key] = formatClock(window.startHour, window.startMinute)
    weekdayWindowEnd.value[key] = formatClock(window.endHour, window.endMinute)
  }
}

function buildWeeklyWindowsPayload() {
  const next = {} as Record<
    WeekdayKey,
    { startHour: number; startMinute: number; endHour: number; endMinute: number }
  >
  for (const key of WEEKDAY_KEYS) {
    const start = parseClock(weekdayWindowStart.value[key])
    const end = parseClock(weekdayWindowEnd.value[key])
    next[key] = {
      startHour: start.hour,
      startMinute: start.minute,
      endHour: end.hour,
      endMinute: end.minute,
    }
  }
  return next
}

function parseBedtime(): { bedtimeHour: number; bedtimeMinute: number } {
  const [h, m] = bedtime.value.split(':').map(Number)
  return {
    bedtimeHour: Number.isFinite(h) ? h : 22,
    bedtimeMinute: Number.isFinite(m) ? m : 0,
  }
}

function saveProfileFields() {
  if (!profileFieldsValid.value) return
  store.updateProfile({
    nickname: nickname.value,
    weightKg: weightNumber.value,
    avatarId: avatarId.value,
    useProfilePhoto: useProfilePhoto.value,
  })
  showToast(t('settings.profileSaved'))
}

function saveMeta() {
  if (!metaValid.value) return
  store.updateProfile({
    goalOverrideMl: useCustomGoal.value ? customGoalNumber.value : null,
    activityLevel: activityLevel.value,
    heatLevel: heatLevel.value,
    climateAdjustmentMl: climateAdjustmentNumber.value,
    weekdayGoalMl: useWeekdayGoal.value ? weekdayGoalNumber.value : null,
    weekendGoalMl: useWeekendGoal.value ? weekendGoalNumber.value : null,
    weeklyGoalDays: weeklyGoalDaysNumber.value,
    ...parseBedtime(),
  })
  showToast(t('settings.goalSaved'))
}

function saveFeedback() {
  store.setFeedback({
    sound: feedbackSound.value,
    haptic: feedbackHaptic.value,
  })
  showToast(t('settings.feedbackSaved'))
}

function saveLocale() {
  store.setLocale(locale.value)
  showToast(t('settings.languageSaved'))
}

async function onTestRemotePush() {
  if (!cloudUser.value) {
    notifError.value = t('settings.loginHint')
    return
  }
  notifError.value = ''
  notifBusy.value = true
  try {
    await testRemotePush()
    showToast(t('settings.testSent'))
  } catch (err) {
    notifError.value = err instanceof Error ? err.message : t('notifications.pushSubscribeFailed')
  } finally {
    notifBusy.value = false
  }
}

function openAddCup() {
  cupSheetMode.value = 'add'
  editingCupId.value = null
  cupSheetOpen.value = true
}

function openEditCup(id: string, label: string, ml: number) {
  editingCupLabel.value = label
  editingCupMl.value = ml
  cupSheetMode.value = 'edit'
  editingCupId.value = id
  cupSheetOpen.value = true
}

function onCupSave(label: string, ml: number) {
  if (cupSheetMode.value === 'edit' && editingCupId.value) {
    store.updateCup(editingCupId.value, label, ml)
    return
  }
  store.addCup(label, ml)
}

function askDeleteCup(id: string) {
  deletingCupId.value = id
  deleteConfirmOpen.value = true
}

function confirmDeleteCup() {
  if (deletingCupId.value) {
    store.removeCup(deletingCupId.value)
  }
  deletingCupId.value = null
}

const deletingCupLabel = computed(() => {
  const cup = store.cups.find((c) => c.id === deletingCupId.value)
  return cup?.label ?? t('settings.deleteCupFallbackLabel')
})

async function toggleNotifications() {
  notifError.value = ''
  notifBusy.value = true
  try {
    if (store.notifications.enabled) {
      await disableNotifications()
    } else {
      await enableNotifications()
    }
  } catch (err) {
    notifError.value = err instanceof Error ? err.message : t('settings.enableFailed')
  } finally {
    notifBusy.value = false
  }
}

async function onIntervalChange(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  await setNotificationInterval(value)
}

async function onLogout() {
  cloudBusy.value = true
  cloudError.value = ''
  try {
    await logoutRemote()
    clearAuthCache()
    cloudUser.value = null
    await router.replace({ name: 'home' })
  } catch (err) {
    cloudError.value = err instanceof Error ? err.message : t('settings.logoutError')
  } finally {
    cloudBusy.value = false
  }
}

async function confirmDeleteAccount() {
  cloudBusy.value = true
  cloudError.value = ''
  cloudMsg.value = ''
  try {
    await deleteAccountRemote()
    store.resetAll()
    cloudUser.value = null
    await router.replace({ name: 'onboarding' })
  } catch (err) {
    cloudError.value =
      err instanceof Error ? err.message : t('settings.deleteAccountError')
  } finally {
    cloudBusy.value = false
  }
}

async function onSyncNow() {
  cloudBusy.value = true
  cloudError.value = ''
  cloudMsg.value = ''
  try {
    const result = await pullAndMerge()
    cloudMsg.value =
      result === 'pulled'
        ? t('settings.syncPulled')
        : result === 'empty'
          ? t('settings.syncEmpty')
          : t('settings.syncMerged')
  } catch (err) {
    cloudError.value = err instanceof Error ? err.message : t('settings.syncError')
  } finally {
    cloudBusy.value = false
  }
}

async function onPushOnly() {
  cloudBusy.value = true
  cloudError.value = ''
  try {
    await pushLocal()
    cloudMsg.value = t('settings.backupUploaded')
  } catch (err) {
    cloudError.value = err instanceof Error ? err.message : t('settings.uploadError')
  } finally {
    cloudBusy.value = false
  }
}

onMounted(async () => {
  cloudUser.value = await fetchMe(true)
  updateWeekdayWindowInputsFromStore()
})

async function saveReminderWindow() {
  const start = parseClock(windowStart.value)
  const end = parseClock(windowEnd.value)
  await updateNotificationSettings({
    windowStartHour: start.hour,
    windowStartMinute: start.minute,
    windowEndHour: end.hour,
    windowEndMinute: end.minute,
    useWeekdayWindows: useWeekdayWindows.value,
    weeklyWindows: buildWeeklyWindowsPayload(),
    adaptiveEnabled: adaptiveEnabled.value,
    pauseWhenGoalReached: pauseWhenGoalReached.value,
  })
  updateWeekdayWindowInputsFromStore()
  showToast(t('settings.remindersSaved'))
}

async function onTestNotification() {
  notifError.value = ''
  notifBusy.value = true
  try {
    await sendTestNotification()
    showToast(t('settings.testSent'))
  } catch (err) {
    notifError.value =
      err instanceof Error ? err.message : t('settings.reminderTestFailed')
  } finally {
    notifBusy.value = false
  }
}

function exportBackup() {
  const data = store.exportBackup()
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `water-notes-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  showToast(t('settings.backupExported'))
}

function applyImport(data: unknown) {
  store.importBackup(data)
  nickname.value = store.profile.nickname
  weightKg.value = String(store.profile.weightKg)
  avatarId.value = store.profile.avatarId
  useProfilePhoto.value = store.profile.useProfilePhoto
  useCustomGoal.value = store.profile.goalOverrideMl != null
  customGoal.value = String(
    store.profile.goalOverrideMl ?? store.defaultGoalMl,
  )
  activityLevel.value = store.profile.activityLevel
  heatLevel.value = store.profile.heatLevel
  climateAdjustment.value = String(store.profile.climateAdjustmentMl ?? 0)
  useWeekdayGoal.value = store.profile.weekdayGoalMl != null
  weekdayGoal.value = String(store.profile.weekdayGoalMl ?? store.dailyGoalMl)
  useWeekendGoal.value = store.profile.weekendGoalMl != null
  weekendGoal.value = String(store.profile.weekendGoalMl ?? store.dailyGoalMl)
  weeklyGoalDays.value = String(store.profile.weeklyGoalDays ?? 5)
  bedtime.value = `${String(store.profile.bedtimeHour).padStart(2, '0')}:${String(store.profile.bedtimeMinute).padStart(2, '0')}`
  windowStart.value = formatClock(
    store.notifications.windowStartHour,
    store.notifications.windowStartMinute,
  )
  windowEnd.value = formatClock(
    store.notifications.windowEndHour,
    store.notifications.windowEndMinute,
  )
  useWeekdayWindows.value = store.notifications.useWeekdayWindows === true
  adaptiveEnabled.value = store.notifications.adaptiveEnabled !== false
  pauseWhenGoalReached.value = store.notifications.pauseWhenGoalReached !== false
  updateWeekdayWindowInputsFromStore()
  feedbackSound.value = store.feedback.sound
  feedbackHaptic.value = store.feedback.haptic
  locale.value = store.locale
  showToast(t('settings.backupImported'))
}

function confirmImport() {
  if (pendingImport.value) applyImport(pendingImport.value)
  pendingImport.value = null
}

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    pendingImport.value = JSON.parse(text)
    importConfirmOpen.value = true
  } catch (err) {
    showToast(
      err instanceof Error ? err.message : t('settings.importFailed'),
    )
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <main class="safe-pb flex min-h-dvh flex-col px-5 pb-10">
    <div class="app-bar">
      <header class="flex items-center gap-3">
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-xl bg-mist-deep text-ink"
          :aria-label="t('common.back')"
          @click="goBackOr(router, { name: 'home' })"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <h1 class="font-display text-2xl font-bold text-ink">{{ t('settings.title') }}</h1>
      </header>

      <div class="relative mt-4">
        <svg
          class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
          <path d="M20 20l-3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          v-model="search"
          type="search"
          :placeholder="t('settings.searchPlaceholder')"
          class="h-11 w-full rounded-xl bg-mist-deep pl-10 pr-4 text-sm text-ink outline-none placeholder:text-ink-soft focus:ring-2 focus:ring-teal"
        />
      </div>
    </div>

    <p
      v-if="search.trim() && visible.size === 0"
      class="mt-8 text-center text-sm text-ink-soft"
    >
      {{ t('common.nothingFound') }}
    </p>

    <section v-if="show('conta')" class="mt-6">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        {{ t('settings.account') }}
      </h2>
      <div class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <div v-if="cloudUser" class="divide-y divide-line">
          <div class="flex items-center gap-3 px-4 py-3">
            <img
              v-if="cloudUser.picture || store.profile.photoUrl"
              :src="cloudUser.picture || store.profile.photoUrl || ''"
              alt=""
              class="h-11 w-11 rounded-full object-cover"
              referrerpolicy="no-referrer"
            />
            <div class="min-w-0">
              <p class="truncate font-semibold text-ink">
                {{ cloudUser.name || store.profile.nickname || t('settings.accountFallbackName') }}
              </p>
              <p class="truncate text-xs text-ink-soft">{{ cloudUser.email }}</p>
            </div>
          </div>
          <button
            type="button"
            class="flex h-12 w-full items-center px-4 text-left text-sm font-medium text-ink disabled:opacity-50"
            :disabled="cloudBusy"
            @click="onSyncNow"
          >
            {{ t('settings.syncNow') }}
          </button>
          <button
            type="button"
            class="flex h-12 w-full items-center px-4 text-left text-sm font-medium text-ink disabled:opacity-50"
            :disabled="cloudBusy"
            @click="onPushOnly"
          >
            {{ t('settings.pushOnly') }}
          </button>
          <button
            type="button"
            class="flex h-12 w-full items-center px-4 text-left text-sm font-medium text-amber-deep disabled:opacity-50"
            :disabled="cloudBusy"
            @click="onLogout"
          >
            {{ t('settings.logout') }}
          </button>
          <button
            type="button"
            class="flex h-12 w-full items-center px-4 text-left text-sm font-medium text-amber-deep disabled:opacity-50"
            :disabled="cloudBusy"
            @click="accountDeleteOpen = true"
          >
            {{ t('settings.deleteAccount') }}
          </button>
        </div>
        <p v-else class="px-4 py-3 text-sm text-ink-soft">
          {{ t('settings.goToLoginForSync') }}
        </p>
        <button
          v-if="!cloudUser"
          type="button"
          class="flex h-12 w-full items-center border-t border-line px-4 text-left text-sm font-medium text-teal"
          @click="startGoogleLogin"
        >
          {{ t('login.continueGoogle') }}
        </button>
      </div>
      <p v-if="cloudError" class="mt-2 px-1 text-sm text-amber-deep">{{ cloudError }}</p>
      <p v-if="cloudMsg" class="mt-2 px-1 text-sm text-teal-deep">{{ cloudMsg }}</p>
    </section>

    <section v-if="show('perfil')" class="mt-7">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        {{ t('settings.profile') }}
      </h2>
      <div class="space-y-0 overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <label class="block border-b border-line px-4 py-3">
          <span class="mb-1.5 block text-xs text-ink-soft">{{ t('settings.nickname') }}</span>
          <input
            v-model="nickname"
            type="text"
            maxlength="24"
            class="w-full bg-transparent text-ink outline-none"
          />
        </label>
        <label class="block border-b border-line px-4 py-3">
          <span class="mb-1.5 block text-xs text-ink-soft">{{ t('settings.weight') }}</span>
          <input
            v-model="weightKg"
            type="number"
            inputmode="decimal"
            min="20"
            max="300"
            step="0.1"
            class="w-full bg-transparent text-ink outline-none"
          />
        </label>
        <div class="px-4 py-3">
          <p class="mb-2 text-xs text-ink-soft">{{ t('settings.avatar') }}</p>
          <AvatarPicker
            v-model="avatarId"
            v-model:use-photo="useProfilePhoto"
            :photo-url="store.profile.photoUrl || cloudUser?.picture"
          />
        </div>
      </div>
      <button
        type="button"
        class="mt-3 h-11 w-full rounded-2xl bg-teal text-sm font-semibold text-surface-raised disabled:opacity-40"
        :disabled="!profileFieldsValid"
        @click="saveProfileFields"
      >
        {{ t('settings.saveProfile') }}
      </button>
    </section>

    <section v-if="show('meta')" class="mt-7">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        {{ t('settings.goal') }}
      </h2>
      <div class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <p class="border-b border-line px-4 py-3 text-sm text-ink-soft">
          {{ t('settings.suggestedGoal', { amount: formatVolume(suggestedGoal) }) }}
        </p>
        <label class="flex items-center gap-3 border-b border-line px-4 py-3">
          <input
            v-model="useCustomGoal"
            type="checkbox"
            class="size-5 accent-[oklch(0.48_0.10_238)]"
          />
          <span class="text-sm font-medium text-ink">{{ t('settings.manualGoal') }}</span>
        </label>
        <label v-if="useCustomGoal" class="block border-b border-line px-4 py-3">
          <span class="mb-1.5 block text-xs text-ink-soft">{{ t('settings.goalMl') }}</span>
          <input
            v-model="customGoal"
            type="number"
            inputmode="numeric"
            min="500"
            max="10000"
            step="50"
            class="w-full bg-transparent font-display text-xl font-bold text-ink outline-none"
          />
        </label>
        <label class="block border-b border-line px-4 py-3">
          <span class="mb-1.5 block text-xs text-ink-soft">{{ t('settings.activityLevel') }}</span>
          <select v-model="activityLevel" class="w-full bg-transparent text-ink outline-none">
            <option
              v-for="item in activityOptions"
              :key="item.id"
              :value="item.id"
            >
              {{ t(item.labelKey) }}
            </option>
          </select>
        </label>
        <label class="block border-b border-line px-4 py-3">
          <span class="mb-1.5 block text-xs text-ink-soft">{{ t('settings.heatLevel') }}</span>
          <select v-model="heatLevel" class="w-full bg-transparent text-ink outline-none">
            <option
              v-for="item in heatOptions"
              :key="item.id"
              :value="item.id"
            >
              {{ t(item.labelKey) }}
            </option>
          </select>
        </label>
        <label class="block border-b border-line px-4 py-3">
          <span class="mb-1.5 block text-xs text-ink-soft">{{ t('settings.climateAdjustment') }}</span>
          <input
            v-model="climateAdjustment"
            type="number"
            inputmode="numeric"
            min="-1200"
            max="1200"
            step="50"
            class="w-full bg-transparent text-ink outline-none"
          />
          <p class="mt-1 text-xs text-ink-soft">{{ t('settings.climateAdjustmentHint') }}</p>
        </label>
        <label class="flex items-center gap-3 border-b border-line px-4 py-3">
          <input
            v-model="useWeekdayGoal"
            type="checkbox"
            class="size-5 accent-[oklch(0.48_0.10_238)]"
          />
          <span class="text-sm font-medium text-ink">{{ t('settings.weekdayGoalToggle') }}</span>
        </label>
        <label v-if="useWeekdayGoal" class="block border-b border-line px-4 py-3">
          <span class="mb-1.5 block text-xs text-ink-soft">{{ t('settings.weekdayGoalLabel') }}</span>
          <input
            v-model="weekdayGoal"
            type="number"
            inputmode="numeric"
            min="500"
            max="12000"
            step="50"
            class="w-full bg-transparent text-ink outline-none"
          />
        </label>
        <label class="flex items-center gap-3 border-b border-line px-4 py-3">
          <input
            v-model="useWeekendGoal"
            type="checkbox"
            class="size-5 accent-[oklch(0.48_0.10_238)]"
          />
          <span class="text-sm font-medium text-ink">{{ t('settings.weekendGoalToggle') }}</span>
        </label>
        <label v-if="useWeekendGoal" class="block border-b border-line px-4 py-3">
          <span class="mb-1.5 block text-xs text-ink-soft">{{ t('settings.weekendGoalLabel') }}</span>
          <input
            v-model="weekendGoal"
            type="number"
            inputmode="numeric"
            min="500"
            max="12000"
            step="50"
            class="w-full bg-transparent text-ink outline-none"
          />
        </label>
        <label class="block border-b border-line px-4 py-3">
          <span class="mb-1.5 block text-xs text-ink-soft">{{ t('settings.weeklyGoalDays') }}</span>
          <select v-model="weeklyGoalDays" class="w-full bg-transparent text-ink outline-none">
            <option
              v-for="dayCount in weeklyGoalDayOptions"
              :key="dayCount"
              :value="String(dayCount)"
            >
              {{ t('settings.weeklyGoalDaysOption', { days: dayCount }) }}
            </option>
          </select>
        </label>
        <label class="block px-4 py-3">
          <span class="mb-1.5 block text-xs text-ink-soft">{{ t('settings.bedtime') }}</span>
          <input
            v-model="bedtime"
            type="time"
            class="w-full bg-transparent text-ink outline-none"
          />
          <p class="mt-1 text-xs text-ink-soft">{{ t('settings.bedtimeHint') }}</p>
        </label>
      </div>
      <button
        type="button"
        class="mt-3 h-11 w-full rounded-2xl bg-teal text-sm font-semibold text-surface-raised disabled:opacity-40"
        :disabled="!metaValid"
        @click="saveMeta"
      >
        {{ t('settings.saveGoal') }}
      </button>
    </section>

    <section v-if="show('lembretes')" class="mt-7">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        {{ t('settings.reminders') }}
      </h2>
      <div class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <button
          type="button"
          class="flex h-12 w-full items-center justify-between px-4 text-sm font-medium text-ink disabled:opacity-50"
          :disabled="notifBusy"
          @click="toggleNotifications"
        >
          <span>{{ t('settings.remindersToggle') }}</span>
          <span
            class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            :class="
              store.notifications.enabled
                ? 'bg-teal/15 text-teal-deep'
                : 'bg-mist-deep text-ink-soft'
            "
          >
            {{ store.notifications.enabled ? t('common.on') : t('common.off') }}
          </span>
        </button>

        <template v-if="store.notifications.enabled">
          <label class="block border-t border-line px-4 py-3">
            <span class="mb-1.5 block text-xs text-ink-soft">{{ t('settings.interval') }}</span>
            <select
              class="w-full bg-transparent text-ink outline-none"
              :value="store.notifications.intervalMinutes"
              @change="onIntervalChange"
            >
              <option
                v-for="item in NOTIFICATION_INTERVALS"
                :key="item.minutes"
                :value="item.minutes"
              >
                {{ intervalOptionLabel(item.minutes) }}
              </option>
            </select>
          </label>
          <div class="grid grid-cols-2 gap-0 border-t border-line">
            <label class="border-r border-line px-4 py-3">
              <span class="mb-1.5 block text-xs text-ink-soft">{{ t('settings.from') }}</span>
              <input
                v-model="windowStart"
                type="time"
                class="w-full bg-transparent text-ink outline-none"
              />
            </label>
            <label class="px-4 py-3">
              <span class="mb-1.5 block text-xs text-ink-soft">{{ t('settings.to') }}</span>
              <input
                v-model="windowEnd"
                type="time"
                class="w-full bg-transparent text-ink outline-none"
              />
            </label>
          </div>
          <label class="flex items-center gap-3 border-t border-line px-4 py-3">
            <input
              v-model="useWeekdayWindows"
              type="checkbox"
              class="size-5 accent-[oklch(0.48_0.10_238)]"
            />
            <span class="text-sm font-medium text-ink">{{ t('settings.weekdayWindowsToggle') }}</span>
          </label>
          <div
            v-if="useWeekdayWindows"
            class="divide-y divide-line border-t border-line"
          >
            <div
              v-for="item in weekdayOptions"
              :key="item.id"
              class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 px-4 py-3"
            >
              <p class="text-sm font-medium text-ink">{{ item.label }}</p>
              <input
                v-model="weekdayWindowStart[item.id]"
                type="time"
                class="w-full rounded-lg bg-mist-deep px-2 py-1.5 text-sm text-ink outline-none"
              />
              <input
                v-model="weekdayWindowEnd[item.id]"
                type="time"
                class="w-full rounded-lg bg-mist-deep px-2 py-1.5 text-sm text-ink outline-none"
              />
            </div>
          </div>
          <label class="flex items-center gap-3 border-t border-line px-4 py-3">
            <input
              v-model="adaptiveEnabled"
              type="checkbox"
              class="size-5 accent-[oklch(0.48_0.10_238)]"
            />
            <span class="text-sm font-medium text-ink">{{ t('settings.adaptiveReminders') }}</span>
          </label>
          <label class="flex items-center gap-3 border-t border-line px-4 py-3">
            <input
              v-model="pauseWhenGoalReached"
              type="checkbox"
              class="size-5 accent-[oklch(0.48_0.10_238)]"
            />
            <span class="text-sm font-medium text-ink">{{ t('settings.pauseWhenGoal') }}</span>
          </label>
          <button
            type="button"
            class="flex h-12 w-full items-center border-t border-line px-4 text-left text-sm font-medium text-ink"
            @click="saveReminderWindow"
          >
            {{ t('settings.saveReminders') }}
          </button>
        </template>
        <button
          type="button"
          class="flex h-12 w-full items-center border-t border-line px-4 text-left text-sm font-medium text-teal disabled:opacity-50"
          :disabled="notifBusy"
          @click="onTestNotification"
        >
          {{ t('settings.testNotification') }}
        </button>
        <button
          type="button"
          class="flex h-12 w-full items-center border-t border-line px-4 text-left text-sm font-medium text-teal disabled:opacity-50"
          :disabled="notifBusy || !remotePushOk"
          @click="onTestRemotePush"
        >
          {{ t('settings.pushRemoteTest') }}
        </button>
      </div>
      <p class="mt-2 px-1 text-xs text-ink-soft">
        {{ t('settings.pushRemoteHint') }}
      </p>
      <p class="mt-1 px-1 text-xs text-ink-soft">
        {{ t('settings.periodicHint') }}
      </p>
      <p v-if="notifError" class="mt-2 px-1 text-sm text-amber-deep">{{ notifError }}</p>
    </section>

    <section v-if="show('aparencia')" class="mt-7">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        {{ t('settings.appearance') }}
      </h2>
      <div class="flex overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <button
          v-for="item in themes"
          :key="item.id"
          type="button"
          class="h-11 flex-1 text-sm font-semibold transition"
          :class="
            store.theme === item.id
              ? 'bg-teal text-surface-raised'
              : 'text-ink-soft'
          "
          @click="store.setTheme(item.id)"
        >
          {{ item.label }}
        </button>
      </div>
    </section>

    <section v-if="show('feedback')" class="mt-7">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        {{ t('settings.feedback') }}
      </h2>
      <div class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <label class="flex items-center gap-3 border-b border-line px-4 py-3">
          <input
            v-model="feedbackSound"
            type="checkbox"
            class="size-5 accent-[oklch(0.48_0.10_238)]"
          />
          <span class="text-sm font-medium text-ink">{{ t('settings.soundOnRegister') }}</span>
        </label>
        <label class="flex items-center gap-3 px-4 py-3">
          <input
            v-model="feedbackHaptic"
            type="checkbox"
            class="size-5 accent-[oklch(0.48_0.10_238)]"
          />
          <span class="text-sm font-medium text-ink">{{ t('settings.hapticButtons') }}</span>
        </label>
      </div>
      <button
        type="button"
        class="mt-3 h-11 w-full rounded-2xl bg-teal text-sm font-semibold text-surface-raised"
        @click="saveFeedback"
      >
        {{ t('settings.saveFeedback') }}
      </button>
    </section>

    <section v-if="show('idioma')" class="mt-7">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        {{ t('settings.language') }}
      </h2>
      <div class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <label class="block px-4 py-3">
          <span class="mb-1.5 block text-xs text-ink-soft">{{ t('settings.languageLabel') }}</span>
          <select v-model="locale" class="w-full bg-transparent text-ink outline-none">
            <option v-for="item in APP_LOCALES" :key="item.id" :value="item.id">
              {{ t(item.labelKey) }}
            </option>
          </select>
        </label>
      </div>
      <button
        type="button"
        class="mt-3 h-11 w-full rounded-2xl bg-teal text-sm font-semibold text-surface-raised"
        @click="saveLocale"
      >
        {{ t('common.save') }}
      </button>
    </section>

    <section v-if="show('copos')" class="mt-7">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        {{ t('settings.cups') }}
      </h2>
      <div class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <div class="flex items-center justify-between border-b border-line px-4 py-3">
          <p class="text-sm font-semibold text-ink">{{ t('settings.shortcuts') }}</p>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-teal text-surface-raised"
            :aria-label="t('settings.addCup')"
            @click="openAddCup"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
        <ul>
          <li
            v-for="cup in store.cups"
            :key="cup.id"
            class="flex items-center justify-between gap-2 border-b border-line px-4 py-3 last:border-b-0"
          >
            <div>
              <p class="font-semibold text-ink">{{ cup.label }}</p>
              <p class="text-xs text-ink-soft">{{ formatVolume(cup.ml) }}</p>
            </div>
            <div class="flex gap-1">
              <button
                type="button"
                class="h-10 rounded-xl px-3 text-sm font-medium text-teal"
                @click="openEditCup(cup.id, cup.label, cup.ml)"
              >
                {{ t('common.edit') }}
              </button>
              <button
                type="button"
                class="h-10 rounded-xl px-3 text-sm font-medium text-ink-soft disabled:opacity-30"
                :disabled="store.cups.length <= 1"
                @click="askDeleteCup(cup.id)"
              >
                {{ t('common.delete') }}
              </button>
            </div>
          </li>
        </ul>
      </div>

      <CupSheet
        v-model:open="cupSheetOpen"
        :mode="cupSheetMode"
        :initial-label="editingCupLabel"
        :initial-ml="editingCupMl"
        @save="onCupSave"
      />
      <ConfirmSheet
        v-model:open="deleteConfirmOpen"
        :title="t('settings.deleteCupTitle')"
        :message="t('settings.deleteCupMessage', { label: deletingCupLabel })"
        :confirm-label="t('common.delete')"
        @confirm="confirmDeleteCup"
      />
    </section>

    <section v-if="show('dados')" class="mt-7">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        {{ t('settings.data') }}
      </h2>
      <div class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <button
          type="button"
          class="flex h-12 w-full items-center border-b border-line px-4 text-left text-sm font-medium text-ink"
          @click="exportBackup"
        >
          {{ t('settings.exportBackup') }}
        </button>
        <button
          type="button"
          class="flex h-12 w-full items-center px-4 text-left text-sm font-medium text-ink"
          @click="fileInput?.click()"
        >
          {{ t('settings.importBackup') }}
        </button>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="hidden"
        @change="onImportFile"
      />
    </section>

    <section v-if="show('sobre')" class="mt-7">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        {{ t('settings.about') }}
      </h2>
      <div class="rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
        <p class="text-sm text-ink">Water Notes</p>
        <p class="text-xs text-ink-soft">{{ t('settings.version', { version: APP_VERSION }) }}</p>
      </div>
    </section>
  </main>

  <ConfirmSheet
    v-model:open="accountDeleteOpen"
    :title="t('settings.deleteAccountTitle')"
    :message="t('settings.deleteAccountMessage')"
    :confirm-label="t('settings.deleteAccountConfirm')"
    @confirm="confirmDeleteAccount"
  />
  <ConfirmSheet
    v-model:open="importConfirmOpen"
    :title="t('settings.importTitle')"
    :message="t('settings.importMessage')"
    :confirm-label="t('settings.importConfirm')"
    @confirm="confirmImport"
  />
</template>
