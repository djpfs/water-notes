import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  BACKUP_VERSION,
  DEFAULT_CUPS,
  DEFAULT_NOTIFICATIONS,
  ML_PER_KG,
  type AppBackup,
  type Cup,
  type DayStat,
  type NotificationSettings,
  type Profile,
  type ThemeMode,
  type WaterEntry,
} from '@/types'
import {
  addDays,
  hoursUntilBedtime,
  localDateKey,
  snapMl,
} from '@/utils/date'
import { createId } from '@/utils/id'

function normalizeNotifications(
  raw: Partial<NotificationSettings> | undefined,
): NotificationSettings {
  return {
    ...DEFAULT_NOTIFICATIONS,
    ...raw,
    pauseWhenGoalReached: raw?.pauseWhenGoalReached !== false,
  }
}

const emptyProfile = (): Profile => ({
  nickname: '',
  weightKg: 70,
  avatarId: 'drop',
  onboarded: false,
  goalOverrideMl: null,
  bedtimeHour: 22,
  bedtimeMinute: 0,
  email: null,
  photoUrl: null,
  useProfilePhoto: false,
})

function normalizeProfile(raw: Partial<Profile> | undefined): Profile {
  const base = emptyProfile()
  return {
    ...base,
    ...raw,
    goalOverrideMl:
      raw?.goalOverrideMl === undefined ? null : raw.goalOverrideMl,
    bedtimeHour: raw?.bedtimeHour ?? 22,
    bedtimeMinute: raw?.bedtimeMinute ?? 0,
    email: raw?.email ?? null,
    photoUrl: raw?.photoUrl ?? null,
    useProfilePhoto:
      raw?.useProfilePhoto === true ||
      (raw?.useProfilePhoto === undefined && Boolean(raw?.photoUrl)),
  }
}

