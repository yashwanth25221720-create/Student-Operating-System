import { Download, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { openUrl } from "../../lib/chromeApi";
import { useHalo } from "../../state/HaloStateContext";

export function BookmarksView() {
  const { state, dispatch, importBookmarks } = useHalo();
  const [query, setQuery] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const bookmarks = useMemo(
    () =>
      state.bookmarks.filter(
        (bookmark) =>
          bookmark.title.toLowerCase().includes(query.toLowerCase()) ||
          bookmark.url.toLowerCase().includes(query.toLowerCase()) ||
          bookmark.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
      ),
    [query, state.bookmarks]
  );

  return (
    <section className="module-panel">
      <div className="module-header">
        <div>
          <h1>Bookmarks</h1>
          <p>Chrome imports, favorites, collections, tags, and fast launch cards.</p>
        </div>
        <button
          onClick={() => {
            setImportStatus("Importing Chrome bookmarks...");
            importBookmarks()
              .then((count) => setImportStatus(count ? `Imported ${count} Chrome bookmarks.` : "No Chrome bookmarks were found."))
              .catch((error: unknown) => setImportStatus(error instanceof Error ? error.message : "Bookmark import failed."));
          }}
        >
          <Download size={17} /> Import Chrome Bookmarks
        </button>
      </div>
      {importStatus && <p className="status-message">{importStatus}</p>}
      <label className="inline-search">
        <Search size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search bookmark cards" />
      </label>
      <div className="bookmark-grid">
        {bookmarks.map((bookmark) => (
          <article className="bookmark-card" key={bookmark.id}>
            <button className="favorite-button" onClick={() => dispatch({ type: "toggleBookmarkFavorite", bookmarkId: bookmark.id })}>
              <Star size={17} fill={bookmark.favorite ? "currentColor" : "none"} />
            </button>
            <button className="bookmark-launch" onClick={() => void openUrl(bookmark.url)}>
              <strong>{bookmark.title}</strong>
              <span>{bookmark.url}</span>
            </button>
            <div className="tag-row">{bookmark.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
