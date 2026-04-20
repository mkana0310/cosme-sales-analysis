import { useState, useEffect } from 'react'
import { supabase, getCurrentPeriod } from '../lib/supabase.js'

const { year: CY, month: CM, week: CW } = getCurrentPeriod()

const EMPTY = {
  year: CY, month: CM, week: CW,
  granularity: 'weekly',
  start_date: '', end_date: '', snapshot_date: '',
  store_visitors: '', ap_count: '', sc_count: '', demo3_count: '',
  total_sales: '', total_customers: '',
  budget_sales: '', lastyear_sales: '',
  budget_customers: '', lastyear_customers: '',
  lastyear_visitors: '', lastyear_atv: '',
  nonmember_sales: '', nonmember_customers: '',
  memo: '',
}

function calc(form) {
  const sv = Number(form.store_visitors) || 0
  const ap = Number(form.ap_count) || 0
  const sc = Number(form.sc_count) || 0
  const d3 = Number(form.demo3_count) || 0
  const tc = Number(form.total_customers) || 0
  const ts = Number(form.total_sales) || 0
  const bs = Number(form.budget_sales) || 0
  const ls = Number(form.lastyear_sales) || 0
  const lc = Number(form.lastyear_customers) || 0
  const lv = Number(form.lastyear_visitors) || 0
  const nms = Number(form.nonmember_sales) || 0
  const nmc = Number(form.nonmember_customers) || 0
  const bc = Number(form.budget_customers) || 0

  // 目標入店数・目標AP数（予算客数ベース）
  const targetVisitors = bc ? Math.round(bc / 0.50) : 0
  const targetAP = targetVisitors ? Math.round(targetVisitors * 0.85) : 0
  const targetSC = targetAP ? Math.round(targetAP * 0.30) : 0
  const targetD3 = targetAP ? Math.round(targetAP * 0.30) : 0

  // ATV
  const atv = tc ? Math.round(ts / tc) : 0
  const lAtv = lc ? Math.round(ls / lc) : 0

  return {
    cvr:      sv ? ((tc / sv) * 100).toFixed(1) + '%' : '-',
    apRate:   sv ? ((ap / sv) * 100).toFixed(1) + '%' : '-',
    scRate:   ap ? ((sc / ap) * 100).toFixed(1) + '%' : '-',
    d3Rate:   ap ? ((d3 / ap) * 100).toFixed(1) + '%' : '-',
    achievement: bs ? ((ts / bs) * 100).toFixed(1) + '%' : '-',
    yoy:      ls ? ((ts / ls) * 100).toFixed(1) + '%' : '-',
    visitorYoy: lv ? ((sv / lv) * 100).toFixed(1) + '%' : '-',
    atv:      atv ? '¥' + atv.toLocaleString() : '-',
    atvYoy:   lAtv ? ((atv / lAtv) * 100).toFixed(1) + '%' : '-',
    lAtv:     lAtv ? '¥' + lAtv.toLocaleString() : '-',
    targetVisitors, targetAP, targetSC, targetD3,
    nonmemberUnitPrice: nmc ? Math.round(nms / nmc).toLocaleString() + '円' : '-',
    existingSales:     (ts && nms !== '') ? (ts - nms).toLocaleString() + '円' : '-',
    existingCustomers: (tc && nmc !== '') ? (tc - nmc) + '人' : '-',
  }
}

function formatDateRange(start, end) {
  if (!start && !end) return ''
  const fmt = d => {
    const dt = new Date(d)
    return `${dt.getMonth() + 1}/${dt.getDate()}`
  }
  if (start && end) return `${fmt(start)}〜${fmt(end)}`
  if (start) return `${fmt(start)}〜`
  return `〜${fmt(end)}`
}

