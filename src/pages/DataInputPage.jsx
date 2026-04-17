import { useState, useEffect } from 'react'
import { supabase, getCurrentPeriod } from '../lib/supabase.js'

const { year: CY, month: CM, week: CW } = getCurrentPeriod()

const EMPTY = {
  year: CY, month: CM, week: CW,
  granularity: 'weekly',
  store_visitors: '', ap_count: '', sc_count: '', demo_count: '',
  new_purchases: '', new_sales: '',
  existing_purchases: '', existing_sales: '',
  memo: '',
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
      .select('id,store_visitors,ap_count,sc_count,demo_count,new_purchases,new_sales,existing_purchases,existing_sales,memo')
      .eq('year', form.year).eq('month', form.month)
      .eq('week', form.week).eq('granularity', form.granularity)
      .limit(1)
    if (data?.[0]) {
      setExistingId(data[0].id)
      const d = data[0]
      setForm(f => ({
        ...f,
        store_visitors: d.store_visitors ?? '',
        ap_count:       d.ap_count ?? '',
        sc_count:       d.sc_count ?? '',
        demo_count:     d.demo_count ?? '',
        new_purchases:  d.new_purchases ?? '',
        new_sales:      d.new_sales ?? '',
        existing_purchases: d.existing_purchases ?? '',
        existing_sales: d.existing_sales ?? '',
        memo:           d.memo ?? '',
      }))
    } else {
      setExistingId(null)
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
      ap_count:       num(form.ap_count),
      sc_count:       num(form.sc_count),
      demo_count:     num(form.demo_count),
      new_purchases:  num(form.new_purchases),
      new_sales:      num(form.new_sales),
      existing_purchases: num(form.existing_purchases),
      existing_sales: num(form.existing_sales),
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
          <button className={`tgl-btn${isWeekly ? ' on' : ''}`} onClick={() => set('granularity', 'weekly')}>
            週次
          </button>
          <button className={`tgl-btn${!isWeekly ? ' on' : ''}`} onClick={() => set('granularity', 'monthly')}>
            月次
          </button>
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
          {existingId && (
            <div style={{ marginTop: 8 }}>
              <span className="badge">既存データあり（上書き更新）</span>
            </div>
          )}
        </div>

        {/* 来店・行動 */}
        <div className="card">
          <div className="card-title">👥 来店・行動指標</div>
          <div className="row">
            <NumField label="入店数" value={form.store_visitors} onChange={v => set('store_visitors', v)} />
            <NumField label="AP数" value={form.ap_count} onChange={v => set('ap_count', v)} />
          </div>
          <div className="row">
            <NumField label="SC数" value={form.sc_count} onChange={v => set('sc_count', v)} />
            <NumField label="デモ数" value={form.demo_count} onChange={v => set('demo_count', v)} />
          </div>
        </div>

        {/* 売上 */}
        <div className="card">
          <div className="card-title">💰 売上実績</div>
          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--tl)', fontWeight: 600 }}>新規</div>
          <div className="row">
            <NumField label="購入件数" value={form.new_purchases} onChange={v => set('new_purchases', v)} />
            <NumField label="売上（円）" value={form.new_sales} onChange={v => set('new_sales', v)} />
          </div>
          <div style={{ margin: '10px 0 8px', fontSize: 12, color: 'var(--tl)', fontWeight: 600 }}>既存</div>
          <div className="row">
            <NumField label="購入件数" value={form.existing_purchases} onChange={v => set('existing_purchases', v)} />
            <NumField label="売上（円）" value={form.existing_sales} onChange={v => set('existing_sales', v)} />
          </div>

          {/* 合計表示 */}
          {(form.new_sales !== '' || form.existing_sales !== '') && (
            <div style={{ marginTop: 12, padding: '10px', background: 'var(--pl)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--tl)' }}>合計売上</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--p)' }}>
                ¥{((Number(form.new_sales) || 0) + (Number(form.existing_sales) || 0)).toLocaleString()}
              </div>
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
