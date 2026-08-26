<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AvatarPicker from '@/components/AvatarPicker.vue'
import { useAppStore } from '@/stores/app'
import { formatVolume } from '@/utils/date'

const router = useRouter()
const store = useAppStore()

const nickname = ref(store.profile.nickname)
const weightKg = ref(String(store.profile.weightKg))
const avatarId = ref(store.profile.avatarId)

const newLabel = ref('')
const newMl = ref('250')
const editingId = ref<string | null>(null)
const editLabel = ref('')
const editMl = ref('')

const weightNumber = computed(() => {
  const n = Number(String(weightKg.value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
})

const profileValid = computed(
  () =>
    nickname.value.trim().length >= 2 &&
    weightNumber.value >= 20 &&
    weightNumber.value <= 300,
)

function saveProfile() {
  if (!profileValid.value) return
  store.updateProfile({
    nickname: nickname.value,
    weightKg: weightNumber.value,
    avatarId: avatarId.value,
  })
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
        Meta atual: {{ formatVolume(Math.round(weightNumber * 35)) }}
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
      <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-soft">Copos</h2>
      <p class="mt-1 text-sm text-ink-soft">Atalhos para registrar consumo rápido.</p>

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
