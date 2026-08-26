import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  DEFAULT_CUPS,
  ML_PER_KG,
  type Cup,
  type Profile,
  type WaterEntry,
} from '@/types'
import { localDateKey } from '@/utils/date'
import { createId } from '@/utils/id'

const emptyProfile = (): Profile => ({
  nickname: '',
  weightKg: 70,
  avatarId: 'drop',
  onboarded: false,
})

export const useAppStore = defineStore(
  'app',
  () => {
    const profile = ref<Profile>(emptyProfile())
    const cups = ref<Cup[]>([...DEFAULT_CUPS])
    const entries = ref<WaterEntry[]>([])
    const celebratedDate = ref<string | null>(null)

    const dailyGoalMl = computed(() =>
      Math.round(Math.max(0, profile.value.weightKg) * ML_PER_KG),
    )

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

    function completeOnboarding(data: {
      nickname: string
      weightKg: number
      avatarId: string
    }) {
      profile.value = {
        nickname: data.nickname.trim(),
        weightKg: data.weightKg,
        avatarId: data.avatarId,
        onboarded: true,
      }
    }

    function updateProfile(partial: Partial<Omit<Profile, 'onboarded'>>) {
      profile.value = {
        ...profile.value,
        ...partial,
        nickname:
          partial.nickname !== undefined
            ? partial.nickname.trim()
            : profile.value.nickname,
      }
    }

    function addEntry(ml: number) {
      if (ml <= 0) return
      entries.value.push({
        id: createId(),
        ml: Math.round(ml),
        at: new Date().toISOString(),
      })
    }

    function removeEntry(id: string) {
      entries.value = entries.value.filter((e) => e.id !== id)
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

    return {
      profile,
      cups,
      entries,
      celebratedDate,
      dailyGoalMl,
      todayEntries,
      todayConsumedMl,
      remainingMl,
      progress,
      goalReached,
      completeOnboarding,
      updateProfile,
      addEntry,
      removeEntry,
      addCup,
      updateCup,
      removeCup,
      markCelebratedToday,
      shouldCelebrate,
    }
  },
  {
    persist: true,
  },
)
