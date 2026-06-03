import type { BookmarkItem, SavedTab, SavedTabGroup } from "../types/halo";

const hasChrome = () => typeof chrome !== "undefined";

export async function getChromeBookmarks(): Promise<BookmarkItem[]> {
  if (!hasChrome() || !chrome.bookmarks) return [];

  const tree = await chrome.bookmarks.getTree();
  const items: BookmarkItem[] = [];

  const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[], tags: string[] = []) => {
    for (const node of nodes) {
      const nextTags = node.children ? [...tags, node.title].filter(Boolean).slice(-3) : tags;
      if (node.url) {
        items.push({
          id: `chrome-${node.id}`,
          title: node.title || node.url,
          url: node.url,
          tags: nextTags,
          favorite: false,
          faviconUrl: `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(node.url)}&size=32`
        });
      }
      if (node.children) walk(node.children, nextTags);
    }
  };

  walk(tree);
  return items;
}

export async function getRecentTabs(): Promise<SavedTab[]> {
  if (!hasChrome() || !chrome.tabs) return [];
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs
    .filter((tab) => tab.url && !tab.url.startsWith("chrome://"))
    .slice(0, 8)
    .map((tab) => ({
      title: tab.title ?? "Untitled tab",
      url: tab.url ?? "",
      favIconUrl: tab.favIconUrl
    }));
}

export async function saveCurrentTabsAsGroup(name: string, workspaceId?: string): Promise<SavedTabGroup> {
  const tabs = await getRecentTabs();
  return {
    id: crypto.randomUUID(),
    name,
    tabs,
    workspaceId,
    createdAt: new Date().toISOString()
  };
}

export async function restoreTabGroup(group: SavedTabGroup): Promise<void> {
  if (!hasChrome() || !chrome.tabs) {
    group.tabs.forEach((tab) => window.open(tab.url, "_blank", "noopener,noreferrer"));
    return;
  }

  await Promise.all(group.tabs.map((tab) => chrome.tabs.create({ url: tab.url, active: false })));
}

export async function openUrl(url: string, currentTab = false): Promise<void> {
  if (!hasChrome() || !chrome.tabs) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  if (currentTab) {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active?.id) {
      await chrome.tabs.update(active.id, { url });
      return;
    }
  }

  await chrome.tabs.create({ url });
}
