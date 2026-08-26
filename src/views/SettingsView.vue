<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AvatarPicker from '@/components/AvatarPicker.vue'
import {
  disableNotifications,
  enableNotifications,
  setNotificationInterval,
} from '@/composables/useNotifications'
import { useAppStore } from '@/stores/app'
import { ML_PER_KG, NOTIFICATION_INTERVALS, type ThemeMode } from '@/types'
import { formatVolume } from '@/utils/date'

const router = useRouter()
const store = useAppStore()

const nickname = ref(store.profile.nickname)
const weightKg = ref(String(store.profile.weightKg))
const avatarId = ref(store.profile.avatarId)
const useCustomGoal = ref(store.profile.goalOverrideMl != null)
const customGoal = ref(
  String(store.profile.goalOverrideMl ?? store.defaultGoalMl),
)
const bedtime = ref(
  `${String(store.profile.bedtimeHour ?? 22).padStart(2, '0')}:${String(store.profile.bedtimeMinute ?? 0).padStart(2, '0')}`,
)
const notifError = ref('')
const notifBusy = ref(false)
const backupMsg = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const newLabel = ref('')
const newMl = ref('250')
const editingId = ref<string | null>(null)
const editLabel = ref('')
const editMl = ref('')

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

const profileValid = computed(() => {
  if (nickname.value.trim().length < 2) return false
  if (weightNumber.value < 20 || weightNumber.value > 300) return false
  if (useCustomGoal.value) {
    return customGoalNumber.value >= 500 && customGoalNumber.value <= 10000
  }
  return true
})

const themes: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: 'Sistema' },
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
]

function parseBedtime(): { bedtimeHour: number; bedtimeMinute: number } {
  const [h, m] = bedtime.value.split(':').map(Number)
  return {
    bedtimeHour: Number.isFinite(h) ? h : 22,
    bedtimeMinute: Number.isFinite(m) ? m : 0,
  }
}

function saveProfile() {
  if (!profileValid.value) return
  store.updateProfile({
    nickname: nickname.value,
    weightKg: weightNumber.value,
    avatarId: avatarId.value,
    goalOverrideMl: useCustomGoal.value ? customGoalNumber.value : null,
    ...parseBedtime(),
  })
  backupMsg.value = 'Perfil salvo.'
}

function addCup() {
  const ml = Number(String(newMl.value).replace(',', '.'))
  if (!Number.isFinite(ml) || ml <= 0) return
  store.addCup(newLabel.value || 'Copo', ml)
  newLabel.value = ''
  newMl.value = '250'
}

function startEdit(id: string, label: string, ml: number) {
  editingId.value = id
  editLabel.value = label
  editMl.value = String(ml)
}

