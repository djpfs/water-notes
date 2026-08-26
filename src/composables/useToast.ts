import { computed, ref } from 'vue'

const message = ref('')
const actionLabel = ref<string | undefined>()
let actionFn: (() => void) | undefined
let timer: ReturnType<typeof setTimeout> | undefined

export function useToast() {
  const visible = computed(() => message.value.length > 0)

  function show(
    text: string,
    options?: {
      action?: { label: string; onClick: () => void }
      duration?: number
    },
  ) {
    message.value = text
    actionLabel.value = options?.action?.label
    actionFn = options?.action?.onClick
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      clear()
    }, options?.duration ?? 5000)
  }

  function clear() {
    message.value = ''
    actionLabel.value = undefined
    actionFn = undefined
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  function onAction() {
    actionFn?.()
    clear()
  }

  return { message, actionLabel, visible, show, clear, onAction }
}
