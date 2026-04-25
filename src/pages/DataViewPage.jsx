import { useState, useEffect } from 'react'
import { supabase, getCurrentPeriod } from '../lib/supabase.js'

const { year: CY, month: CM } = getCurrentPeriod()

function pct(a, b) { return b ? ((a / b) * 100).toFixed(1) + '%' : '-' }
function fmt(v) { return v != null ? Number(v).toLocaleString() : '-' }

// 3段階評価: 100%以上→ok / 80-99%→warn / 80%未満→err / データなし→null
function tri(actual, target) {
  if (actual == null || !target) return null
  const r = actual / target * 100
  if (r >= 100) return 'ok'
  if (r >= 80)  return 'warn'
  return 'err'
}
// 率同士の比較 (例: AP率0.87 vs 目標0.85)
function triR(actualRate, targetRate) {
  if (actualRate == null || !targetRate) return null
  const r = actualRate / targetRate * 100
  if (r >= 100) return 'ok'
  if (r >= 80)  return 'warn'
  return 'err'
}

const MARK  = { ok: '○', warn: '△', err: '×' }
const COLOR  = { ok: '#059669', warn: '#D97706', err: '#DC2626' }
const BG     = { ok: '#D1FAE5', warn: '#FEF3C7', err: '#FEE2E2' }

export default function DataViewPage() {
  const [mode, setMode] = useState('monthly')
  const [viewYear, setViewYear] = useState(CY)
  const [viewMonth, setViewMonth] = useState(CM)
  const [viewWeek, setViewWeek] = useState(1)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [mode, viewYear, viewMonth, viewWeek])

  async function load() {
    setLoading(true)
    let query = supabase.from('results').select('*').eq('year', viewYear).eq('month', viewMonth)
    if (mode === 'weekly') {
      query = query.eq('week', viewWeek).eq('granularity', 'weekly')
    } else {
      query = query.order('granularity', { ascending: false }).order('week', { ascending: true }).order('created_at', { ascending: false })
    }
    const { data: rows } = await query
    setData(rows ?? [])
    setLoading(false)
  }

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
    else setViewMonth(m => m + 1)
  }

  return (
    <div>
      <div className="hd">
        <h1>📈 データ確認</h1>
        <p>{viewYear}年{viewMonth}月{mode === 'weekly' ? ` 第${viewWeek}週` : ''}</p>
      </div>

      <div className="body">
        <div className="toggle">
          <button className={`tgl-btn${mode === 'monthly' ? ' on' : ''}`} onClick={() => setMode('monthly')}>月別</button>
          <button className={`tgl-btn${mode === 'weekly' ? ' on' : ''}`} onClick={() => setMode('weekly')}>週別</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)', borderRadius: 14, padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
          <button className="btn btn-g btn-sm" onClick={prevMonth}>◀</button>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{viewYear}年{viewMonth}月</span>
          <button className="btn btn-g btn-sm" onClick={nextMonth}>▶</button>
        </div>

        {mode === 'weekly' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(w => (
              <button key={w}
                className={`btn btn-sm${viewWeek === w ? ' btn-p' : ' btn-g'}`}
                style={{ flex: 1 }}
                onClick={() => setViewWeek(w)}
              >第{w}週</button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="loading"><div className="spin" /> 読み込み中...</div>
        ) : data.length === 0 ? (
          <div className="empty"><div className="empty-icon">📭</div><p>データがありません</p></div>
        ) : mode === 'monthly' ? (
          <MonthlyView data={data} />
        ) : (
          data.map(r => <WeekCard key={r.id} r={r} />)
        )}
      </div>
    </div>
  )
}

