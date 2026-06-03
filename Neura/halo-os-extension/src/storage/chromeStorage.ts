import { defaultState } from "./defaultState";
import type { HaloState } from "../types/halo";

const STORAGE_KEY = "haloOSState";

const hasChromeStorage = () => typeof chrome !== "undefined" && Boolean(chrome.storage?.local);

export async function loadHaloState(): Promise<HaloState> {
  if (!hasChromeStorage()) {
    const local = window.localStorage.getItem(STORAGE_KEY);
    return local ? mergeState(JSON.parse(local) as Partial<HaloState>) : defaultState;
  }

  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ? mergeState(result[STORAGE_KEY] as Partial<HaloState>) : defaultState;
}

export async function saveHaloState(state: HaloState): Promise<void> {
  if (!hasChromeStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return;
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export function mergeState(saved: Partial<HaloState>): HaloState {
  const widgetOrder = saved.settings?.widgetOrder?.length
    ? [
        ...saved.settings.widgetOrder.filter((widget) => defaultState.settings.widgetOrder.includes(widget)),
        ...defaultState.settings.widgetOrder.filter((widget) => !saved.settings?.widgetOrder?.includes(widget))
      ]
    : defaultState.settings.widgetOrder;

  return {
    ...defaultState,
    ...saved,
    providers: saved.providers?.length ? saved.providers : defaultState.providers,
    settings: {
      ...defaultState.settings,
      ...saved.settings,
      visibleWidgets: {
        ...defaultState.settings.visibleWidgets,
        ...saved.settings?.visibleWidgets
      },
      widgetOrder,
      widgetLayouts: {
        ...defaultState.settings.widgetLayouts,
        ...saved.settings?.widgetLayouts
      }
    }
  };
}