function saveEdit() {
  if (!editingId.value) return
  const ml = Number(String(editMl.value).replace(',', '.'))
  if (!Number.isFinite(ml) || ml <= 0) return
  store.updateCup(editingId.value, editLabel.value, ml)
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

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
  backupMsg.value = 'Backup exportado.'
}

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    store.importBackup(JSON.parse(text))
    nickname.value = store.profile.nickname
    weightKg.value = String(store.profile.weightKg)
    avatarId.value = store.profile.avatarId
    useCustomGoal.value = store.profile.goalOverrideMl != null
    customGoal.value = String(
      store.profile.goalOverrideMl ?? store.defaultGoalMl,
    )
    bedtime.value = `${String(store.profile.bedtimeHour).padStart(2, '0')}:${String(store.profile.bedtimeMinute).padStart(2, '0')}`
    backupMsg.value = 'Backup importado.'
  } catch (err) {
    backupMsg.value =
      err instanceof Error ? err.message : 'Falha ao importar backup.'
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <main class="safe-pb safe-pt flex min-h-dvh flex-col px-5 pb-8">
    <header class="flex items-center gap-3 pt-1">
      <button
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-xl bg-mist-deep text-ink"
        aria-label="Voltar"
        @click="router.back()"
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

    <section class="mt-6">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-soft">Aparência</h2>
      <div class="mt-3 flex gap-2">
        <button
          v-for="item in themes"
          :key="item.id"
          type="button"
          class="h-11 flex-1 rounded-xl text-sm font-semibold transition"
          :class="
            store.theme === item.id
              ? 'bg-teal text-surface-raised'
              : 'bg-mist-deep text-ink-soft'
          "
          @click="store.setTheme(item.id)"
        >
          {{ item.label }}
        </button>
      </div>
    </section>

    <section class="mt-8">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-soft">
        Lembretes
      </h2>
      <button
        type="button"
        class="mt-3 h-12 w-full rounded-2xl font-semibold transition disabled:opacity-50"
        :class="
          store.notifications.enabled
            ? 'bg-teal text-surface-raised'
            : 'bg-mist-deep text-ink'
        "
        :disabled="notifBusy"
        @click="toggleNotifications"
      >
        {{ store.notifications.enabled ? 'Lembretes ativos' : 'Ativar lembretes' }}
      </button>
      <label v-if="store.notifications.enabled" class="mt-3 block">
        <span class="mb-1.5 block text-sm text-ink-soft">Intervalo</span>
        <select
          class="h-12 w-full rounded-2xl bg-surface px-4 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
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
      <p v-if="notifError" class="mt-2 text-sm text-amber-deep">{{ notifError }}</p>
    </section>

    <section class="mt-8">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-soft">Perfil</h2>

      <label class="mt-3 block">
        <span class="mb-1.5 block text-sm text-ink-soft">Apelido</span>
        <input
          v-model="nickname"
          type="text"
          maxlength="24"
          class="h-12 w-full rounded-2xl bg-surface px-4 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
        />
      </label>

      <label class="mt-3 block">
        <span class="mb-1.5 block text-sm text-ink-soft">Peso (kg)</span>
        <input
          v-model="weightKg"
          type="number"
          inputmode="decimal"
          min="20"
          max="300"
          step="0.1"
          class="h-12 w-full rounded-2xl bg-surface px-4 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
        />
      </label>

      <p class="mt-2 text-xs text-ink-soft">
        Sugestão: {{ formatVolume(suggestedGoal) }} ({{ ML_PER_KG }} ml/kg)
      </p>

      <label class="mt-3 flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
        <input
          v-model="useCustomGoal"
          type="checkbox"
          class="size-5 accent-[oklch(0.48_0.08_195)]"
        />
        <span class="text-sm font-medium text-ink">Meta manual</span>
      </label>

      <label v-if="useCustomGoal" class="mt-3 block">
        <span class="mb-1.5 block text-sm text-ink-soft">Meta (ml)</span>
        <input
          v-model="customGoal"
          type="number"
          inputmode="numeric"
          min="500"
          max="10000"
          step="50"
          class="h-12 w-full rounded-2xl bg-surface px-4 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
        />
      </label>

      <label class="mt-3 block">
        <span class="mb-1.5 block text-sm text-ink-soft">Horário de dormir</span>
        <input
          v-model="bedtime"
          type="time"
          class="h-12 w-full rounded-2xl bg-surface px-4 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
        />
      </label>
      <p class="mt-1 text-xs text-ink-soft">
        Usado para sugerir o próximo gole até esse horário.
      </p>

      <div class="mt-4">
        <p class="mb-2 text-sm text-ink-soft">Avatar</p>
        <AvatarPicker v-model="avatarId" />
      </div>

      <button
        type="button"
        class="mt-4 h-12 w-full rounded-2xl bg-teal font-semibold text-surface-raised disabled:opacity-40"
        :disabled="!profileValid"
        @click="saveProfile"
      >
        Salvar perfil
      </button>
    </section>

    <section class="mt-10">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-soft">Backup</h2>
      <p class="mt-1 text-sm text-ink-soft">Exporte ou restaure seus dados em JSON.</p>
      <div class="mt-3 flex gap-2">
        <button
          type="button"
          class="h-12 flex-1 rounded-2xl bg-mist-deep font-semibold text-ink"
          @click="exportBackup"
        >
          Exportar
        </button>
        <button
          type="button"
          class="h-12 flex-1 rounded-2xl bg-teal font-semibold text-surface-raised"
          @click="fileInput?.click()"
        >
          Importar
        </button>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="hidden"
        @change="onImportFile"
      />
      <p v-if="backupMsg" class="mt-2 text-sm text-teal-deep">{{ backupMsg }}</p>
    </section>

    <section class="mt-10">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-soft">Copos</h2>
      <ul class="mt-4 space-y-2">
        <li
          v-for="cup in store.cups"
          :key="cup.id"
          class="rounded-2xl bg-surface p-3 ring-1 ring-line"
        >
          <div v-if="editingId === cup.id" class="space-y-2">
            <input
              v-model="editLabel"
              type="text"
              class="h-11 w-full rounded-xl bg-mist px-3 outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
              placeholder="Nome"
            />
            <input
              v-model="editMl"
              type="number"
              inputmode="numeric"
              class="h-11 w-full rounded-xl bg-mist px-3 outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
              placeholder="ml"
            />
            <div class="flex gap-2">
              <button
                type="button"
                class="h-10 flex-1 rounded-xl bg-mist-deep text-sm font-semibold text-ink-soft"
                @click="cancelEdit"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="h-10 flex-1 rounded-xl bg-teal text-sm font-semibold text-surface-raised"
                @click="saveEdit"
              >
                Salvar
              </button>
            </div>
          </div>
          <div v-else class="flex items-center justify-between gap-2">
            <div>
              <p class="font-semibold text-ink">{{ cup.label }}</p>
              <p class="text-xs text-ink-soft">{{ formatVolume(cup.ml) }}</p>
            </div>
            <div class="flex gap-1">
              <button
                type="button"
                class="h-10 rounded-xl px-3 text-sm font-medium text-teal"
                @click="startEdit(cup.id, cup.label, cup.ml)"
              >
                Editar
              </button>
              <button
                type="button"
                class="h-10 rounded-xl px-3 text-sm font-medium text-ink-soft disabled:opacity-30"
                :disabled="store.cups.length <= 1"
                @click="store.removeCup(cup.id)"
              >
                Excluir
              </button>
            </div>
          </div>
        </li>
      </ul>

      <div class="mt-4 space-y-2 rounded-2xl bg-mist-deep/50 p-3 ring-1 ring-line">
        <p class="text-sm font-semibold text-ink">Novo copo</p>
        <input
          v-model="newLabel"
          type="text"
          placeholder="Nome (ex.: Squeeze)"
          class="h-11 w-full rounded-xl bg-surface px-3 outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
        />
        <input
          v-model="newMl"
          type="number"
          inputmode="numeric"
          placeholder="ml"
          class="h-11 w-full rounded-xl bg-surface px-3 outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
        />
        <button
          type="button"
          class="h-11 w-full rounded-xl bg-teal font-semibold text-surface-raised"
          @click="addCup"
        >
          Adicionar copo
        </button>
      </div>
    </section>
  </main>
</template>
