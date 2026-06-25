import { useEffect, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import {
  selectIsActive,
  useGlobalLoadingStore,
} from "@/shared/loading/useGlobalLoadingStore";

/**
 * Debounce перед показом overlay. Удерживает overlay невидимым, пока активное
 * состояние Global_Loading_Manager не сохраняется непрерывно ≥ 200 мс
 * (AC 4.9). Кратковременные всплески активности (≪ 200 мс) overlay не вызывают.
 */
const SHOW_DELAY_MS = 200;

/**
 * Идентификатор корневого DOM-узла приложения, на который вешается атрибут
 * `inert`, пока overlay видим. См. `index.html` (`<div id="root">`). Overlay
 * рендерится через portal в `document.body`, поэтому сам не попадает в inert
 * subtree и сохраняет интерактивность для собственных preventDefault-хендлеров
 * и live-region объявлений (AC 4.7, 4.8).
 */
const APP_ROOT_ID = "root";

/**
 * GlobalLoadingOverlay
 *
 * Полноэкранный блокирующий overlay, подписанный на производный селектор
 * `selectIsActive` из `useGlobalLoadingStore`. Монтируется ровно один раз в
 * корне приложения (AC 4.11 — см. `App.tsx`). Через `createPortal` рендерится
 * в `document.body`, чтобы атрибут `inert`, устанавливаемый на `#root` ниже,
 * не отключал сам overlay.
 *
 * AC references (Requirement 4):
 * - 4.6  — подписан на `selectIsActive`.
 * - 4.7  — перехватывает события `click`, `keydown`, `keyup`, `pointerdown`,
 *          `pointerup`, `touchstart`, `touchend` через `preventDefault` и
 *          блокирует Tab-фокус под overlay через атрибут `inert` на `#root`.
 * - 4.8  — `<Loader2 />` центрирован по обеим осям viewport (`flex` +
 *          `items-center` + `justify-center` поверх `fixed inset-0`).
 * - 4.9  — debounce 200 мс через локальный `setTimeout`; при переходе
 *          active→inactive до истечения дебаунса overlay не появляется
 *          (cleanup отменяет таймер и сбрасывает флаг `hasDelayElapsed`).
 * - 4.10 — при переходе active→inactive overlay скрывается немедленно:
 *          `isVisible` производный от `isActive`, поэтому смена `isActive`
 *          на `false` мгновенно даёт `isVisible === false` в том же рендере.
 */
export function GlobalLoadingOverlay() {
  const isActive = useGlobalLoadingStore(selectIsActive);
  // Флаг «дебаунс истёк»: переводится в `true` только колбэком `setTimeout`
  // через 200 мс после очередной активации и сбрасывается в `false`
  // cleanup-функцией эффекта при де-активации. Сам по себе он overlay не
  // показывает — производное значение `isVisible` ниже требует одновременно
  // активного состояния менеджера и истёкшего дебаунса.
  const [hasDelayElapsed, setHasDelayElapsed] = useState(false);

  // AC 4.9 — отложенная активация на 200 мс. Эффект запускает таймер только
  // когда `isActive === true`; cleanup отменяет таймер и сбрасывает
  // `hasDelayElapsed`, чтобы:
  //   а) при коротком всплеске активности (< 200 мс) overlay вообще не
  //      появился (таймер отменяется до того, как успеет выставить флаг);
  //   б) следующий цикл активации начинался с чистого состояния и снова
  //      выдерживал полные 200 мс дебаунса.
  useEffect(() => {
    if (!isActive) return;
    const timerId = window.setTimeout(() => {
      setHasDelayElapsed(true);
    }, SHOW_DELAY_MS);
    return () => {
      window.clearTimeout(timerId);
      setHasDelayElapsed(false);
    };
  }, [isActive]);

  // AC 4.10 — производное значение: overlay видим только пока менеджер
  // сообщает об активности И дебаунс уже истёк. Как только `isActive`
  // становится `false`, рендер немедленно даёт `isVisible === false`
  // (≤ 50 мс) без дополнительного `setState` в теле эффекта.
  const isVisible = isActive && hasDelayElapsed;

  // AC 4.7 — пока overlay видим, помечаем корень приложения как `inert`,
  // чтобы Tab не переводил фокус под overlay и pointer-события не доходили
  // до элементов под ним. Сам overlay живёт в portal'е document.body, поэтому
  // на нём атрибут не сказывается. Cleanup гарантирует, что при размонтировании
  // или переходе в скрытое состояние атрибут будет снят.
  useEffect(() => {
    if (!isVisible) return;
    const root = document.getElementById(APP_ROOT_ID);
    if (!root) return;
    root.setAttribute("inert", "");
    return () => {
      root.removeAttribute("inert");
    };
  }, [isVisible]);

  if (!isVisible) return null;

  // AC 4.7 — преграждаем семь типов пользовательских событий: click, keydown,
  // keyup, pointerdown, pointerup, touchstart, touchend. Все вызывают
  // `preventDefault` на синтетическом событии React.
  const block = (event: SyntheticEvent) => {
    event.preventDefault();
  };

  const overlay = (
    <div
      role="alert"
      aria-busy="true"
      aria-live="polite"
      data-testid="global-loading-overlay"
      onClick={block}
      onKeyDown={block}
      onKeyUp={block}
      onPointerDown={block}
      onPointerUp={block}
      onTouchStart={block}
      onTouchEnd={block}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
    >
      <div className="rounded-2xl bg-white/95 px-6 py-5 shadow-xl">
        <Loader2
          aria-label="Загрузка"
          className="h-8 w-8 animate-spin text-blue-600"
        />
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
