import { useState, useEffect, useCallback } from "react";
import "./App.css";

const BLOB_URL = "https://beechwooddash.blob.core.windows.net/dashboard-data/latest_snapshot.json";
const REFRESH_INTERVAL = 300000;

const CATEGORY_ICONS = {
  "Climate & Environment": "🌡️",
  "Vehicles": "🚗",
  "Lights & Switches": "💡",
  "Server Containers": "🖥️",
  "Security": "🔒",
  "Sensors": "📡",
  "Binary Sensors": "⚡",
  "Device Trackers": "📍",
  "Locks": "🔑",
  "Input Selects": "🎛️",
  "Other": "📦",
};

const STATE_CLASS = (state) => {
  if (state === "unavailable" || state === "unknown") return "state-unavailable";
  if (["on", "home", "open", "unlocked", "running", "active", "cool", "heat", "heat_cool", "clean"].includes(state?.toLowerCase())) return "state-on";
  if (["off", "closed", "locked", "idle", "not_home", "dirty"].includes(state?.toLowerCase())) return "state-off";
  return "state-neutral";
};

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function EntityRow({ entity, expanded, onToggle }) {
  const attrs = entity.attributes || {};
  const attrEntries = Object.entries(attrs).filter(([, v]) => v !== null && v !== undefined && String(v).length < 200);

  return (
    <>
      <tr className={`entity-row ${expanded ? "expanded" : ""}`} onClick={onToggle}>
        <td className="col-name">
          <span className="friendly-name">{entity.friendly_name || entity.entity_id}</span>
        </td>
        <td className="col-entity-id">
          <code className="entity-id">{entity.entity_id}</code>
        </td>
        <td className="col-state">
          <span className={`state-badge ${STATE_CLASS(entity.state)}`}>{entity.state}</span>
        </td>
        <td className="col-updated">{formatTime(entity.last_updated)}</td>
        <td className="col-expand">{expanded ? "▲" : "▼"}</td>
      </tr>
      {expanded && (
        <tr className="attr-row">
          <td colSpan={5}>
            <div className="attr-grid">
              {attrEntries.length === 0 ? (
                <span className="no-attrs">No attributes</span>
              ) : (
                attrEntries.map(([k, v]) => (
                  <div key={k} className="attr-item">
                    <span className="attr-key">{k.replace(/_/g, " ")}</span>
                    <span className="attr-val">{String(v)}</span>
                  </div>
                ))
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function EntityTable({ entities, search }) {
  const [expanded, setExpanded] = useState(null);

  const filtered = entities.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.entity_id.toLowerCase().includes(q) ||
      (e.friendly_name || "").toLowerCase().includes(q) ||
      e.state.toLowerCase().includes(q)
    );
  });

  if (filtered.length === 0) return <p className="empty-msg">No matching entities.</p>;

  return (
    <div className="table-wrap">
      <table className="entity-table">
        <thead>
          <tr>
            <th className="col-name">Name</th>
            <th className="col-entity-id">Entity ID</th>
            <th className="col-state">State</th>
            <th className="col-updated">Last Updated</th>
            <th className="col-expand"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((e) => (
            <EntityRow
              key={e.entity_id}
              entity={e}
              expanded={expanded === e.entity_id}
              onToggle={() => setExpanded(expanded === e.entity_id ? null : e.entity_id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("unavailable");
  const [lastFetch, setLastFetch] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${BLOB_URL}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastFetch(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return <div className="loading-screen"><div className="spinner"></div><p>Loading dashboard...</p></div>;
  if (error) return <div className="error-screen"><p>⚠️ Failed to load data: {error}</p><button onClick={fetchData}>Retry</button></div>;

  const entities = data?.entities || [];
  const unavailable = entities.filter((e) => e.state === "unavailable" || e.state === "unknown");

  const categories = ["unavailable", ...Object.keys(
    entities.reduce((acc, e) => { acc[e.category] = true; return acc; }, {})
  ).sort()];

  const tabEntities = activeTab === "unavailable"
    ? unavailable
    : entities.filter((e) => e.category === activeTab);

  const categoryCount = (cat) => cat === "unavailable"
    ? unavailable.length
    : entities.filter((e) => e.category === cat).length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="app-title">🏠 Home Dashboard</h1>
          <span className="subtitle">Powered by Azure + Home Assistant</span>
        </div>
        <div className="topbar-right">
          <div className="stat-pill">
            <span className="stat-num">{data?.total_entities?.toLocaleString()}</span>
            <span className="stat-label">entities</span>
          </div>
          <div className="stat-pill danger">
            <span className="stat-num">{data?.unavailable_count}</span>
            <span className="stat-label">unavailable</span>
          </div>
          <button className="refresh-btn" onClick={fetchData} title="Refresh">↻</button>
          {lastFetch && <span className="last-fetch">Updated {lastFetch.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
      </header>

      <div className="search-bar-wrap">
        <input
          className="search-bar"
          type="text"
          placeholder="🔍  Search by name, entity ID, or state..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && <button className="clear-search" onClick={() => setSearch("")}>✕</button>}
      </div>

      <nav className="tab-nav">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`tab-btn ${activeTab === cat ? "active" : ""} ${cat === "unavailable" ? "tab-danger" : ""}`}
            onClick={() => setActiveTab(cat)}
          >
            {cat === "unavailable" ? "⚠️ Unavailable" : `${CATEGORY_ICONS[cat] || "📦"} ${cat}`}
            <span className="tab-count">{categoryCount(cat)}</span>
          </button>
        ))}
      </nav>

      <main className="content">
        <div className="section-header">
          <h2 className="section-title">
            {activeTab === "unavailable" ? "⚠️ Unavailable Devices" : `${CATEGORY_ICONS[activeTab] || "📦"} ${activeTab}`}
          </h2>
          <span className="section-count">{tabEntities.length} entities</span>
        </div>
        <EntityTable entities={tabEntities} search={search} />
      </main>

      <footer className="footer">
        <span>Data snapshot: {formatTime(data?.last_updated)}</span>
        <span>Auto-refreshes every 5 minutes</span>
      </footer>
    </div>
  );
}