/** quanto esperar a abertura da marca antes de trocar de tela (zero com reduced-motion) */
export function tempoAbertura() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1300;
}
