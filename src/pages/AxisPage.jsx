import { useState, useEffect } from 'react'
import { supabase, getCurrentPeriod } from '../lib/supabase.js'

export default function AxisPage() {
  const { year: CY, month: CM, week } = getCurrentPeriod()
  const [viewYear, setViewYear] = useState(CY)
  const [viewMonth, setViewMonth] = useState(CM)
  const [annual, setAnnual] = useState(null)
  const [monthly, setMonthly] = useState(null)
  const [lastMemo, setLastMemo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)

  useEffect(() => { load() }, [viewYear, viewMonth])

  async function load() {
    setLoading(true)
    const [a, m, r] = await Promise.all([
      supabase.from('policies').select('*').eq('type', 'annual').eq('year', viewYear)
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('policies').select('*').eq('type', 'monthly').eq('year', viewYear).eq('month', viewMonth)
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('results').select('memo,week,month,year').eq('granularity', 'weekly')
        .eq('year', viewYear).eq('month', viewMonth)
        .order('week', { ascending: false }).limit(1),
    ])
    setAnnual(a.data?.[0] ?? null)
    setMonthly(m.data?.[0] ?? null)
    setLastMemo(r.data?.[0] ?? null)
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

  function openEdit(type, current) {
    setModal({ type, id: current?.id })
    setEditText(current?.content ?? '')
  }

  async function save() {
    setSaving(true)
    const payload = {
      type: modal.type, year: viewYear,
      month: modal.type === 'monthly' ? viewMonth : null,
      content: editText,
    }
    let err
    if (modal.id) {
      ;({ error: err } = await supabase.from('policies').update(payload).eq('id', modal.id))
    } else {
      ;({ error: err } = await supabase.from('policies').insert(payload))
    }
    setSaving(false)
    if (err) {
      setAlert({ type: 'err', msg: '保存に失敗: ' + err.message })
    } else {
      setAlert({ type: 'ok', msg: '保存しました' })
      setModal(null)
      load()
    }
    setTimeout(() => setAlert(null), 3000)
  }

  const isCurrentPeriod = viewYear === CY && viewMonth === CM

  return (
    <div>
      <div className="hd">
        <h1>🎯 軸確認</h1>
        <p>{isCurrentPeriod ? `現在：${CY}年${CM}月 第${week}週` : `${viewYear}年${viewMonth}月`}</p>
      </div>

      <div className="body">
        {alert && (
          <div className={`alert alert-${alert.type}`}>
            {alert.type === 'ok' ? '✅' : '❌'} {alert.msg}
          </div>
        )}

        {/* 月切り替え */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)', borderRadius: 14, padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
          <button className="btn btn-g btn-sm" onClick={prevMonth}>◀</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{viewYear}年{viewMonth}月</div>
            <div style={{ fontSize: 11, color: 'var(--tl)' }}>
              {viewYear !== CY ? `${CY - viewYear}年前` : viewMonth !== CM ? `${CM > viewMonth ? CM - viewMonth : 12 - viewMonth + CM}ヶ月前` : '今月'}
            </div>
          </div>
          <button className="btn btn-g btn-sm" onClick={nextMonth}>▶</button>
        </div>

        {loading ? (
          <div className="loading"><div className="spin" /> 読み込み中...</div>
        ) : (
          <>
            <PolicyCard icon="📋" title={`${viewYear}年 年間方針`} data={annual} onEdit={() => openEdit('annual', annual)} />
            <PolicyCard icon="📅" title={`${viewMonth}月の方針`} data={monthly} onEdit={() => openEdit('monthly', monthly)} />

            <div className="card">
              <div className="card-title"><span>📝</span> {viewMonth}月の直近メモ</div>
              {lastMemo?.memo ? (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <span className="badge">{lastMemo.year}年{lastMemo.month}月 第{lastMemo.week}週</span>
                  </div>
                  <div className="card-body">{lastMemo.memo}</div>
                </>
              ) : (
                <div className="empty"><p>メモがありません</p></div>
              )}
            </div>
          </>
        )}
      </div>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {modal.type === 'annual' ? `${viewYear}年 年間方針を編集` : `${viewMonth}月の方針を編集`}
            </div>
            <div className="fg">
              <label>内容</label>
              <textarea className="fi" rows={6} value={editText}
                onChange={e => setEditText(e.target.value)}
                placeholder="方針を入力してください..." autoFocus />
            </div>
            <div className="modal-actions">
              <button className="btn btn-g btn-sm" style={{ flex: 1 }} onClick={() => setModal(null)}>キャンセル</button>
              <button className="btn btn-p btn-sm" style={{ flex: 1 }} onClick={save} disabled={saving || !editText.trim()}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PolicyCard({ icon, title, data, onEdit }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div className="card-title" style={{ marginBottom: 0 }}><span>{icon}</span> {title}</div>
        <button className="btn btn-o btn-sm" onClick={onEdit}>{data ? '編集' : '+ 追加'}</button>
      </div>
      {data ? <div className="card-body">{data.content}</div> : <div className="empty"><p>未設定</p></div>}
    </div>
  )
}