// ─── 月別ビュー ────────────────────────────────────────────────
function MonthlyView({ data }) {
  const weekly  = data.filter(r => r.granularity === 'weekly')
  const monthly = data.find(r => r.granularity === 'monthly')

  const base           = monthly || (weekly.length ? weekly[weekly.length - 1] : null)
  const totalSales     = monthly?.total_sales
  const budgetSales    = base?.budget_sales
  const lastyearSales  = base?.lastyear_sales
  const totalCustomers = monthly?.total_customers
  const lastyearCustomers = base?.lastyear_customers
  const lastyearVisitors  = base?.lastyear_visitors
  const snapshotDate   = monthly?.snapshot_date

  const sumVisitors = monthly?.store_visitors ?? null
  const sumAP       = monthly?.ap_count ?? null
  const sumSC       = monthly?.sc_count ?? null
  const sumD3       = monthly?.demo3_count ?? null

  const atv = totalSales && totalCustomers ? Math.round(totalSales / totalCustomers) : null
  const lastyearAtv = lastyearSales && lastyearCustomers
    ? Math.round(lastyearSales / lastyearCustomers)
    : (base?.lastyear_atv || null)

  const bc             = base?.budget_customers || 0
  const targetVisitors = bc ? Math.round(bc / 0.50) : 0
  const targetAP       = targetVisitors ? Math.round(targetVisitors * 0.85) : 0
  const targetSC       = targetAP ? Math.round(targetAP * 0.30) : 0
  const targetD3       = targetAP ? Math.round(targetAP * 0.30) : 0

  const cvrRate = sumVisitors ? totalCustomers / sumVisitors : null
  const apRate  = sumVisitors ? sumAP / sumVisitors : null
  const scRate  = sumAP ? sumSC / sumAP : null
  const d3Rate  = sumAP ? sumD3 / sumAP : null

  return (
    <>
      {!monthly && weekly.length === 0 && (
        <div className="empty"><div className="empty-icon">📭</div><p>データがありません</p></div>
      )}

      {/* 売上サマリー */}
      {monthly && totalSales != null && (
        <div className="card">
          <div className="card-title">
            💰 売上サマリー{snapshotDate ? `（${new Date(snapshotDate).getMonth()+1}/${new Date(snapshotDate).getDate()}時点）` : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <BigStat label="売上実績"  value={`¥${fmt(totalSales)}`} />
            <BigStat label="客数実績"  value={`${fmt(totalCustomers)}人`} />
            {budgetSales           && <BigStat label="予算"      value={`¥${fmt(budgetSales)}`} />}
            {lastyearSales         && <BigStat label="前年実績"  value={`¥${fmt(lastyearSales)}`} />}
            {base?.budget_customers && <BigStat label="予算客数" value={`${fmt(base.budget_customers)}人`} />}
            {base?.lastyear_customers && <BigStat label="前年客数" value={`${fmt(base.lastyear_customers)}人`} />}
            {budgetSales   && <BigStat label="達成率" value={pct(totalSales, budgetSales)}  highlight />}
            {lastyearSales && <BigStat label="前年比"  value={pct(totalSales, lastyearSales)} highlight />}
          </div>
          {budgetSales && (
            <div style={{ marginTop: 10 }}>
              <ProgressBar value={totalSales} max={budgetSales} label="予算達成" />
            </div>
          )}
        </div>
      )}

      {/* 行動指標 — 縦並び ○△× */}
      {monthly && (sumVisitors != null || sumAP != null) && (
        <div className="card">
          <div className="card-title">👥 行動指標</div>

          {targetVisitors > 0 && (
            <ActionMetric
              label="入店数"
              actual={sumVisitors} target={targetVisitors} unit="人"
              status={tri(sumVisitors, targetVisitors)}
              note={lastyearVisitors ? `前年${lastyearVisitors}人（前年比 ${pct(sumVisitors, lastyearVisitors)}）` : null}
            />
          )}

          <ActionMetric
            label="CVR（目標55%）"
            actualStr={pct(totalCustomers, sumVisitors)}
            status={triR(cvrRate, 0.55)}
          />

          {targetAP > 0 && (
            <ActionMetric
              label="AP率（目標85%）"
              actual={sumAP} target={targetAP} unit="件"
              status={tri(sumAP, targetAP)}
              note={`入店数比 ${pct(sumAP, sumVisitors)}`}
            />
          )}

          {targetSC > 0 && (
            <ActionMetric
              label="SC率（目標30%）"
              actual={sumSC} target={targetSC} unit="件"
              status={triR(scRate, 0.30)}
              note={`AP比 ${pct(sumSC, sumAP)}`}
            />
          )}

          {targetD3 > 0 && (
            <ActionMetric
              label="３デモ率（目標30%）"
              actual={sumD3} target={targetD3} unit="件"
              status={triR(d3Rate, 0.30)}
              note={`AP比 ${pct(sumD3, sumAP)}`}
            />
          )}

          {atv && (
            <ActionMetric
              label="ATV（客単価）"
              actualStr={`¥${atv.toLocaleString()}`}
              status={lastyearAtv ? tri(atv, lastyearAtv) : null}
              note={lastyearAtv ? `前年¥${lastyearAtv.toLocaleString()}（前年比 ${pct(atv, lastyearAtv)}）` : null}
            />
          )}
        </div>
      )}

      {/* 週次内訳 — 縦並び ○△× */}
      {weekly.length > 0 && (
        <div className="card">
          <div className="card-title">📅 週次内訳</div>
          {weekly.map((r, i) => (
            <WeekRow key={r.id} r={r} last={i === weekly.length - 1} />
          ))}
        </div>
      )}
    </>
  )
}

// ─── 週別ビュー（週タブ切り替え） ───────────────────────────────
function WeekCard({ r }) {
  const visitorTarget = r.budget_customers ? Math.round(r.budget_customers / 0.50) : null
  const apTarget      = visitorTarget ? Math.round(visitorTarget * 0.85) : null
  const scTarget      = apTarget ? Math.round(apTarget * 0.30) : null
  const d3Target      = apTarget ? Math.round(apTarget * 0.30) : null
  const atv           = r.total_sales && r.total_customers ? Math.round(r.total_sales / r.total_customers) : null
  const lastyearAtv   = r.lastyear_sales && r.lastyear_customers
    ? Math.round(r.lastyear_sales / r.lastyear_customers) : r.lastyear_atv

  const cvrRate = r.store_visitors ? r.total_customers / r.store_visitors : null
  const apRate  = r.store_visitors ? r.ap_count / r.store_visitors : null
  const scRate  = r.ap_count ? r.sc_count / r.ap_count : null
  const d3Rate  = r.ap_count ? r.demo3_count / r.ap_count : null

  const dateLabel = r.start_date && r.end_date
    ? `${new Date(r.start_date).getMonth()+1}/${new Date(r.start_date).getDate()}〜${new Date(r.end_date).getMonth()+1}/${new Date(r.end_date).getDate()}`
    : `第${r.week}週`

  return (
    <div className="card">
      <div style={{ marginBottom: 10 }}>
        <span className="badge">{r.year}年{r.month}月 {dateLabel}</span>
      </div>

      {(r.total_sales != null || r.total_customers != null) && (
        <>
          <div className="card-title">💰 売上</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            <BigStat label="売上"   value={`¥${fmt(r.total_sales)}`} />
            <BigStat label="客数"   value={`${fmt(r.total_customers)}人`} />
            {r.budget_sales  && <BigStat label="達成率" value={pct(r.total_sales, r.budget_sales)}  highlight />}
            {r.lastyear_sales && <BigStat label="前年比" value={pct(r.total_sales, r.lastyear_sales)} highlight />}
          </div>
        </>
      )}

      {r.store_visitors > 0 && (
        <>
          <div className="card-title">👥 行動指標</div>
          <div style={{ marginBottom: 12 }}>
            <ActionMetric
              label="入店数"
              actual={r.store_visitors} target={visitorTarget} unit="人"
              status={tri(r.store_visitors, visitorTarget)}
              note={r.lastyear_visitors ? `前年比 ${pct(r.store_visitors, r.lastyear_visitors)}` : null}
            />
            <ActionMetric
              label="CVR（目標55%）"
              actualStr={pct(r.total_customers, r.store_visitors)}
              status={triR(cvrRate, 0.55)}
            />
            <ActionMetric
              label="AP率（目標85%）"
              actual={r.ap_count} target={apTarget} unit="件"
              status={triR(apRate, 0.85)}
              note={`入店数比 ${pct(r.ap_count, r.store_visitors)}`}
            />
            <ActionMetric
              label="SC率（目標30%）"
              actual={r.sc_count} target={scTarget} unit="件"
              status={triR(scRate, 0.30)}
              note={`AP比 ${pct(r.sc_count, r.ap_count)}`}
            />
            <ActionMetric
              label="３デモ率（目標30%）"
              actual={r.demo3_count} target={d3Target} unit="件"
              status={triR(d3Rate, 0.30)}
              note={`AP比 ${pct(r.demo3_count, r.ap_count)}`}
            />
            {atv && (
              <ActionMetric
                label="ATV（客単価）"
                actualStr={`¥${atv.toLocaleString()}`}
                status={lastyearAtv ? tri(atv, lastyearAtv) : null}
                note={lastyearAtv ? `前年比 ${pct(atv, lastyearAtv)}` : null}
              />
            )}
          </div>
        </>
      )}

      {(r.nonmember_sales != null || r.nonmember_customers != null) && (
        <>
          <div className="card-title">🆕 新規・非会員</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            <BigStat label="売上" value={`¥${fmt(r.nonmember_sales)}`} />
            <BigStat label="客数" value={`${fmt(r.nonmember_customers)}人`} />
            {r.nonmember_customers > 0 && (
              <BigStat label="単価" value={`¥${Math.round(r.nonmember_sales / r.nonmember_customers).toLocaleString()}`} />
            )}
          </div>
        </>
      )}

      {r.memo && (
        <>
          <div className="card-title">📝 メモ</div>
          <div className="card-body">{r.memo}</div>
        </>
      )}
    </div>
  )
}

// ─── 月別ビュー内の週次内訳行 ──────────────────────────────────
function WeekRow({ r, last }) {
  const dateLabel = r.start_date && r.end_date
    ? `${new Date(r.start_date).getMonth()+1}/${new Date(r.start_date).getDate()}〜${new Date(r.end_date).getMonth()+1}/${new Date(r.end_date).getDate()}`
    : `第${r.week}週`
  const atv         = r.total_sales && r.total_customers ? Math.round(r.total_sales / r.total_customers) : null
  const lastyearAtv = r.lastyear_sales && r.lastyear_customers
    ? Math.round(r.lastyear_sales / r.lastyear_customers) : r.lastyear_atv
  const apRate = r.store_visitors ? r.ap_count / r.store_visitors : null
  const scRate = r.ap_count ? r.sc_count / r.ap_count : null

  return (
    <div style={{ padding: '10px 0', borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{dateLabel}</span>
        {r.total_sales != null && (
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--p)' }}>¥{fmt(r.total_sales)}</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {r.store_visitors != null && r.lastyear_visitors != null && (
          <MiniRow label="入店数前年比" value={pct(r.store_visitors, r.lastyear_visitors)}
            status={tri(r.store_visitors, r.lastyear_visitors)} />
        )}
        {apRate != null && (
          <MiniRow label="AP率" value={pct(r.ap_count, r.store_visitors)}
            status={triR(apRate, 0.85)} />
        )}
        {scRate != null && (
          <MiniRow label="SC率" value={pct(r.sc_count, r.ap_count)}
            status={triR(scRate, 0.30)} />
        )}
        {r.total_customers != null && r.lastyear_customers != null && (
          <MiniRow label="客数前年比" value={pct(r.total_customers, r.lastyear_customers)}
            status={tri(r.total_customers, r.lastyear_customers)} />
        )}
        {atv && lastyearAtv && (
          <MiniRow label="ATV前年比" value={pct(atv, lastyearAtv)}
            status={tri(atv, lastyearAtv)} />
        )}
        {r.budget_sales != null && r.total_sales != null && (
          <MiniRow label="達成率" value={pct(r.total_sales, r.budget_sales)}
            status={tri(r.total_sales, r.budget_sales)} />
        )}
      </div>
    </div>
  )
}

// ─── 共通コンポーネント ────────────────────────────────────────

/** 行動指標の各行（縦リスト・○△×付き） */
function ActionMetric({ label, actual, actualStr, target, unit = '', status, note }) {
  const displayVal = actualStr ?? (actual != null ? `${actual}${unit}` : '-')
  const s = status  // 'ok' | 'warn' | 'err' | null

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '8px 10px', marginBottom: 4, borderRadius: 10,
      background: s ? BG[s] : 'var(--bg)',
    }}>
      {/* マーク */}
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: s ? COLOR[s] : '#ccc',
        color: '#fff', fontSize: 16, fontWeight: 900,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginRight: 10,
      }}>
        {s ? MARK[s] : '―'}
      </div>

      {/* ラベル・備考 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: s ? COLOR[s] : 'var(--t)' }}>{label}</div>
        {target != null && (
          <div style={{ fontSize: 10, color: 'var(--tl)' }}>目標 {target}{unit}</div>
        )}
        {note && <div style={{ fontSize: 10, color: 'var(--tl)', marginTop: 1 }}>{note}</div>}
      </div>

      {/* 実績値 */}
      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: s ? COLOR[s] : 'var(--t)' }}>{displayVal}</div>
      </div>
    </div>
  )
}

