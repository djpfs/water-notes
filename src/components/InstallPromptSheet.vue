<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAppStore } from '@/stores/app'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const store = useAppStore()
const open = ref(false)
const deferred = ref<BeforeInstallPromptEvent | null>(null)
const isIos = ref(false)
const isStandalone = ref(false)

const canNativeInstall = computed(() => Boolean(deferred.value))

function checkStandalone() {
  isStandalone.value =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
}

function maybeOpen() {
  if (!store.profile.onboarded) return
  if (isStandalone.value) return
  if (store.installDismissedAt) {
    const dismissed = new Date(store.installDismissedAt).getTime()
    const day = 24 * 60 * 60 * 1000
    if (Date.now() - dismissed < day) return
  }
  if (deferred.value || isIos.value) {
    open.value = true
  }
}

function onBeforeInstall(e: Event) {
  e.preventDefault()
  deferred.value = e as BeforeInstallPromptEvent
  maybeOpen()
}

async function install() {
  if (!deferred.value) return
  await deferred.value.prompt()
  const choice = await deferred.value.userChoice
  deferred.value = null
  open.value = false
  if (choice.outcome === 'accepted') {
    store.dismissInstall()
  }
}

function dismiss() {
  store.dismissInstall()
  open.value = false
}

onMounted(() => {
  checkStandalone()
  const ua = window.navigator.userAgent.toLowerCase()
  isIos.value = /iphone|ipad|ipod/.test(ua)
  window.addEventListener('beforeinstallprompt', onBeforeInstall)
  window.setTimeout(maybeOpen, 1800)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstall)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
        @click.self="dismiss"
      >
        <div
          class="safe-pb w-full max-w-md rounded-t-3xl bg-surface-raised p-5 shadow-xl ring-1 ring-line sm:rounded-3xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-title"
        >
          <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
          <h2 id="install-title" class="font-display text-xl font-bold text-ink">
            Instalar Water Notes
          </h2>
          <p class="mt-2 text-sm leading-relaxed text-ink-soft">
            Adicione na tela inicial para abrir como app, com acesso rápido e
            lembretes de hidratação.
          </p>

          <template v-if="canNativeInstall">
            <button
              type="button"
              class="mt-5 h-12 w-full rounded-2xl bg-teal font-semibold text-surface-raised"
              @click="install"
            >
              Instalar agora
            </button>
          </template>

          <template v-else-if="isIos">
            <ol class="mt-4 list-decimal space-y-2 pl-5 text-sm text-ink-soft">
              <li>Toque em <strong class="text-ink">Compartilhar</strong> no Safari</li>
              <li>Escolha <strong class="text-ink">Adicionar à Tela de Início</strong></li>
              <li>Confirme em <strong class="text-ink">Adicionar</strong></li>
            </ol>
          </template>

          <template v-else>
            <p class="mt-4 text-sm text-ink-soft">
              Use o menu do navegador e escolha “Instalar app” ou “Adicionar à
              tela inicial”.
            </p>
          </template>

          <button
            type="button"
            class="mt-3 h-12 w-full rounded-2xl bg-mist-deep font-semibold text-ink-soft"
            @click="dismiss"
          >
            Agora não
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.sheet-enter-active > div,
.sheet-leave-active > div {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from > div,
.sheet-leave-to > div {
  transform: translateY(24px);
}
</style>
