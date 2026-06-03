import { Command, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { openUrl } from "../../lib/chromeApi";
import { useHalo } from "../../state/HaloStateContext";
import { groupSearchResults, searchHalo } from "../../utils/search";

export function UniversalSearch() {
  const { state, dispatch } = useHalo();
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchHalo(state, query), [state, query]);
  const grouped = useMemo(() => groupSearchResults(results), [results]);

  return (
    <div className="universal-search">
      <Search size={18} />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search bookmarks, notes, tasks, workspaces, tab groups"
      />
      <Command size={16} className="search-command" />
      {query && (
        <div className="search-results">
          {results.length === 0 && <p className="empty-copy">No matching Halo items.</p>}
          {Object.entries(grouped).map(([category, items]) =>
            items.length ? (
              <section key={category}>
                <h4>{category}</h4>
                {items.map((item) => (
                  <button
                    key={`${item.category}-${item.id}`}
                    onClick={() => {
                      if (item.url) void openUrl(item.url, state.settings.searchBehavior === "current-tab");
                      dispatch({ type: "setActiveModule", module: item.module });
                      setQuery("");
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                  </button>
                ))}
              </section>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
