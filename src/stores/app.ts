import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  BACKUP_VERSION,
  DEFAULT_CUPS,
  DEFAULT_FEEDBACK,
  DEFAULT_NOTIFICATIONS,
  type AppBackup,
  type AppLocale,
  type Cup,
  type DayStat,
  type FeedbackSettings,
  type NotificationSettings,
  type Profile,
  type ThemeMode,
  type WaterEntry,
  DEFAULT_LOCALE,
  WEEKDAY_KEYS,
  type WeeklyReminderWindows,
} from '@/types'
import { detectLocale, setI18nLocale } from '@/i18n'
import { addDays, hoursUntilBedtime, localDateKey, snapMl } from '@/utils/date'
import { createId } from '@/utils/id'
import {
  buildDayStat,
  computeStreak,
  goalForDateKey,
  missedDayKeys,
  pruneEntriesBefore,
  pruneSnapshotsBefore,
  resolveDailyGoalMl,
  resolveGoalForDate,
} from '@/utils/storeLogic'

const KEEP_DAYS = 90

function normalizeWeeklyWindows(
  raw: WeeklyReminderWindows | undefined,
  fallback: NotificationSettings,
): WeeklyReminderWindows {
  const clamp = (value: unknown, min: number, max: number, fallbackValue: number) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return fallbackValue
    return Math.min(max, Math.max(min, Math.round(num)))
  }
  const normalized = { ...DEFAULT_NOTIFICATIONS.weeklyWindows }
  for (const key of WEEKDAY_KEYS) {
    const source = raw?.[key] ?? normalized[key]
    normalized[key] = {
      startHour: clamp(source?.startHour, 0, 23, fallback.windowStartHour),
      startMinute: clamp(source?.startMinute, 0, 59, fallback.windowStartMinute),
      endHour: clamp(source?.endHour, 0, 23, fallback.windowEndHour),
      endMinute: clamp(source?.endMinute, 0, 59, fallback.windowEndMinute),
    }
  }
  return normalized
}

function normalizeNotifications(
  raw: Partial<NotificationSettings> | undefined,
): NotificationSettings {
  const merged: NotificationSettings = {
    ...DEFAULT_NOTIFICATIONS,
    ...raw,
    pauseWhenGoalReached: raw?.pauseWhenGoalReached !== false,
    useWeekdayWindows: raw?.useWeekdayWindows === true,
    adaptiveEnabled: raw?.adaptiveEnabled !== false,
    weeklyWindows: { ...DEFAULT_NOTIFICATIONS.weeklyWindows },
  }
  merged.weeklyWindows = normalizeWeeklyWindows(
    raw?.weeklyWindows as WeeklyReminderWindows | undefined,
    merged,
  )
  return merged
}

function normalizeFeedback(
  raw: Partial<FeedbackSettings> | undefined,
): FeedbackSettings {
  return {
    ...DEFAULT_FEEDBACK,
    ...raw,
  }
}

const emptyProfile = (): Profile => ({
  nickname: '',
  weightKg: 70,
  avatarId: 'drop',
  onboarded: false,
  goalOverrideMl: null,
  activityLevel: 'low',
  heatLevel: 'mild',
  climateAdjustmentMl: 0,
  weekdayGoalMl: null,
  weekendGoalMl: null,
  weeklyGoalDays: 5,
  bedtimeHour: 22,
  bedtimeMinute: 0,
  email: null,
  photoUrl: null,
  useProfilePhoto: false,
})

