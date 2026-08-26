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
import { ML_PER_KG, NOTIFICATION_INTERVALS, APP_LOCALES, type AppLocale, type ThemeMode } from '@/types'
import { formatVolume } from '@/utils/date'
import { detectHealthPlatform, exportHealthData } from '@/utils/healthExport'
import { goBackOr } from '@/utils/navigation'
import { formatClock, parseClock } from '@/utils/timeWindow'
import { APP_VERSION } from '@/version'

const router = useRouter()
const store = useAppStore()
const { t } = useI18n()
const { show: showToast } = useToast()
const healthPlatform = detectHealthPlatform()
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

const profileFieldsValid = computed(() => {
  if (nickname.value.trim().length < 2) return false
  return weightNumber.value >= 20 && weightNumber.value <= 300
})

const metaValid = computed(() => {
  if (!useCustomGoal.value) return true
  return customGoalNumber.value >= 500 && customGoalNumber.value <= 10000
})

const themes = computed(() => [
  { id: 'system' as ThemeMode, label: t('settings.themeSystem') },
  { id: 'light' as ThemeMode, label: t('settings.themeLight') },
  { id: 'dark' as ThemeMode, label: t('settings.themeDark') },
])

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
  { id: 'saude', title: t('settings.health'), keywords: 'saúde health apple health connect csv json' },
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

function exportHealth(format: 'csv' | 'json') {
  exportHealthData(store.entries, format)
  showToast(t('settings.healthExported'))
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
  return cup?.label ?? 'este copo'
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
    notifError.value = err instanceof Error ? err.message : 'Não foi possível ativar.'
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
    await router.replace({ name: 'login' })
  } catch (err) {
    cloudError.value = err instanceof Error ? err.message : 'Falha ao sair.'
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
    await router.replace({ name: 'login' })
  } catch (err) {
    cloudError.value =
      err instanceof Error ? err.message : 'Não foi possível excluir a conta.'
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
        ? 'Dados restaurados.'
        : result === 'empty'
          ? 'Nada na nuvem — enviamos seus dados.'
          : 'Tudo sincronizado.'
  } catch (err) {
    cloudError.value = err instanceof Error ? err.message : 'Não foi possível sincronizar.'
  } finally {
    cloudBusy.value = false
  }
}

async function onPushOnly() {
  cloudBusy.value = true
  cloudError.value = ''
  try {
    await pushLocal()
    cloudMsg.value = 'Backup enviado.'
  } catch (err) {
    cloudError.value = err instanceof Error ? err.message : 'Falha ao enviar.'
  } finally {
    cloudBusy.value = false
  }
}

onMounted(async () => {
  cloudUser.value = await fetchMe(true)
})