export default function DataInputPage() {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)
  const [existingId, setExistingId] = useState(null)

  useEffect(() => { checkExisting() }, [form.year, form.month, form.week, form.granularity])

  async function checkExisting() {
    const { data } = await supabase
      .from('results').select('*')
      .eq('year', form.year).eq('month', form.month)
      .eq('week', form.week).eq('granularity', form.granularity)
      .limit(1)
    if (data?.[0]) {
      setExistingId(data[0].id)
      const d = data[0]
      setForm(f => ({
        ...f,
        start_date: d.start_date ?? '', end_date: d.end_date ?? '',
        snapshot_date: d.snapshot_date ?? '',
        store_visitors: d.store_visitors ?? '', ap_count: d.ap_count ?? '',
        sc_count: d.sc_count ?? '', demo3_count: d.demo3_count ?? '',
        total_sales: d.total_sales ?? '', total_customers: d.total_customers ?? '',
        budget_sales: d.budget_sales ?? '', lastyear_sales: d.lastyear_sales ?? '',
        budget_customers: d.budget_customers ?? '', lastyear_customers: d.lastyear_customers ?? '',
        lastyear_visitors: d.lastyear_visitors ?? '', lastyear_atv: d.lastyear_atv ?? '',
        nonmember_sales: d.nonmember_sales ?? '', nonmember_customers: d.nonmember_customers ?? '',
        memo: d.memo ?? '',
      }))
    } else {
      setExistingId(null)
      setForm(f => ({ ...EMPTY, year: f.year, month: f.month, week: f.week, granularity: f.granularity }))
    }
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function num(v) { return v === '' ? null : Number(v) }

  async function handleSave() {
    setSaving(true)
    const payload = {
      year: form.year, month: form.month, week: form.week,
      granularity: form.granularity,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      snapshot_date: form.snapshot_date || null,
      store_visitors: num(form.store_visitors), ap_count: num(form.ap_count),
      sc_count: num(form.sc_count), demo3_count: num(form.demo3_count),
      total_sales: num(form.total_sales), total_customers: num(form.total_customers),
      budget_sales: num(form.budget_sales), lastyear_sales: num(form.lastyear_sales),
      budget_customers: num(form.budget_customers), lastyear_customers: num(form.lastyear_customers),
      lastyear_visitors: num(form.lastyear_visitors), lastyear_atv: num(form.lastyear_atv),
      nonmember_sales: num(form.nonmember_sales), nonmember_customers: num(form.nonmember_customers),
      memo: form.memo || null,
    }
    // 保存直前に再度チェックして重複を防ぐ
    let id = existingId
    if (!id) {
      const { data: check } = await supabase.from('results').select('id')
        .eq('year', form.year).eq('month', form.month)
        .eq('week', form.week).eq('granularity', form.granularity)
        .order('created_at', { ascending: false }).limit(1)
      id = check?.[0]?.id ?? null
    }

    let err
    if (id) {
      ;({ error: err } = await supabase.from('results').update(payload).eq('id', id))
    } else {
      ;({ error: err } = await supabase.from('results').insert(payload))
    }
    setSaving(false)
    if (err) {
      setAlert({ type: 'err', msg: '保存に失敗: ' + err.message })
    } else {
      setAlert({ type: 'ok', msg: existingId ? '更新しました' : '保存しました' })
      checkExisting()
    }
    setTimeout(() => setAlert(null), 3000)
  }

  const isWeekly = form.granularity === 'weekly'
  const c = calc(form)
  const dateLabel = isWeekly
    ? formatDateRange(form.start_date, form.end_date)
    : form.snapshot_date ? `${new Date(form.snapshot_date).getMonth()+1}/${new Date(form.snapshot_date).getDate()}時点` : ''

  return (
    <div>
      <div className="hd">
        <h1>✏️ データ入力</h1>
        <p>{dateLabel || '実績を入力してください'}</p>
      </div>

      <div className="body">
        {alert && (
          <div className={`alert alert-${alert.type}`}>
            {alert.type === 'ok' ? '✅' : '❌'} {alert.msg}
          </div>
        )}

        <div className="toggle">
          <button className={`tgl-btn${isWeekly ? ' on' : ''}`} onClick={() => set('granularity', 'weekly')}>週次</button>
          <button className={`tgl-btn${!isWeekly ? ' on' : ''}`} onClick={() => set('granularity', 'monthly')}>月次</button>
        </div>

        {/* 期間 */}
        <div className="card">
          <div className="card-title">📅 期間</div>
          <div className="row">
            <div className="fg">
              <label>年</label>
              <select className="fi" value={form.year} onChange={e => set('year', Number(e.target.value))}>
                {[CY - 1, CY, CY + 1].map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>月</label>
              <select className="fi" value={form.month} onChange={e => set('month', Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
            </div>
            {isWeekly && (
              <div className="fg">
                <label>週</label>
                <select className="fi" value={form.week} onChange={e => set('week', Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map(w => <option key={w} value={w}>第{w}週</option>)}
                </select>
              </div>
            )}
          </div>

          {/* 日付 */}
          {isWeekly ? (
            <div className="row" style={{ marginTop: 4 }}>
              <div className="fg">
                <label>開始日</label>
                <input type="date" className="fi" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
              </div>
              <div className="fg">
                <label>終了日</label>
                <input type="date" className="fi" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="fg" style={{ marginTop: 4 }}>
              <label>進捗確認日</label>
              <input type="date" className="fi" value={form.snapshot_date} onChange={e => set('snapshot_date', e.target.value)} />
            </div>
          )}

          {existingId && <div style={{ marginTop: 8 }}><span className="badge">既存データあり（上書き更新）</span></div>}
        </div>

        {/* 行動指標 */}
        <div className="card">
          <div className="card-title">👥 行動指標</div>
          <div className="row">
            <NumField label="入店数" value={form.store_visitors} onChange={v => set('store_visitors', v)} />
            <NumField label="AP数" value={form.ap_count} onChange={v => set('ap_count', v)} />
          </div>
          <div className="row">
            <NumField label="SC数" value={form.sc_count} onChange={v => set('sc_count', v)} />
            <NumField label="３デモ数" value={form.demo3_count} onChange={v => set('demo3_count', v)} />
          </div>

          {/* 目標と実績比較 */}
          {(Number(form.store_visitors) > 0 || Number(form.budget_customers) > 0) && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tl)', marginBottom: 6 }}>目標 vs 実績</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {c.targetVisitors > 0 && (
                  <RateBox label={`入店数目標（客数予算÷50%）`}
                    value={`実績${form.store_visitors || '-'}人 / 目標${c.targetVisitors}人`}
                    highlight={Number(form.store_visitors) >= c.targetVisitors}
                    sub={Number(form.lastyear_visitors) > 0 ? `前年${form.lastyear_visitors}人（${c.visitorYoy}）` : null}
                  />
                )}
                <RateBox label="CVR（目標55%）" value={c.cvr}
                  highlight={Number(form.total_customers) / Number(form.store_visitors) >= 0.55}
                />
                {c.targetAP > 0 && (
                  <>
                    <RateBox label={`AP率 ${c.apRate}（目標85%）`}
                      value={`実績${form.ap_count || '-'}件 / 目標${c.targetAP}件`}
                      highlight={Number(form.ap_count) >= c.targetAP}
                    />
                    <RateBox label={`SC率 ${c.scRate}（目標30%）`}
                      value={`実績${form.sc_count || '-'}件 / 目標${c.targetSC}件`}
                      highlight={Number(form.ap_count) >= c.targetAP && Number(form.sc_count) >= c.targetSC}
                    />
                    <RateBox label={`３デモ率 ${c.d3Rate}（目標30%）`}
                      value={`実績${form.demo3_count || '-'}件 / 目標${c.targetD3}件`}
                      highlight={Number(form.ap_count) >= c.targetAP && Number(form.demo3_count) >= c.targetD3}
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 売上実績 */}
        <div className="card">
          <div className="card-title">💰 売上実績</div>
          <div className="row">
            <NumField label="売上合計（円）" value={form.total_sales} onChange={v => set('total_sales', v)} />
            <NumField label="客数" value={form.total_customers} onChange={v => set('total_customers', v)} />
          </div>
          <div className="row">
            <NumField label="予算（円）" value={form.budget_sales} onChange={v => set('budget_sales', v)} />
            <NumField label="前年売上（円）" value={form.lastyear_sales} onChange={v => set('lastyear_sales', v)} />
          </div>
          <div className="row">
            <NumField label="予算客数" value={form.budget_customers} onChange={v => set('budget_customers', v)} />
            <NumField label="前年客数" value={form.lastyear_customers} onChange={v => set('lastyear_customers', v)} />
          </div>
          <div className="row" style={{ marginTop: 4 }}>
            <NumField label="前年入店客数" value={form.lastyear_visitors} onChange={v => set('lastyear_visitors', v)} />
            <NumField label="前年ATV（円）" value={form.lastyear_atv} onChange={v => set('lastyear_atv', v)} />
          </div>

          {(Number(form.budget_sales) > 0 || Number(form.lastyear_sales) > 0 || Number(form.total_sales) > 0) && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {form.budget_sales && <RateBox label="達成率" value={c.achievement} highlight />}
              {form.lastyear_sales && <RateBox label="前年比（売上）" value={c.yoy} highlight />}
              {Number(form.total_sales) > 0 && Number(form.total_customers) > 0 && (
                <RateBox label="ATV（客単価）" value={c.atv} />
              )}
              {c.lAtv !== '-' && (
                <RateBox label={`前年ATV ${c.lAtv}`} value={`ATV前年比 ${c.atvYoy}`} highlight={Number(c.atvYoy) >= 100} />
              )}
            </div>
          )}
        </div>

        {/* 新規・非会員 */}
        <div className="card">
          <div className="card-title">🆕 新規・非会員</div>
          <p style={{ fontSize: 11, color: 'var(--tl)', marginBottom: 10 }}>5月〜入力可</p>
          <div className="row">
            <NumField label="売上（円）" value={form.nonmember_sales} onChange={v => set('nonmember_sales', v)} />
            <NumField label="客数" value={form.nonmember_customers} onChange={v => set('nonmember_customers', v)} />
          </div>
          {Number(form.nonmember_customers) > 0 && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <RateBox label="単価" value={c.nonmemberUnitPrice} />
              <RateBox label="既存売上" value={c.existingSales} />
              <RateBox label="既存客数" value={c.existingCustomers} />
            </div>
          )}
        </div>

        {/* メモ（週次のみ） */}
        {isWeekly && (
          <div className="card">
            <div className="card-title">📝 週次メモ</div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <textarea
                className="fi" rows={4} value={form.memo}
                onChange={e => set('memo', e.target.value)}
                placeholder="今週の気づき、来週への引き継ぎなど..."
              />
            </div>
          </div>
        )}

        <button className="btn btn-p btn-full" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : existingId ? '更新する' : '保存する'}
        </button>
      </div>
    </div>
  )
}

function NumField({ label, value, onChange }) {
  return (
    <div className="fg">
      <label>{label}</label>
      <input type="number" className="fi" value={value}
        onChange={e => onChange(e.target.value)} min="0" inputMode="numeric" pattern="[0-9]*" />
    </div>
  )
}

function RateBox({ label, value, highlight, sub }) {
  return (
    <div style={{ background: highlight ? 'var(--pl)' : 'var(--bg)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--tl)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: highlight ? 'var(--p)' : 'var(--t)', marginTop: 2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--tl)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
