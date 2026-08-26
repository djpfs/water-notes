import { createI18n } from 'vue-i18n'
import en from './locales/en'
import ptBR from './locales/pt-BR'
import type { AppLocale } from '@/types'

export const i18n = createI18n({
  legacy: false,
  locale: 'pt-BR' satisfies AppLocale,
  fallbackLocale: 'pt-BR',
  messages: {
    'pt-BR': ptBR,
    en,
  },
})

export function setI18nLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
}

export function detectLocale(): AppLocale {
  if (typeof navigator === 'undefined') return 'pt-BR'
  const lang = navigator.language.toLowerCase()
  if (lang.startsWith('en')) return 'en'
  return 'pt-BR'
}
