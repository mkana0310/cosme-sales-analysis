import { useState, useEffect } from 'react'
import { supabase, getCurrentPeriod } from '../lib/supabase.js'

const { year: CY, month: CM, week: CW } = getCurrentPeriod()

const EMPTY = {
  year: CY, month: CM, week: CW,
  granularity: 'weekly',
  store_visitors: '', ap_count: '', sc_count: '', demo3_count: '',
  total_sales: '', total_customers: '',
  budget_sales: '', lastyear_sales: '',
  budget_customers: '', lastyear_customers: '',
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
  const nms = Number(form.nonmember_sales) || 0
  const nmc = Number(form.nonmember_customers) || 0

  return {
    cvr:      sv ? ((tc / sv) * 100).toFixed(1) + '%' : '-',
    apRate:   sv ? ((ap / sv) * 100).toFixed(1) + '%' : '-',
    scRate:   sv ? ((sc / sv) * 100).toFixed(1) + '%' : '-',
    d3Rate:   sv ? ((d3 / sv) * 100).toFixed(1) + '%' : '-',
    achievement: bs ? ((ts / bs) * 100).toFixed(1) + '%' : '-',
    yoy:      ls ? ((ts / ls) * 100).toFixed(1) + '%' : '-',
    nonmemberUnitPrice: nmc ? Math.round(nms / nmc).toLocaleString() + '円' : '-',
    existingSales:    ts && nms ? (ts - nms).toLocaleString() + '円' : '-',
    existingCustomers: tc && nmc ? (tc - nmc) + '人' : '-',
  }
}

export default function DataInputPage() {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)
  const [existingId, setExistingId] = useState(null)

  useEffect(() => { checkExisting() }, [form.year, form.month, form.week, form.granularity])

  async function checkExisting() {
    const { data } = await supabase
      .from('results')
      .select('*')
      .eq('year', form.year).eq('month', form.month)
      .eq('week', form.week).eq('granularity', form.granularity)
      .limit(1)
    if (data?.[0]) {
      setExistingId(data[0].id)
      const d = data[0]
      setForm(f => ({
        ...f,
        store_visitors: d.store_visitors ?? '',
        ap_count: d.ap_count ?? '',
        sc_count: d.sc_count ?? '',
        demo3_count: d.demo3_count ?? '',
        total_sales: d.total_sales ?? '',
        total_customers: d.total_customers ?? '',
        budget_sales: d.budget_sales ?? '',
        lastyear_sales: d.lastyear_sales ?? '',
        budget_customers: d.budget_customers ?? '',
        lastyear_customers: d.lastyear_customers ?? '',
        nonmember_sales: d.nonmember_sales ?? '',
        nonmember_customers: d.nonmember_customers ?? '',
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
      store_visitors: num(form.store_visitors),
      ap_count: num(form.ap_count),
      sc_count: num(form.sc_count),
      demo3_count: num(form.demo3_count),
      total_sales: num(form.total_sales),
      total_customers: num(form.total_customers),
      budget_sales: num(form.budget_sales),
      lastyear_sales: num(form.lastyear_sales),
      budget_customers: num(form.budget_customers),
      lastyear_customers: num(form.lastyear_customers),
      nonmember_sales: num(form.nonmember_sales),
      nonmember_customers: num(form.nonmember_customers),
      memo: form.memo || null,
    }
    let err
    if (existingId) {
      ;({ error: err } = await supabase.from('results').update(payload).eq('id', existingId))
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

  return (
    <div>
      <div className="hd">
        <h1>✏️ データ入力</h1>
        <p>実績を入力してください</p>
      </div>

      <div className="body">
        {alert && (
          <div className={`alert alert-${alert.type}`}>
            {alert.type === 'ok' ? '✅' : '❌'} {alert.msg}
          </div>
        )}

        {/* 粒度選択 */}
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

          {/* 自動計算 */}
          {Number(form.store_visitors) > 0 && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <RateBox label="CVR" value={c.cvr} />
              <RateBox label="AP率" value={c.apRate} />
              <RateBox label="SC率" value={c.scRate} />
              <RateBox label="３デモ率" value={c.d3Rate} />
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

          {/* 自動計算 */}
          {(Number(form.total_sales) > 0 || Number(form.budget_sales) > 0) && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {form.budget_sales && <RateBox label="達成率" value={c.achievement} highlight />}
              {form.lastyear_sales && <RateBox label="前年比" value={c.yoy} highlight />}
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

          {/* 自動計算 */}
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
                className="fi"
                rows={4}
                value={form.memo}
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
      <input
        type="number"
        className="fi"
        value={value}
        onChange={e => onChange(e.target.value)}
        min="0"
        inputMode="numeric"
        pattern="[0-9]*"
      />
    </div>
  )
}

function RateBox({ label, value, highlight }) {
  return (
    <div style={{
      background: highlight ? 'var(--pl)' : 'var(--bg)',
      borderRadius: 8, padding: '8px 10px'
    }}>
      <div style={{ fontSize: 10, color: 'var(--tl)' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: highlight ? 'var(--p)' : 'var(--t)', marginTop: 2 }}>
        {value}
      </div>
    </div>
  )
}