async function saveReminderWindow() {
  const start = parseClock(windowStart.value)
  const end = parseClock(windowEnd.value)
  await updateNotificationSettings({
    windowStartHour: start.hour,
    windowStartMinute: start.minute,
    windowEndHour: end.hour,
    windowEndMinute: end.minute,
    pauseWhenGoalReached: pauseWhenGoalReached.value,
  })
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
      err instanceof Error ? err.message : 'Falha ao testar notificação.'
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
  bedtime.value = `${String(store.profile.bedtimeHour).padStart(2, '0')}:${String(store.profile.bedtimeMinute).padStart(2, '0')}`
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
      err instanceof Error ? err.message : 'Falha ao importar backup.',
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
          aria-label="Voltar"
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
        <h1 class="font-display text-2xl font-bold text-ink">Ajustes</h1>
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
          placeholder="Buscar"
          class="h-11 w-full rounded-xl bg-mist-deep pl-10 pr-4 text-sm text-ink outline-none placeholder:text-ink-soft focus:ring-2 focus:ring-teal"
        />
      </div>
    </div>

    <p
      v-if="search.trim() && visible.size === 0"
      class="mt-8 text-center text-sm text-ink-soft"
    >
      Nada encontrado.
    </p>

    <section v-if="show('conta')" class="mt-6">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        Conta
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
                {{ cloudUser.name || store.profile.nickname || 'Conta' }}
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
            Sincronizar agora
          </button>
          <button
            type="button"
            class="flex h-12 w-full items-center px-4 text-left text-sm font-medium text-ink disabled:opacity-50"
            :disabled="cloudBusy"
            @click="onPushOnly"
          >
            Enviar só deste aparelho
          </button>
          <button
            type="button"
            class="flex h-12 w-full items-center px-4 text-left text-sm font-medium text-amber-deep disabled:opacity-50"
            :disabled="cloudBusy"
            @click="onLogout"
          >
            Sair
          </button>
          <button
            type="button"
            class="flex h-12 w-full items-center px-4 text-left text-sm font-medium text-amber-deep disabled:opacity-50"
            :disabled="cloudBusy"
            @click="accountDeleteOpen = true"
          >
            Excluir conta
          </button>
        </div>
        <p v-else class="px-4 py-3 text-sm text-ink-soft">
          Entre na tela inicial para sincronizar entre aparelhos.
        </p>
      </div>
      <p v-if="cloudError" class="mt-2 px-1 text-sm text-amber-deep">{{ cloudError }}</p>
      <p v-if="cloudMsg" class="mt-2 px-1 text-sm text-teal-deep">{{ cloudMsg }}</p>
    </section>

    <section v-if="show('perfil')" class="mt-7">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        Perfil
      </h2>
      <div class="space-y-0 overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <label class="block border-b border-line px-4 py-3">
          <span class="mb-1.5 block text-xs text-ink-soft">Apelido</span>
          <input
            v-model="nickname"
            type="text"
            maxlength="24"
            class="w-full bg-transparent text-ink outline-none"
          />
        </label>
        <label class="block border-b border-line px-4 py-3">
          <span class="mb-1.5 block text-xs text-ink-soft">Peso (kg)</span>
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
          <p class="mb-2 text-xs text-ink-soft">Avatar</p>
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
        Salvar perfil
      </button>
    </section>

    <section v-if="show('meta')" class="mt-7">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        Meta
      </h2>
      <div class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <p class="border-b border-line px-4 py-3 text-sm text-ink-soft">
          Sugestão: {{ formatVolume(suggestedGoal) }}
        </p>
        <label class="flex items-center gap-3 border-b border-line px-4 py-3">
          <input
            v-model="useCustomGoal"
            type="checkbox"
            class="size-5 accent-[oklch(0.48_0.10_238)]"
          />
          <span class="text-sm font-medium text-ink">Meta manual</span>
        </label>
        <label v-if="useCustomGoal" class="block border-b border-line px-4 py-3">
          <span class="mb-1.5 block text-xs text-ink-soft">Meta (ml)</span>
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
        <label class="block px-4 py-3">
          <span class="mb-1.5 block text-xs text-ink-soft">Horário de dormir</span>
          <input
            v-model="bedtime"
            type="time"
            class="w-full bg-transparent text-ink outline-none"
          />
          <p class="mt-1 text-xs text-ink-soft">Para sugerir o próximo gole.</p>
        </label>
      </div>
      <button
        type="button"
        class="mt-3 h-11 w-full rounded-2xl bg-teal text-sm font-semibold text-surface-raised disabled:opacity-40"
        :disabled="!metaValid"
        @click="saveMeta"
      >
        Salvar meta
      </button>
    </section>

    <section v-if="show('lembretes')" class="mt-7">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        Lembretes
      </h2>
      <div class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <button
          type="button"
          class="flex h-12 w-full items-center justify-between px-4 text-sm font-medium text-ink disabled:opacity-50"
          :disabled="notifBusy"
          @click="toggleNotifications"
        >
          <span>Ativar lembretes</span>
          <span
            class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            :class="
              store.notifications.enabled
                ? 'bg-teal/15 text-teal-deep'
                : 'bg-mist-deep text-ink-soft'
            "
          >
            {{ store.notifications.enabled ? 'On' : 'Off' }}
          </span>
        </button>

        <template v-if="store.notifications.enabled">
          <label class="block border-t border-line px-4 py-3">
            <span class="mb-1.5 block text-xs text-ink-soft">Intervalo</span>
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
                A cada {{ item.label }}
              </option>
            </select>
          </label>
          <div class="grid grid-cols-2 gap-0 border-t border-line">
            <label class="border-r border-line px-4 py-3">
              <span class="mb-1.5 block text-xs text-ink-soft">Das</span>
              <input
                v-model="windowStart"
                type="time"
                class="w-full bg-transparent text-ink outline-none"
              />
            </label>
            <label class="px-4 py-3">
              <span class="mb-1.5 block text-xs text-ink-soft">Até</span>
              <input
                v-model="windowEnd"
                type="time"
                class="w-full bg-transparent text-ink outline-none"
              />
            </label>
          </div>
          <label class="flex items-center gap-3 border-t border-line px-4 py-3">
            <input
              v-model="pauseWhenGoalReached"
              type="checkbox"
              class="size-5 accent-[oklch(0.48_0.10_238)]"
            />
            <span class="text-sm font-medium text-ink">Pausar se a meta já foi batida</span>
          </label>
          <button
            type="button"
            class="flex h-12 w-full items-center border-t border-line px-4 text-left text-sm font-medium text-ink"
            @click="saveReminderWindow"
          >
            Salvar lembretes
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
        Aparência
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
        Feedback
      </h2>
      <div class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <label class="flex items-center gap-3 border-b border-line px-4 py-3">
          <input
            v-model="feedbackSound"
            type="checkbox"
            class="size-5 accent-[oklch(0.48_0.10_238)]"
          />
          <span class="text-sm font-medium text-ink">Sons ao registrar</span>
        </label>
        <label class="flex items-center gap-3 px-4 py-3">
          <input
            v-model="feedbackHaptic"
            type="checkbox"
            class="size-5 accent-[oklch(0.48_0.10_238)]"
          />
          <span class="text-sm font-medium text-ink">Vibração / toque nos botões</span>
        </label>
      </div>
      <button
        type="button"
        class="mt-3 h-11 w-full rounded-2xl bg-teal text-sm font-semibold text-surface-raised"
        @click="saveFeedback"
      >
        Salvar feedback
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

    <section v-if="show('saude')" class="mt-7">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        {{ t('settings.health') }}
      </h2>
      <div class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <p class="border-b border-line px-4 py-3 text-sm text-ink-soft">
          {{ t('settings.healthHint') }}
        </p>
        <p v-if="healthPlatform === 'ios'" class="border-b border-line px-4 py-3 text-sm text-ink-soft">
          {{ t('settings.healthApple') }}
        </p>
        <p v-else-if="healthPlatform === 'android'" class="border-b border-line px-4 py-3 text-sm text-ink-soft">
          {{ t('settings.healthAndroid') }}
        </p>
        <button
          type="button"
          class="flex h-12 w-full items-center border-b border-line px-4 text-left text-sm font-medium text-ink"
          @click="exportHealth('csv')"
        >
          {{ t('settings.exportHealthCsv') }}
        </button>
        <button
          type="button"
          class="flex h-12 w-full items-center px-4 text-left text-sm font-medium text-ink"
          @click="exportHealth('json')"
        >
          {{ t('settings.exportHealthJson') }}
        </button>
      </div>
    </section>

    <section v-if="show('copos')" class="mt-7">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        Copos
      </h2>
      <div class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <div class="flex items-center justify-between border-b border-line px-4 py-3">
          <p class="text-sm font-semibold text-ink">Atalhos</p>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-teal text-surface-raised"
            aria-label="Adicionar copo"
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
                Editar
              </button>
              <button
                type="button"
                class="h-10 rounded-xl px-3 text-sm font-medium text-ink-soft disabled:opacity-30"
                :disabled="store.cups.length <= 1"
                @click="askDeleteCup(cup.id)"
              >
                Excluir
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
        title="Excluir copo?"
        :message="`Remover ${deletingCupLabel} dos atalhos?`"
        confirm-label="Excluir"
        @confirm="confirmDeleteCup"
      />
    </section>

    <section v-if="show('dados')" class="mt-7">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        Dados
      </h2>
      <div class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <button
          type="button"
          class="flex h-12 w-full items-center border-b border-line px-4 text-left text-sm font-medium text-ink"
          @click="exportBackup"
        >
          Exportar backup
        </button>
        <button
          type="button"
          class="flex h-12 w-full items-center px-4 text-left text-sm font-medium text-ink"
          @click="fileInput?.click()"
        >
          Importar backup
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
        Sobre
      </h2>
      <div class="rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
        <p class="text-sm text-ink">Water Notes</p>
        <p class="text-xs text-ink-soft">Versão {{ APP_VERSION }}</p>
      </div>
    </section>
  </main>

  <ConfirmSheet
    v-model:open="accountDeleteOpen"
    title="Excluir conta?"
    message="Apaga sua conta, dados na nuvem e registros neste aparelho. Esta ação não pode ser desfeita."
    confirm-label="Excluir conta"
    @confirm="confirmDeleteAccount"
  />
  <ConfirmSheet
    v-model:open="importConfirmOpen"
    title="Importar backup?"
    message="Isso substitui todos os dados locais (perfil, copos e lançamentos)."
    confirm-label="Importar"
    @confirm="confirmImport"
  />
</template>
