import { useState, useEffect } from 'react'
import { supabase, getCurrentPeriod } from '../lib/supabase.js'

const { year: CY, month: CM } = getCurrentPeriod()

function pct(a, b) { return b ? ((a / b) * 100).toFixed(1) + '%' : '-' }
function fmt(v) { return v != null ? Number(v).toLocaleString() : '-' }
function rate(actual, target) {
  if (target == null || actual == null) return null
  return ((actual / target) * 100).toFixed(1)
}

export default function DataViewPage() {
  const [mode, setMode] = useState('monthly') // 'monthly' | 'weekly'
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

        {/* 月セレクター */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)', borderRadius: 14, padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
          <button className="btn btn-g btn-sm" onClick={prevMonth}>◀</button>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{viewYear}年{viewMonth}月</span>
          <button className="btn btn-g btn-sm" onClick={nextMonth}>▶</button>
        </div>

        {/* 週セレクター（週別のみ） */}
        {mode === 'weekly' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(w => (
              <button key={w}
                className={`btn btn-sm${viewWeek === w ? ' btn-p' : ' btn-g'}`}
                style={{ flex: 1 }}
                onClick={() => setViewWeek(w)}
              >
                第{w}週
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="loading"><div className="spin" /> 読み込み中...</div>
        ) : data.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📭</div>
            <p>データがありません</p>
          </div>
        ) : mode === 'monthly' ? (
          <MonthlyView data={data} year={viewYear} month={viewMonth} />
        ) : (
          data.map(r => <WeekCard key={r.id} r={r} />)
        )}
      </div>
    </div>
  )
}

