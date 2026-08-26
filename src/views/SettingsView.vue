<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AvatarPicker from '@/components/AvatarPicker.vue'
import {
  type AuthUser,
  clearAuthCache,
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
import { useAppStore } from '@/stores/app'
import { ML_PER_KG, NOTIFICATION_INTERVALS, type ThemeMode } from '@/types'
import { formatVolume } from '@/utils/date'
import { formatClock, parseClock } from '@/utils/timeWindow'
import { APP_VERSION } from '@/version'

const router = useRouter()
const store = useAppStore()

const search = ref('')
const cloudUser = ref<AuthUser | null>(null)
const cloudBusy = ref(false)
const cloudMsg = ref('')
const cloudError = ref('')

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
const notifMsg = ref('')
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

type Section = {
  id: string
  title: string
  keywords: string
}

const sections: Section[] = [
  { id: 'conta', title: 'Conta', keywords: 'conta login google sync sincronizar sair nuvem' },
  { id: 'perfil', title: 'Perfil', keywords: 'perfil apelido peso avatar foto' },
  { id: 'meta', title: 'Meta', keywords: 'meta ml peso objetivo dormir horário' },
  { id: 'lembretes', title: 'Lembretes', keywords: 'lembretes notificação intervalo janela pausar' },
  { id: 'aparencia', title: 'Aparência', keywords: 'aparência tema claro escuro sistema' },
  { id: 'copos', title: 'Copos', keywords: 'copos atalhos volume garrafa caneca' },
  { id: 'dados', title: 'Dados', keywords: 'dados backup exportar importar' },
  { id: 'sobre', title: 'Sobre', keywords: 'sobre versão app' },
]

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return new Set(sections.map((s) => s.id))
  return new Set(
    sections
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
  notifMsg.value = 'Lembretes atualizados.'
}

async function onTestNotification() {
  notifError.value = ''
  notifMsg.value = ''
  notifBusy.value = true
  try {
    await sendTestNotification()
    notifMsg.value = 'Notificação de teste enviada.'
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
  <main class="safe-pb flex min-h-dvh flex-col px-5 pb-10">
    <div class="app-bar">
      <header class="flex items-center gap-3">
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
          <AvatarPicker v-model="avatarId" />
        </div>
      </div>
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
            class="size-5 accent-[oklch(0.48_0.08_195)]"
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
        :disabled="!profileValid"
        @click="saveProfile"
      >
        Salvar perfil e meta
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
              class="size-5 accent-[oklch(0.48_0.08_195)]"
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
          Testar notificação
        </button>
      </div>
      <p v-if="notifError" class="mt-2 px-1 text-sm text-amber-deep">{{ notifError }}</p>
      <p v-if="notifMsg" class="mt-2 px-1 text-sm text-teal-deep">{{ notifMsg }}</p>
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

    <section v-if="show('copos')" class="mt-7">
      <h2 class="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        Copos
      </h2>
      <ul class="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <li
          v-for="cup in store.cups"
          :key="cup.id"
          class="border-b border-line px-4 py-3 last:border-b-0"
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

      <div class="mt-3 space-y-2 overflow-hidden rounded-2xl bg-surface p-4 ring-1 ring-line">
        <p class="text-sm font-semibold text-ink">Novo copo</p>
        <input
          v-model="newLabel"
          type="text"
          placeholder="Nome (ex.: Squeeze)"
          class="h-11 w-full rounded-xl bg-mist px-3 outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
        />
        <input
          v-model="newMl"
          type="number"
          inputmode="numeric"
          placeholder="ml"
          class="h-11 w-full rounded-xl bg-mist px-3 outline-none ring-1 ring-line focus:ring-2 focus:ring-teal"
        />
        <button
          type="button"
          class="h-11 w-full rounded-xl bg-teal font-semibold text-surface-raised"
          @click="addCup"
        >
          Adicionar
        </button>
      </div>
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
      <p v-if="backupMsg" class="mt-2 px-1 text-sm text-teal-deep">{{ backupMsg }}</p>
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
</template>