export const useAppStore = defineStore(
  'app',
  () => {
    const profile = ref<Profile>(emptyProfile())
    const cups = ref<Cup[]>([...DEFAULT_CUPS])
    const entries = ref<WaterEntry[]>([])
    const celebratedDate = ref<string | null>(null)
    const theme = ref<ThemeMode>('system')
    const notifications = ref<NotificationSettings>({ ...DEFAULT_NOTIFICATIONS })
    const installDismissedAt = ref<string | null>(null)
    const lastActiveDate = ref<string | null>(null)
    const lastSummaryDate = ref<string | null>(null)

    const defaultGoalMl = computed(() =>
      Math.round(Math.max(0, profile.value.weightKg) * ML_PER_KG),
    )

    const dailyGoalMl = computed(() => {
      const override = profile.value.goalOverrideMl
      if (override != null && override > 0) return Math.round(override)
      return defaultGoalMl.value
    })

    const todayKey = computed(() => localDateKey())

    const todayEntries = computed(() =>
      entries.value
        .filter((e) => localDateKey(new Date(e.at)) === todayKey.value)
        .sort((a, b) => (a.at < b.at ? 1 : -1)),
    )

    const todayConsumedMl = computed(() =>
      todayEntries.value.reduce((sum, e) => sum + e.ml, 0),
    )

    const remainingMl = computed(() =>
      Math.max(0, dailyGoalMl.value - todayConsumedMl.value),
    )

    const progress = computed(() => {
      if (dailyGoalMl.value <= 0) return 0
      return Math.min(1, todayConsumedMl.value / dailyGoalMl.value)
    })

    const goalReached = computed(
      () => dailyGoalMl.value > 0 && todayConsumedMl.value >= dailyGoalMl.value,
    )

    const suggestedSipMl = computed(() => {
      if (goalReached.value || remainingMl.value <= 0) return 0
      const hours = hoursUntilBedtime(
        profile.value.bedtimeHour,
        profile.value.bedtimeMinute,
      )
      return snapMl(remainingMl.value / hours)
    })

    function consumedOn(dateKey: string): number {
      return entries.value
        .filter((e) => localDateKey(new Date(e.at)) === dateKey)
        .reduce((sum, e) => sum + e.ml, 0)
    }

    function dayStat(dateKey: string, goalMl = dailyGoalMl.value): DayStat {
      const consumedMl = consumedOn(dateKey)
      return {
        date: dateKey,
        consumedMl,
        goalMl,
        reached: goalMl > 0 && consumedMl >= goalMl,
      }
    }

    function historyDays(days: number): DayStat[] {
      const today = todayKey.value
      const list: DayStat[] = []
      for (let i = days - 1; i >= 0; i -= 1) {
        list.push(dayStat(addDays(today, -i)))
      }
      return list
    }

    const streak = computed(() => {
      let count = 0
      let cursor = todayKey.value
      const today = dayStat(cursor)
      if (!today.reached) {
        cursor = addDays(cursor, -1)
      }
      for (let i = 0; i < 365; i += 1) {
        const stat = dayStat(cursor)
        if (!stat.reached) break
        count += 1
        cursor = addDays(cursor, -1)
      }
      return count
    })

    function completeOnboarding(data: {
      nickname: string
      weightKg: number
      avatarId: string
      useProfilePhoto?: boolean
      goalOverrideMl?: number | null
    }) {
      profile.value = normalizeProfile({
        ...profile.value,
        nickname: data.nickname.trim(),
        weightKg: data.weightKg,
        avatarId: data.avatarId,
        useProfilePhoto: data.useProfilePhoto ?? profile.value.useProfilePhoto,
        onboarded: true,
        goalOverrideMl:
          data.goalOverrideMl === undefined
            ? profile.value.goalOverrideMl
            : data.goalOverrideMl,
      })
      lastActiveDate.value = localDateKey()
    }

    function skipOnboarding() {
      completeOnboarding({
        nickname: 'Visitante',
        weightKg: 70,
        avatarId: 'drop',
        goalOverrideMl: null,
      })
    }

    function updateProfile(partial: Partial<Omit<Profile, 'onboarded'>>) {
      profile.value = normalizeProfile({
        ...profile.value,
        ...partial,
        nickname:
          partial.nickname !== undefined
            ? partial.nickname.trim()
            : profile.value.nickname,
      })
    }

    function addEntry(ml: number, at = new Date().toISOString()): WaterEntry | null {
      if (ml <= 0) return null
      const entry: WaterEntry = {
        id: createId(),
        ml: Math.round(ml),
        at,
      }
      entries.value.push(entry)
      return entry
    }

    function updateEntry(id: string, ml: number) {
      const entry = entries.value.find((e) => e.id === id)
      if (!entry || ml <= 0) return
      entry.ml = Math.round(ml)
    }

    function removeEntry(id: string): WaterEntry | null {
      const entry = entries.value.find((e) => e.id === id) ?? null
      entries.value = entries.value.filter((e) => e.id !== id)
      return entry
    }

    function restoreEntry(entry: WaterEntry) {
      if (entries.value.some((e) => e.id === entry.id)) return
      entries.value.push(entry)
    }

    function addCup(label: string, ml: number) {
      cups.value.push({
        id: createId(),
        label: label.trim() || 'Copo',
        ml: Math.round(ml),
      })
    }

    function updateCup(id: string, label: string, ml: number) {
      const cup = cups.value.find((c) => c.id === id)
      if (!cup) return
      cup.label = label.trim() || cup.label
      cup.ml = Math.round(ml)
    }

    function removeCup(id: string) {
      if (cups.value.length <= 1) return
      cups.value = cups.value.filter((c) => c.id !== id)
    }

    function markCelebratedToday() {
      celebratedDate.value = localDateKey()
    }

    function shouldCelebrate(): boolean {
      return goalReached.value && celebratedDate.value !== localDateKey()
    }

    function setTheme(mode: ThemeMode) {
      theme.value = mode
    }

    function cycleTheme() {
      const order: ThemeMode[] = ['system', 'light', 'dark']
      const idx = order.indexOf(theme.value)
      theme.value = order[(idx + 1) % order.length]
    }

    function applyGoogleAccount(data: {
      name?: string | null
      email?: string | null
      picture?: string | null
    }) {
      const first =
        data.name?.trim().split(/\s+/).filter(Boolean)[0] ?? ''
      profile.value = normalizeProfile({
        ...profile.value,
        email: data.email ?? profile.value.email,
        photoUrl: data.picture ?? profile.value.photoUrl,
        useProfilePhoto:
          data.picture && !profile.value.onboarded
            ? true
            : profile.value.useProfilePhoto,
        nickname:
          profile.value.nickname.trim() ||
          first ||
          profile.value.nickname,
      })
    }

    function setNotifications(partial: Partial<NotificationSettings>) {
      notifications.value = normalizeNotifications({
        ...notifications.value,
        ...partial,
      })
    }

    function dismissInstall() {
      installDismissedAt.value = new Date().toISOString()
    }

    function clearInstallDismiss() {
      installDismissedAt.value = null
    }

    function peekYesterdaySummary(): DayStat | null {
      const today = localDateKey()
      if (lastActiveDate.value === today) return null
      if (lastSummaryDate.value === today) return null
      if (!lastActiveDate.value) {
        lastActiveDate.value = today
        return null
      }
      const yesterday = addDays(today, -1)
      return dayStat(yesterday)
    }

    function acknowledgeDayRollover() {
      const today = localDateKey()
      lastActiveDate.value = today
      lastSummaryDate.value = today
    }

    function touchActiveDate() {
      lastActiveDate.value = localDateKey()
    }

    function exportBackup(): AppBackup {
      return {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        profile: { ...profile.value },
        cups: cups.value.map((c) => ({ ...c })),
        entries: entries.value.map((e) => ({ ...e })),
        theme: theme.value,
        notifications: { ...notifications.value },
        celebratedDate: celebratedDate.value,
        installDismissedAt: installDismissedAt.value,
        lastActiveDate: lastActiveDate.value,
        lastSummaryDate: lastSummaryDate.value,
      }
    }

    function importBackup(data: unknown) {
      if (!data || typeof data !== 'object') {
        throw new Error('Arquivo inválido.')
      }
      const raw = data as Partial<AppBackup>
      if (raw.version !== 1) {
        throw new Error('Versão de backup não suportada.')
      }
      if (!raw.profile || !Array.isArray(raw.entries) || !Array.isArray(raw.cups)) {
        throw new Error('Backup incompleto.')
      }
      profile.value = normalizeProfile(raw.profile)
      cups.value = raw.cups.length ? raw.cups.map((c) => ({ ...c })) : [...DEFAULT_CUPS]
      entries.value = raw.entries.map((e) => ({ ...e }))
      theme.value = raw.theme ?? 'system'
      notifications.value = normalizeNotifications(raw.notifications)
      celebratedDate.value = raw.celebratedDate ?? null
      installDismissedAt.value = raw.installDismissedAt ?? null
      lastActiveDate.value = raw.lastActiveDate ?? localDateKey()
      lastSummaryDate.value = raw.lastSummaryDate ?? null
    }

    function resetAll() {
      profile.value = emptyProfile()
      cups.value = [...DEFAULT_CUPS]
      entries.value = []
      celebratedDate.value = null
      theme.value = 'system'
      notifications.value = { ...DEFAULT_NOTIFICATIONS }
      installDismissedAt.value = null
      lastActiveDate.value = null
      lastSummaryDate.value = null
    }

    return {
      profile,
      cups,
      entries,
      celebratedDate,
      theme,
      notifications,
      installDismissedAt,
      lastActiveDate,
      lastSummaryDate,
      defaultGoalMl,
      dailyGoalMl,
      todayEntries,
      todayConsumedMl,
      remainingMl,
      progress,
      goalReached,
      suggestedSipMl,
      streak,
      historyDays,
      dayStat,
      completeOnboarding,
      skipOnboarding,
      updateProfile,
      addEntry,
      updateEntry,
      removeEntry,
      restoreEntry,
      addCup,
      updateCup,
      removeCup,
      markCelebratedToday,
      shouldCelebrate,
      setTheme,
      cycleTheme,
      applyGoogleAccount,
      setNotifications,
      dismissInstall,
      clearInstallDismiss,
      peekYesterdaySummary,
      acknowledgeDayRollover,
      touchActiveDate,
      exportBackup,
      importBackup,
      resetAll,
    }
  },
  {
    persist: {
      pick: [
        'profile',
        'cups',
        'entries',
        'celebratedDate',
        'theme',
        'notifications',
        'installDismissedAt',
        'lastActiveDate',
        'lastSummaryDate',
      ],
      afterHydrate: (ctx) => {
        const store = ctx.store as unknown as {
          profile: Profile
          notifications: NotificationSettings
        }
        Object.assign(store.profile, normalizeProfile(store.profile))
        Object.assign(
          store.notifications,
          normalizeNotifications(store.notifications),
        )
      },
    },
  },
)