function normalizeProfile(raw: Partial<Profile> | undefined): Profile {
  const base = emptyProfile()
  const climateAdjustment = Number(raw?.climateAdjustmentMl)
  const weeklyGoalDaysRaw = Number(raw?.weeklyGoalDays)
  return {
    ...base,
    ...raw,
    goalOverrideMl:
      raw?.goalOverrideMl === undefined ? null : raw.goalOverrideMl,
    activityLevel:
      raw?.activityLevel === 'moderate' || raw?.activityLevel === 'high'
        ? raw.activityLevel
        : 'low',
    heatLevel:
      raw?.heatLevel === 'warm' || raw?.heatLevel === 'hot'
        ? raw.heatLevel
        : 'mild',
    climateAdjustmentMl: Number.isFinite(climateAdjustment)
      ? Math.round(climateAdjustment)
      : 0,
    weekdayGoalMl:
      raw?.weekdayGoalMl === undefined ? null : raw.weekdayGoalMl,
    weekendGoalMl:
      raw?.weekendGoalMl === undefined ? null : raw.weekendGoalMl,
    weeklyGoalDays: Number.isFinite(weeklyGoalDaysRaw)
      ? Math.min(7, Math.max(1, Math.round(weeklyGoalDaysRaw)))
      : 5,
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
    const notifications = ref<NotificationSettings>(normalizeNotifications(undefined))
    const feedback = ref<FeedbackSettings>({ ...DEFAULT_FEEDBACK })
    const locale = ref<AppLocale>(detectLocale())
    const installDismissedAt = ref<string | null>(null)
    const lastActiveDate = ref<string | null>(null)
    const lastSummaryDate = ref<string | null>(null)
    const dailyGoalSnapshots = ref<Record<string, number>>({})
    const todayKey = computed(() => localDateKey())

    const defaultGoalMl = computed(() =>
      resolveDailyGoalMl(profile.value.weightKg, null),
    )

    const dailyGoalMl = computed(() =>
      resolveGoalForDate(profile.value, todayKey.value),
    )

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

    function goalForDate(dateKey: string): number {
      return goalForDateKey(
        dateKey,
        dailyGoalSnapshots.value,
        dailyGoalMl.value,
      )
    }

    function ensureTodayGoalSnapshot() {
      dailyGoalSnapshots.value[todayKey.value] = dailyGoalMl.value
    }

    function dayStat(dateKey: string): DayStat {
      return buildDayStat(dateKey, entries.value, goalForDate(dateKey))
    }

    function historyDays(days: number): DayStat[] {
      const today = todayKey.value
      const list: DayStat[] = []
      for (let i = days - 1; i >= 0; i -= 1) {
        list.push(dayStat(addDays(today, -i)))
      }
      return list
    }

    const streak = computed(() =>
      computeStreak(
        todayKey.value,
        entries.value,
        dailyGoalSnapshots.value,
        dailyGoalMl.value,
      ),
    )

    const weeklyReachedCount = computed(() =>
      historyDays(7).filter((day) => day.reached).length,
    )

    const weeklyGoalTargetDays = computed(() =>
      Math.min(7, Math.max(1, profile.value.weeklyGoalDays || 5)),
    )

    const weeklyGoalRate = computed(() =>
      weeklyReachedCount.value / 7,
    )

    const weeklyGoalComplete = computed(
      () => weeklyReachedCount.value >= weeklyGoalTargetDays.value,
    )

    const badgeIds = computed(() => {
      const badges: string[] = []
      if (streak.value >= 3) badges.push('streak-3')
      if (streak.value >= 7) badges.push('streak-7')
      if (streak.value >= 30) badges.push('streak-30')
      if (weeklyGoalComplete.value) badges.push('weekly-goal')
      const monthReached = historyDays(30).filter((day) => day.reached).length
      if (monthReached >= 24) badges.push('consistency-80')
      return badges
    })

    function pruneOldData() {
      const today = localDateKey()
      entries.value = pruneEntriesBefore(entries.value, KEEP_DAYS, today)
      dailyGoalSnapshots.value = pruneSnapshotsBefore(
        dailyGoalSnapshots.value,
        KEEP_DAYS,
        today,
      )
    }

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
      ensureTodayGoalSnapshot()
    }

    function skipOnboarding() {
      completeOnboarding({
        nickname: locale.value === 'en' ? 'Guest' : 'Visitante',
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
      ensureTodayGoalSnapshot()
    }

    function addEntry(ml: number, at = new Date().toISOString()): WaterEntry | null {
      if (ml <= 0) return null
      const entry: WaterEntry = {
        id: createId(),
        ml: Math.round(ml),
        at,
      }
      entries.value.push(entry)
      ensureTodayGoalSnapshot()
      pruneOldData()
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
      pruneOldData()
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

    function setLocale(next: AppLocale) {
      locale.value = next
      setI18nLocale(next)
    }

    function setFeedback(partial: Partial<FeedbackSettings>) {
      feedback.value = normalizeFeedback({
        ...feedback.value,
        ...partial,
      })
    }

    function dismissInstall() {
      installDismissedAt.value = new Date().toISOString()
    }

    function clearInstallDismiss() {
      installDismissedAt.value = null
    }

    function peekMissedSummaries(): DayStat[] {
      const today = localDateKey()
      if (lastSummaryDate.value === today) return []
      if (!lastActiveDate.value || lastActiveDate.value >= today) {
        if (!lastActiveDate.value) lastActiveDate.value = today
        ensureTodayGoalSnapshot()
        return []
      }
      return missedDayKeys(lastActiveDate.value, today).map((key) =>
        dayStat(key),
      )
    }

    /** @deprecated use peekMissedSummaries */
    function peekYesterdaySummary(): DayStat | null {
      const summaries = peekMissedSummaries()
      return summaries.length === 1 ? summaries[0] : summaries[0] ?? null
    }

    function acknowledgeDayRollover() {
      const today = localDateKey()
      lastActiveDate.value = today
      lastSummaryDate.value = today
      ensureTodayGoalSnapshot()
    }

    function touchActiveDate() {
      lastActiveDate.value = localDateKey()
      ensureTodayGoalSnapshot()
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
        feedback: { ...feedback.value },
        locale: locale.value,
        celebratedDate: celebratedDate.value,
        installDismissedAt: installDismissedAt.value,
        lastActiveDate: lastActiveDate.value,
        lastSummaryDate: lastSummaryDate.value,
        dailyGoalSnapshots: { ...dailyGoalSnapshots.value },
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
      feedback.value = normalizeFeedback(raw.feedback)
      locale.value = raw.locale === 'en' ? 'en' : DEFAULT_LOCALE
      setI18nLocale(locale.value)
      celebratedDate.value = raw.celebratedDate ?? null
      installDismissedAt.value = raw.installDismissedAt ?? null
      lastActiveDate.value = raw.lastActiveDate ?? localDateKey()
      lastSummaryDate.value = raw.lastSummaryDate ?? null
      dailyGoalSnapshots.value = { ...(raw.dailyGoalSnapshots ?? {}) }
      ensureTodayGoalSnapshot()
      pruneOldData()
    }

    function resetAll() {
      profile.value = emptyProfile()
      cups.value = [...DEFAULT_CUPS]
      entries.value = []
      celebratedDate.value = null
      theme.value = 'system'
      notifications.value = normalizeNotifications(undefined)
      feedback.value = { ...DEFAULT_FEEDBACK }
      locale.value = DEFAULT_LOCALE
      setI18nLocale(DEFAULT_LOCALE)
      installDismissedAt.value = null
      lastActiveDate.value = null
      lastSummaryDate.value = null
      dailyGoalSnapshots.value = {}
    }

    return {
      profile,
      cups,
      entries,
      celebratedDate,
      theme,
      notifications,
      feedback,
      locale,
      installDismissedAt,
      lastActiveDate,
      lastSummaryDate,
      dailyGoalSnapshots,
      defaultGoalMl,
      dailyGoalMl,
      todayEntries,
      todayConsumedMl,
      remainingMl,
      progress,
      goalReached,
      suggestedSipMl,
      streak,
      weeklyReachedCount,
      weeklyGoalTargetDays,
      weeklyGoalRate,
      weeklyGoalComplete,
      badgeIds,
      historyDays,
      dayStat,
      goalForDate,
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
      setFeedback,
      setLocale,
      dismissInstall,
      clearInstallDismiss,
      peekMissedSummaries,
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
        'feedback',
        'locale',
        'installDismissedAt',
        'lastActiveDate',
        'lastSummaryDate',
        'dailyGoalSnapshots',
      ],
      afterHydrate: (ctx) => {
        const store = ctx.store as unknown as {
          profile: Profile
          notifications: NotificationSettings
          feedback: FeedbackSettings
          locale: AppLocale
          dailyGoalSnapshots: Record<string, number>
          entries: WaterEntry[]
        }
        Object.assign(store.profile, normalizeProfile(store.profile))
        Object.assign(
          store.notifications,
          normalizeNotifications(store.notifications),
        )
        Object.assign(store.feedback, normalizeFeedback(store.feedback))
        store.locale = store.locale === 'en' ? 'en' : DEFAULT_LOCALE
        setI18nLocale(store.locale)
        store.dailyGoalSnapshots = store.dailyGoalSnapshots ?? {}
        const today = localDateKey()
        if (!store.dailyGoalSnapshots[today]) {
          store.dailyGoalSnapshots[today] = resolveGoalForDate(store.profile, today)
        }
        store.entries = pruneEntriesBefore(store.entries ?? [], KEEP_DAYS, today)
        store.dailyGoalSnapshots = pruneSnapshotsBefore(
          store.dailyGoalSnapshots,
          KEEP_DAYS,
          today,
        )
      },
    },
  },
)