function MonthlyView({ data, year, month }) {
  const weekly = data.filter(r => r.granularity === 'weekly')
  const monthly = data.find(r => r.granularity === 'monthly')

  // 行動指標：月次に入力あればそれを優先、なければ週次の合計
  const sumVisitors = (monthly?.store_visitors != null) ? monthly.store_visitors : weekly.reduce((s, r) => s + (r.store_visitors || 0), 0)
  const sumAP = (monthly?.ap_count != null) ? monthly.ap_count : weekly.reduce((s, r) => s + (r.ap_count || 0), 0)
  const sumSC = (monthly?.sc_count != null) ? monthly.sc_count : weekly.reduce((s, r) => s + (r.sc_count || 0), 0)
  const sumD3 = (monthly?.demo3_count != null) ? monthly.demo3_count : weekly.reduce((s, r) => s + (r.demo3_count || 0), 0)
  const useMonthly = monthly != null

  // 売上は月次があればそちら、なければ週次の合計
  const base = monthly || (weekly.length ? weekly[weekly.length - 1] : null)
  const totalSales = base?.total_sales
  const budgetSales = base?.budget_sales
  const lastyearSales = base?.lastyear_sales
  const totalCustomers = base?.total_customers
  const lastyearCustomers = base?.lastyear_customers
  const lastyearVisitors = base?.lastyear_visitors
  const snapshotDate = base?.snapshot_date

  // ATV計算
  const atv = totalSales && totalCustomers ? Math.round(totalSales / totalCustomers) : null
  const lastyearAtv = lastyearSales && lastyearCustomers ? Math.round(lastyearSales / lastyearCustomers) : (base?.lastyear_atv || null)

  // 目標（予算客数ベース）
  const bc = base?.budget_customers || 0
  const targetVisitors = bc ? Math.round(bc / 0.50) : 0
  const targetAP = targetVisitors ? Math.round(targetVisitors * 0.85) : 0
  const targetSC = targetAP ? Math.round(targetAP * 0.30) : 0
  const targetD3 = targetAP ? Math.round(targetAP * 0.30) : 0

  return (
    <>
      {/* 売上サマリー */}
      {totalSales != null && (
        <div className="card">
          <div className="card-title">💰 売上サマリー{snapshotDate ? `（${new Date(snapshotDate).getMonth()+1}/${new Date(snapshotDate).getDate()}時点）` : ''}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <BigStat label="売上実績" value={`¥${fmt(totalSales)}`} />
            <BigStat label="客数実績" value={`${fmt(totalCustomers)}人`} />
            {budgetSales && <BigStat label="予算" value={`¥${fmt(budgetSales)}`} />}
            {lastyearSales && <BigStat label="前年実績" value={`¥${fmt(lastyearSales)}`} />}
            {base?.budget_customers && <BigStat label="予算客数" value={`${fmt(base.budget_customers)}人`} />}
            {base?.lastyear_customers && <BigStat label="前年客数" value={`${fmt(base.lastyear_customers)}人`} />}
            {budgetSales && <BigStat label="達成率" value={pct(totalSales, budgetSales)} highlight />}
            {lastyearSales && <BigStat label="前年比" value={pct(totalSales, lastyearSales)} highlight />}
          </div>
          {budgetSales && (
            <div style={{ marginTop: 10 }}>
              <ProgressBar value={totalSales} max={budgetSales} label="予算達成" />
            </div>
          )}
        </div>
      )}

      {/* 行動指標サマリー */}
      {sumVisitors > 0 && (
        <div className="card">
          <div className="card-title">👥 行動指標{useMonthly ? '' : '（週次累計）'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {targetVisitors > 0 && (
              <TargetStat label="入店数目標" actual={sumVisitors} target={targetVisitors} unit="人"
                sub={lastyearVisitors ? `前年${lastyearVisitors}人（${pct(sumVisitors, lastyearVisitors)}）` : null}
              />
            )}
            <BigStat label="CVR（目標55%）" value={pct(totalCustomers, sumVisitors)} highlight={totalCustomers / sumVisitors >= 0.55} />
            <TargetStat label={`AP率 ${pct(sumAP, sumVisitors)}（目標85%）`} actual={sumAP} target={targetAP} />
            <TargetStat label={`SC率 ${pct(sumSC, sumAP)}（目標30%）`} actual={sumSC} target={targetSC}
              apAchieved={sumAP >= targetAP} />
            <TargetStat label={`３デモ率 ${pct(sumD3, sumAP)}（目標30%）`} actual={sumD3} target={targetD3}
              apAchieved={sumAP >= targetAP} />
            {atv && <BigStat label="ATV（客単価）" value={`¥${atv.toLocaleString()}`} />}
            {lastyearAtv && atv && (
              <BigStat label={`前年ATV ¥${lastyearAtv.toLocaleString()}`}
                value={`ATV前年比 ${pct(atv, lastyearAtv)}`}
                highlight={atv >= lastyearAtv} />
            )}
          </div>
        </div>
      )}

      {/* 週次内訳 */}
      {weekly.length > 0 && (
        <div className="card">
          <div className="card-title">📅 週次内訳</div>
          {weekly.map(r => (
            <WeekRow key={r.id} r={r} />
          ))}
        </div>
      )}
    </>
  )
}

function WeekCard({ r }) {
  const visitorTarget = r.budget_customers ? Math.round(r.budget_customers / 0.50) : null
  const apTarget = visitorTarget ? Math.round(visitorTarget * 0.85) : null
  const scTarget = apTarget ? Math.round(apTarget * 0.30) : null
  const d3Target = apTarget ? Math.round(apTarget * 0.30) : null
  const atv = r.total_sales && r.total_customers ? Math.round(r.total_sales / r.total_customers) : null
  const lastyearAtv = r.lastyear_sales && r.lastyear_customers ? Math.round(r.lastyear_sales / r.lastyear_customers) : r.lastyear_atv
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
            <BigStat label="売上" value={`¥${fmt(r.total_sales)}`} />
            <BigStat label="客数" value={`${fmt(r.total_customers)}人`} />
            {r.budget_sales && <BigStat label="達成率" value={pct(r.total_sales, r.budget_sales)} highlight />}
            {r.lastyear_sales && <BigStat label="前年比" value={pct(r.total_sales, r.lastyear_sales)} highlight />}
          </div>
        </>
      )}

      {r.store_visitors > 0 && (
        <>
          <div className="card-title">👥 行動指標</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            {visitorTarget
              ? <TargetStat label="入店数目標" actual={r.store_visitors} target={visitorTarget} unit="人"
                  sub={r.lastyear_visitors ? `前年比 ${pct(r.store_visitors, r.lastyear_visitors)}` : null} />
              : <BigStat label="入店数" value={`${r.store_visitors}人`} />
            }
            <BigStat label="CVR（目標55%）" value={pct(r.total_customers, r.store_visitors)} highlight={r.total_customers / r.store_visitors >= 0.55} />
            {apTarget
              ? <TargetStat label={`AP率 ${pct(r.ap_count, r.store_visitors)}（目標85%）`} actual={r.ap_count} target={apTarget} />
              : <BigStat label={`AP率`} value={`${pct(r.ap_count, r.store_visitors)} / ${r.ap_count}件`} />
            }
            {scTarget
              ? <TargetStat label={`SC率 ${pct(r.sc_count, r.ap_count)}（目標30%）`} actual={r.sc_count} target={scTarget} apAchieved={r.ap_count >= apTarget} />
              : <BigStat label="SC率" value={`${pct(r.sc_count, r.ap_count)} / ${r.sc_count}件`} />
            }
            {d3Target
              ? <TargetStat label={`３デモ率 ${pct(r.demo3_count, r.ap_count)}（目標30%）`} actual={r.demo3_count} target={d3Target} apAchieved={r.ap_count >= apTarget} />
              : <BigStat label="３デモ率" value={`${pct(r.demo3_count, r.ap_count)} / ${r.demo3_count}件`} />
            }
            {atv && <BigStat label="ATV" value={`¥${atv.toLocaleString()}`} />}
            {atv && lastyearAtv && <BigStat label="ATVLY" value={pct(atv, lastyearAtv)} highlight={atv >= lastyearAtv} />}
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

function lyColor(actual, base) {
  if (!base) return 'var(--tl)'
  const r = actual / base * 100
  if (r >= 100) return 'var(--ok)'
  if (r >= 80) return 'var(--warn)'
  return 'var(--err)'
}

function rateColor(actual, target) {
  if (!target) return 'var(--tl)'
  const r = actual / target * 100
  if (r >= 100) return 'var(--ok)'
  if (r >= 80) return 'var(--warn)'
  return 'var(--err)'
}

function WeekRow({ r }) {
  const dateLabel = r.start_date && r.end_date
    ? `${new Date(r.start_date).getMonth()+1}/${new Date(r.start_date).getDate()}〜${new Date(r.end_date).getMonth()+1}/${new Date(r.end_date).getDate()}`
    : `第${r.week}週`
  const atv = r.total_sales && r.total_customers ? Math.round(r.total_sales / r.total_customers) : null
  const lastyearAtv = r.lastyear_sales && r.lastyear_customers ? Math.round(r.lastyear_sales / r.lastyear_customers) : r.lastyear_atv

  const apRate = r.ap_count && r.store_visitors ? r.ap_count / r.store_visitors * 100 : null
  const scRate = r.sc_count && r.ap_count ? r.sc_count / r.ap_count * 100 : null

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{dateLabel}</span>
        {r.total_sales != null && (
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--p)' }}>¥{fmt(r.total_sales)}</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        {r.store_visitors != null && r.lastyear_visitors && (
          <Tag label="入店LY" value={pct(r.store_visitors, r.lastyear_visitors)}
            color={lyColor(r.store_visitors, r.lastyear_visitors)} />
        )}
        {apRate != null && (
          <Tag label="AP率" value={pct(r.ap_count, r.store_visitors)}
            color={rateColor(apRate, 85)} />
        )}
        {scRate != null && (
          <Tag label="SC率" value={pct(r.sc_count, r.ap_count)}
            color={rateColor(scRate, 30)} />
        )}
        {r.total_customers != null && r.lastyear_customers && (
          <Tag label="客数LY" value={pct(r.total_customers, r.lastyear_customers)}
            color={lyColor(r.total_customers, r.lastyear_customers)} />
        )}
        {atv && lastyearAtv && (
          <Tag label="ATVLY" value={pct(atv, lastyearAtv)}
            color={lyColor(atv, lastyearAtv)} />
        )}
        {r.budget_sales && (
          <Tag label="達成率" value={pct(r.total_sales, r.budget_sales)}
            color={rateColor(r.total_sales, r.budget_sales)} />
        )}
      </div>
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

function TargetStat({ label, actual, target, unit = '件', apAchieved, sub }) {
  const r = rate(actual, target)
  const achieved = apAchieved !== undefined
    ? apAchieved && actual >= target
    : actual >= target
  return (
    <div style={{ background: achieved ? '#D1FAE5' : 'var(--bg)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--tl)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: achieved ? '#065F46' : 'var(--t)', marginTop: 2 }}>
        {actual ?? '-'}{unit} <span style={{ fontSize: 11, fontWeight: 400 }}>/ 目標{target}{unit} {r ? `(${r}%)` : ''}</span>
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--tl)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function ProgressBar({ value, max, label }) {
  const pct = Math.min((value / max) * 100, 100)
  const color = pct >= 100 ? 'var(--ok)' : pct >= 80 ? 'var(--warn)' : 'var(--err)'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tl)', marginBottom: 4 }}>
        <span>{label}</span><span>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 4, transition: 'width .4s' }} />
      </div>
    </div>
  )
}

function Tag({ label, value, color }) {
  return (
    <span style={{ fontSize: 11, background: 'var(--bg)', borderRadius: 6, padding: '2px 6px', color: color || 'var(--tl)' }}>
      {label}: <strong>{value}</strong>
    </span>
  )
}
