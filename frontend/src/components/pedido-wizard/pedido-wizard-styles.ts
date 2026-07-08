/** Shell do wizard de pedido — largo no desktop, fullscreen no mobile. */
export const PEDIDO_WIZARD_MODAL_CLASS =
  "flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-auto sm:max-h-[min(90vh,52rem)] sm:max-w-5xl sm:rounded-xl sm:border fixed inset-0 translate-x-0 translate-y-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2";

export const PEDIDO_WIZARD_OVERLAY_CLASS = "bg-background/60 backdrop-blur-sm";

export const PEDIDO_WIZARD_HEADER_CLASS =
  "shrink-0 border-b border-border bg-card px-5 py-4 sm:px-6";

export const PEDIDO_WIZARD_BODY_CLASS =
  "min-h-0 flex-1 overflow-y-auto bg-muted/20 px-5 py-5 sm:px-6";

export const PEDIDO_WIZARD_FOOTER_CLASS =
  "flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card/95 px-5 py-3.5 backdrop-blur-sm sm:px-6";

export const PEDIDO_WIZARD_PANEL_CLASS =
  "rounded-xl border border-border bg-card shadow-sm";

export const PEDIDO_WIZARD_SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
