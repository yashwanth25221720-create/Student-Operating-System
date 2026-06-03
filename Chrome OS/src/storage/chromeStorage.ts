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
      widgetOrder: mergeWidgetOrder(saved.settings?.widgetOrder),
      minimalWidgets: saved.settings?.minimalWidgets?.length ? saved.settings.minimalWidgets : defaultState.settings.minimalWidgets,
      widgetGroups: saved.settings?.widgetGroups ?? defaultState.settings.widgetGroups,
      widgetPresets: saved.settings?.widgetPresets?.length ? saved.settings.widgetPresets : defaultState.settings.widgetPresets,
      adBlocker: {
        ...defaultState.settings.adBlocker,
        ...saved.settings?.adBlocker,
        stats: {
          ...defaultState.settings.adBlocker.stats,
          ...saved.settings?.adBlocker?.stats
        }
      }
    }
  };
}

function mergeWidgetOrder(savedOrder?: HaloState["settings"]["widgetOrder"]) {
  const saved = savedOrder ?? [];
  return [...saved, ...defaultState.settings.widgetOrder.filter((widget) => !saved.includes(widget))];
}
