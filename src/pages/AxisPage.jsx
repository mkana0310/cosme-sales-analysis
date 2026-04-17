import { useState, useEffect } from 'react'
import { supabase, getCurrentPeriod } from '../lib/supabase.js'

export default function AxisPage() {
  const { year, month, week } = getCurrentPeriod()
  const [annual, setAnnual] = useState(null)
  const [monthly, setMonthly] = useState(null)
  const [lastMemo, setLastMemo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // { type: 'annual'|'monthly', data }
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [a, m, r] = await Promise.all([
      supabase.from('policies').select('*').eq('type', 'annual').eq('year', year)
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('policies').select('*').eq('type', 'monthly').eq('year', year).eq('month', month)
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('results').select('memo,week,month,year').eq('granularity', 'weekly')
        .order('year', { ascending: false }).order('month', { ascending: false })
        .order('week', { ascending: false }).limit(1),
    ])
    setAnnual(a.data?.[0] ?? null)
    setMonthly(m.data?.[0] ?? null)
    setLastMemo(r.data?.[0] ?? null)
    setLoading(false)
  }

  function openEdit(type, current) {
    setModal({ type, id: current?.id })
    setEditText(current?.content ?? '')
  }

  async function save() {
    setSaving(true)
    const payload = {
      type: modal.type,
      year,
      month: modal.type === 'monthly' ? month : null,
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
      setAlert({ type: 'err', msg: '保存に失敗しました: ' + err.message })
    } else {
      setAlert({ type: 'ok', msg: '保存しました' })
      setModal(null)
      load()
    }
    setTimeout(() => setAlert(null), 3000)
  }

  return (
    <div>
      <div className="hd">
        <h1>🎯 軸確認</h1>
        <p>{year}年{month}月 第{week}週</p>
      </div>

      <div className="body">
        {alert && (
          <div className={`alert alert-${alert.type}`}>
            {alert.type === 'ok' ? '✅' : '❌'} {alert.msg}
          </div>
        )}

        {loading ? (
          <div className="loading"><div className="spin" /> 読み込み中...</div>
        ) : (
          <>
            <PolicyCard
              icon="📋"
              title="年間方針"
              data={annual}
              onEdit={() => openEdit('annual', annual)}
            />
            <PolicyCard
              icon="📅"
              title={`今月の方針（${month}月）`}
              data={monthly}
              onEdit={() => openEdit('monthly', monthly)}
            />
            <div className="card">
              <div className="card-title"><span>📝</span> 先週のメモ</div>
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
              {modal.type === 'annual' ? '年間方針を編集' : `${month}月の方針を編集`}
            </div>
            <div className="fg">
              <label>内容</label>
              <textarea
                className="fi"
                rows={6}
                value={editText}
                onChange={e => setEditText(e.target.value)}
                placeholder="方針を入力してください..."
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-g btn-sm" style={{ flex: 1 }} onClick={() => setModal(null)}>
                キャンセル
              </button>
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
        <div className="card-title" style={{ marginBottom: 0 }}>
          <span>{icon}</span> {title}
        </div>
        <button className="btn btn-o btn-sm" onClick={onEdit}>
          {data ? '編集' : '+ 追加'}
        </button>
      </div>
      {data ? (
        <div className="card-body">{data.content}</div>
      ) : (
        <div className="empty"><p>未設定</p></div>
      )}
    </div>
  )
}
