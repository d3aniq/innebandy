// app.js – Referee Dashboard (top-notch)
import { createElement as h, useEffect, useMemo, useState } from "https://esm.sh/react@18";
import { createRoot } from "https://esm.sh/react-dom@18/client";

// ----------------- UI helpers -----------------
const cls = (...xs)=>xs.filter(Boolean).join(" ");
const store = {
  get: (k, d)=> { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k,v)=> { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

function Badge({children}) {
  return h("span",{className:"text-xs px-2 py-1 rounded-full bg-slate-200"},children);
}
function StatCard({title, value, sub}) {
  return h("div",{className:"rounded-2xl bg-white shadow p-4"},[
    h("div",{className:"text-sm text-slate-500"},title),
    h("div",{className:"text-3xl font-semibold mt-1"}, value),
    sub && h("div",{className:"text-xs text-slate-500 mt-1"}, sub)
  ]);
}
function Section({title, children, right}) {
  return h("div",{className:"rounded-2xl bg-white shadow p-4"},[
    h("div",{className:"flex items-center justify-between mb-2"},[
      h("div",{className:"font-semibold"},title),
      right || null
    ]),
    children
  ]);
}
function SearchSelect({label, options, value, onChange, placeholder="Välj...", multiple=false}) {
  return h("div",{className:"flex flex-col gap-1"},[
    h("label",{className:"text-xs text-slate-600"},label),
    h("select",{
      className:"rounded-xl border p-2 bg-white",
      value: multiple ? undefined : value,
      multiple,
      onChange: e=>{
        if (multiple) {
          const vals = Array.from(e.target.selectedOptions).map(o=>o.value);
          onChange(vals);
        } else {
          onChange(e.target.value);
        }
      }
    },[
      !multiple && h("option",{value:""},placeholder),
      ...options.map(o=>h("option",{key:o, value:o},o))
    ])
  ]);
}
function DateRange({min,max,value,onChange}) {
  const [from,to] = value;
  return h("div",{className:"grid grid-cols-2 gap-2"},[
    h("div",{},[
      h("label",{className:"text-xs text-slate-600"},"Från"),
      h("input",{type:"date", className:"rounded-xl border p-2 w-full", min, max, value:from||"", onChange:e=>onChange([e.target.value||"",to])})
    ]),
    h("div",{},[
      h("label",{className:"text-xs text-slate-600"},"Till"),
      h("input",{type:"date", className:"rounded-xl border p-2 w-full", min, max, value:to||"", onChange:e=>onChange([from,e.target.value||""])})
    ])
  ]);
}

// --------------- Charts (Chart.js) ---------------
function useChart(id, cfg) {
  useEffect(()=>{
    const el = document.getElementById(id);
    if (!el) return;
    if (el._chart) el._chart.destroy();
    const chart = new Chart(el, cfg);
    el._chart = chart;
    return ()=>chart.destroy();
  }, [id, JSON.stringify(cfg)]);
}
function BarChart({id, labels, values, label}) {
  useChart(id, {
    type:"bar",
    data:{ labels, datasets:[{ label, data:values }] },
    options:{ responsive:true, plugins:{ legend:{ display:false }}, scales:{ x:{ ticks:{ autoSkip:false }}}}
  });
  return h("canvas",{id, height:160});
}
function TopList({items, labelKey, valueKey, empty="—", onItemClick}) {
  if (!items?.length) return h("div",{className:"text-sm text-slate-500"},empty);
  return h("ul",{className:"text-sm"}, items.map((it,i)=>h("li",{
    key:i,
    className:"flex justify-between border-b py-1 cursor-pointer hover:bg-slate-50 rounded",
    onClick: ()=> onItemClick?.(it)
  },[
    h("span",{}, it[labelKey] || "—"),
    h("span",{className:"font-mono"}, it[valueKey])
  ])));
}

// --------------- Tables -----------------
function MatchesTable({rows}) {
  return h("div",{className:"overflow-x-auto rounded-2xl border bg-white"},[
    h("table",{className:"min-w-full text-sm"},[
      h("thead",{className:"bg-slate-100"}, h("tr",{},[
        h("th",{className:"text-left p-2"},"Datum"),
        h("th",{className:"text-left p-2"},"Tid"),
        h("th",{className:"text-left p-2"},"Serie"),
        h("th",{className:"text-left p-2"},"Arena"),
        h("th",{className:"text-left p-2"},"Hemma"),
        h("th",{className:"text-left p-2"},"Borta"),
        h("th",{className:"text-left p-2"},"Länk")
      ])),
      h("tbody",{}, rows.map((r,i)=> h("tr",{key:r.match_id, className: i%2? "bg-slate-50":""},[
        h("td",{className:"p-2 whitespace-nowrap"}, r.date || ""),
        h("td",{className:"p-2 whitespace-nowrap"}, r.time || ""),
        h("td",{className:"p-2"}, r.series || ""),
        h("td",{className:"p-2"}, r.arena || ""),
        h("td",{className:"p-2"}, r.home || ""),
        h("td",{className:"p-2"}, r.away || ""),
        h("td",{className:"p-2"}, r.url ? h("a",{href:r.url, target:"_blank", rel:"noopener", className:"text-blue-600 underline"},"Match") : "—")
      ])))
    ])
  ]);
}

// --------------- CSV export -----------------
function downloadCSV(filename, rows) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const escape = v => `"${String(v??"").replaceAll(`"`,`""`)}"`;
  const csv = [headers.join(","), ...rows.map(r=>headers.map(h=>escape(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// --------------- App -----------------
function App(){
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Restored UI state
  const [referee, setReferee] = useState(()=>store.get("ref_referee",""));
  const [compareRefs, setCompareRefs] = useState(()=>store.get("ref_compare",[]));
  const [seriesFilter, setSeriesFilter] = useState(()=>store.get("ref_series",[]));
  const [arenaFilter, setArenaFilter] = useState(()=>store.get("ref_arenas",[]));
  const [dateRange, setDateRange] = useState(()=>store.get("ref_dates",["",""]));
  const [partnerFocus, setPartnerFocus] = useState(null); // when set, show only matches with this partner & referee

  // Persist
  useEffect(()=>store.set("ref_referee",referee),[referee]);
  useEffect(()=>store.set("ref_compare",compareRefs),[compareRefs]);
  useEffect(()=>store.set("ref_series",seriesFilter),[seriesFilter]);
  useEffect(()=>store.set("ref_arenas",arenaFilter),[arenaFilter]);
  useEffect(()=>store.set("ref_dates",dateRange),[dateRange]);

  // Load data.json
  useEffect(()=>{
    fetch("./data.json")
      .then(r=>r.json())
      .then(setData)
      .catch(e=>setError(e.toString()))
      .finally(()=>setLoading(false));
  },[]);

  // Filtered view
  const filteredMatches = useMemo(()=>{
    if (!data) return [];
    const [from,to] = dateRange;
    const fromD = from ? new Date(from) : null;
    const toD = to ? new Date(to) : null;
    return data.matches.filter(m=>{
      const d = m.date ? new Date(m.date) : null;
      if (fromD && (!d || d < fromD)) return false;
      if (toD && (!d || d > toD)) return false;
      if (seriesFilter.length && !seriesFilter.includes(m.series)) return false;
      if (arenaFilter.length && !arenaFilter.includes(m.arena)) return false;
      if (referee && !m.referees.includes(referee)) return false;
      if (partnerFocus && referee) {
        // keep only matches where both referee and partnerFocus are in m.referees
        const refs = m.referees || [];
        if (!(refs.includes(referee) && refs.includes(partnerFocus))) return false;
      }
      return true;
    });
  },[data, referee, seriesFilter, arenaFilter, dateRange, partnerFocus]);

  // Current ref summary
  const current = useMemo(()=>{
    if(!data || !referee || !data.referees[referee]) return null;
    return data.referees[referee];
  },[data, referee]);

  // Aggregations from filteredMatches (for charts when no ref chosen)
  const aggBy = (arr, key)=> {
    const map = new Map();
    for (const r of arr) {
      const k = r[key] || "Okänd";
      map.set(k, (map.get(k)||0)+1);
    }
    return [...map.entries()].sort((a,b)=>b[1]-a[1]);
  };

  const matchesForCharts = useMemo(()=>{
    if (referee && current) {
      // Use the ref's own match list filtered by current filters (series/arena/date & partner if set)
      const idsAllowed = new Set(filteredMatches.map(m=>m.match_id));
      return current.matches.filter(m=>idsAllowed.has(m.match_id));
    }
    return filteredMatches.map(m=>({ // normalize
      date: m.date, time: "", home:m.home, away:m.away, series:m.series, arena:m.arena, match_id:m.match_id
    }));
  },[filteredMatches, referee, current]);

  // Weekday / Hour / Monthly breakdown
  const parseDate = s => s ? new Date(s) : null;
  const weekdayCounts = (()=> {
    const map=new Array(7).fill(0); // 0 Sun ... 6 Sat
    for (const m of matchesForCharts) {
      const d = parseDate(m.date);
      if (d) map[d.getDay()] += 1;
    }
    // Labels with Swedish weekday
    const labs = ["Sön","Mån","Tis","Ons","Tors","Fre","Lör"];
    return { labels: labs, values: [map[0],map[1],map[2],map[3],map[4],map[5],map[6]] };
  })();

  const hourCounts = (()=> {
    const buckets = new Array(24).fill(0);
    for (const m of matchesForCharts) {
      // time may be "", try extracting from data.matches if needed
      let hh = null;
      if (m.time && /^\d{2}:\d{2}/.test(m.time)) hh = parseInt(m.time.slice(0,2),10);
      if (hh==null) {
        // best-effort: ignore
        continue;
      }
      if (hh>=0 && hh<24) buckets[hh]++;
    }
    const labels = [...Array(24)].map((_,i)=> i.toString().padStart(2,"0")+":00");
    return { labels, values: buckets };
  })();

  const monthlyCounts = (()=> {
    const map = new Map(); // YYYY-MM => count
    for (const m of matchesForCharts) {
      const d = parseDate(m.date);
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      map.set(key,(map.get(key)||0)+1);
    }
    const entries = [...map.entries()].sort((a,b)=>a[0]<b[0]?-1:1);
    return { labels: entries.map(e=>e[0]), values: entries.map(e=>e[1]) };
  })();

  // Compare table data
  const compareRows = (compareRefs||[]).map(r=>({ ref:r, total: data?.referees?.[r]?.total_matches ?? 0 }));

  // Export rows (filtered)
  const exportRows = filteredMatches.map(m=>({
    date: m.date || "",
    home: m.home || "",
    away: m.away || "",
    series: m.series || "",
    arena: m.arena || "",
    referees: (m.referees||[]).join(" | "),
    url: m.url || ""
  }));

  function clearAll() {
    setReferee(""); setCompareRefs([]); setSeriesFilter([]); setArenaFilter([]); setDateRange(["",""]); setPartnerFocus(null);
  }

  function onPartnerClick(item) {
    // item.coreferees or item.team depending on list; partner list uses {coreferees, together_matches}
    if (!item?.coreferees) return;
    const p = item.coreferees;
    setPartnerFocus(p === partnerFocus ? null : p);
  }

  if (loading) return h("div",{className:"p-6"},"Laddar...");
  if (error) return h("div",{className:"p-6 text-red-600"},"Fel: "+error);
  if (!data) return h("div",{className:"p-6"},"Ingen data.");

  return h("div",{className:"space-y-4"},[
    // Header
    h("div",{className:"flex items-center justify-between"},[
      h("h1",{className:"text-2xl font-semibold"},"Domar-dashboard"),
      h("div",{className:"flex items-center gap-3"},[
        h(Badge,null, `Period: ${data.date_min || "?"} → ${data.date_max || "?""}`),
        h("button",{
          className:"px-3 py-2 rounded-xl border hover:bg-slate-50",
          onClick: ()=> downloadCSV("filtered_matches.csv", exportRows)
        },"Exportera CSV")
      ])
    ]),

    // Filters
    h("div",{className:"grid md:grid-cols-5 gap-3"},[
      h(SearchSelect,{label:"Domare", options:data.all_referees, value:referee, onChange:(v)=>{ setReferee(v); setPartnerFocus(null); }, placeholder:"Välj domare"}),
      h(SearchSelect,{label:"Jämför med (flera)", options:data.all_referees.filter(r=>r!==referee), value:compareRefs, onChange:setCompareRefs, multiple:true}),
      h(SearchSelect,{label:"Serier", options:data.all_series, value:seriesFilter, onChange:setSeriesFilter, multiple:true}),
      h(SearchSelect,{label:"Arenor", options:data.all_arenas, value:arenaFilter, onChange:setArenaFilter, multiple:true}),
      h("div", {className:"self-end"}, h("button",{className:"px-3 py-2 rounded-xl bg-slate-900 text-white w-full", onClick:clearAll},"Rensa filter"))
    ]),

    // Date range
    h("div",{className:"grid md:grid-cols-3 gap-3"},[
      h(Section,{title:"Datumintervall", children: h(DateRange,{min:data.date_min||"", max:data.date_max||"", value:dateRange, onChange:setDateRange})})
    ]),

    // KPI row
    h("div",{className:"grid md:grid-cols-4 gap-3"},[
      h(StatCard,{title:"Matcher i vyn", value: filteredMatches.length}),
      h(StatCard,{title:"Vald domare", value: referee || "—", sub: referee? `${data.referees[referee]?.total_matches ?? 0} matcher totalt` : ""}),
      h(StatCard,{title:"Serier (filter)", value: seriesFilter.length || "—"}),
      h(StatCard,{title:"Arenor (filter)", value: arenaFilter.length || "—"})
    ]),

    // When referee selected – deep dive
    referee && current ? h("div",{className:"grid md:grid-cols-2 gap-3"},[
      h(Section,{title:"Topp-partners",
        right: partnerFocus ? h(Badge,null,`Partnerfilter: ${partnerFocus}`): null,
        children: h(TopList,{items: current.top_partners, labelKey:"coreferees", valueKey:"together_matches", onItemClick:onPartnerClick})
      }),
      h(Section,{title:"Seriefördelning",
        children: h(BarChart,{id:"seriesChart", labels: current.series_distribution.map(d=>d.series||"Okänd"), values: current.series_distribution.map(d=>d.matches), label:"Matcher"})
      }),
      h(Section,{title:"Lag du dömt mest",
        children: h(TopList,{items: current.top_teams, labelKey:"team", valueKey:"matches"})
      }),
      h(Section,{title:"Arenor du dömt mest på",
        children: h(TopList,{items: current.top_arenas, labelKey:"arena", valueKey:"matches"})
      })
    ]) : null,

    // Trends (work with either current ref filtered list or all filtered matches)
    h("div",{className:"grid md:grid-cols-3 gap-3"},[
      h(Section,{title:"Matcher per veckodag",
        children: h(BarChart,{id:"weekdayChart", labels: weekdayCounts.labels, values: weekdayCounts.values, label:"Matcher"})
      }),
      h(Section,{title:"Matcher per timme",
        children: h(BarChart,{id:"hourChart", labels: hourCounts.labels, values: hourCounts.values, label:"Matcher"})
      }),
      h(Section,{title:"Matcher per månad",
        children: h(BarChart,{id:"monthChart", labels: monthlyCounts.labels, values: monthlyCounts.values, label:"Matcher"})
      })
    ]),

    // Compare simple table
    compareRefs?.length ? h(Section,{title:"Jämförelse (matcher totalt)", children:
      h("table",{className:"min-w-full text-sm"},[
        h("thead",{className:"bg-slate-100"},h("tr",{},[
          h("th",{className:"text-left p-2"},"Domare"),
          h("th",{className:"text-left p-2"},"Matcher totalt")
        ])),
        h("tbody",{}, compareRows.map((r,i)=> h("tr",{key:r.ref, className:i%2?"bg-slate-50":""},[
          h("td",{className:"p-2"}, r.ref),
          h("td",{className:"p-2"}, r.total)
        ])))
      ])
    }) : null,

    // Matches table (filtered)
    h("div",{className:"mt-2"},[
      h("div",{className:"flex items-center justify-between mb-2"},[
        h("div",{className:"font-semibold"},"Matcher i vyn"),
        h("div",{}, h("button",{className:"px-3 py-2 rounded-xl border hover:bg-slate-50", onClick:()=>downloadCSV("filtered_matches.csv", exportRows)},"Exportera CSV"))
      ]),
      h(MatchesTable,{rows: filteredMatches.map(m=>{
        const rdet = data.referees[referee];
        const mm = rdet?.matches?.find(x=>x.match_id===m.match_id);
        return {
          match_id:m.match_id,
          date:mm?.date || m.date,
          time:mm?.time || "",
          home:m.home, away:m.away, series:m.series, arena:m.arena, url:m.url
        };
      })})
    ])
  ]);
}

createRoot(document.getElementById("app")).render(h(App));