/** 週次内訳の各メトリクス行（コンパクト） */
function MiniRow({ label, value, status }) {
  const s = status
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '4px 8px', borderRadius: 6,
      background: s ? BG[s] + '88' : 'transparent',
    }}>
      <span style={{ fontSize: 11, color: 'var(--tl)', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, marginRight: 8, color: s ? COLOR[s] : 'var(--t)' }}>{value}</span>
      <span style={{
        fontSize: 14, fontWeight: 900, minWidth: 18, textAlign: 'center',
        color: s ? COLOR[s] : 'var(--tl)',
      }}>
        {s ? MARK[s] : '―'}
      </span>
    </div>
  )
}

function BigStat({ label, value, highlight }) {
  return (
    <div style={{ background: highlight ? 'var(--pl)' : 'var(--bg)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--tl)' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: highlight ? 'var(--p)' : 'var(--t)', marginTop: 2 }}>{value}</div>
    </div>
  )
}

function ProgressBar({ value, max, label }) {
  const p = Math.min((value / max) * 100, 100)
  const color = p >= 100 ? COLOR.ok : p >= 80 ? COLOR.warn : COLOR.err
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tl)', marginBottom: 4 }}>
        <span>{label}</span><span>{p.toFixed(1)}%</span>
      </div>
      <div style={{ height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: p + '%', background: color, borderRadius: 4, transition: 'width .4s' }} />
      </div>
    </div>
  )
}
