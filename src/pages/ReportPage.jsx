import { useState, useEffect } from 'react'
import { supabase, getCurrentPeriod } from '../lib/supabase.js'

const { year: CY, month: CM, week: CW } = getCurrentPeriod()

async function exportCSV() {
  const { data } = await supabase.from('results').select('*')
    .order('year', { ascending: true })
    .order('month', { ascending: true })
    .order('week', { ascending: true })

  if (!data?.length) { alert('データがありません'); return }

  const headers = [
    '種別', '年', '月', '週', '開始日', '終了日', '進捗確認日',
    '入店数', 'AP数', 'SC数', '３デモ数',
    '売上合計', '客数', '予算', '前年売上', '予算客数', '前年客数',
    '新規非会員売上', '新規非会員客数', 'メモ'
  ]
  const rows = data.map(r => [
    r.granularity === 'weekly' ? '週次' : '月次',
    r.year, r.month, r.week,
    r.start_date ?? '', r.end_date ?? '', r.snapshot_date ?? '',
    r.store_visitors ?? '', r.ap_count ?? '', r.sc_count ?? '', r.demo3_count ?? '',
    r.total_sales ?? '', r.total_customers ?? '',
    r.budget_sales ?? '', r.lastyear_sales ?? '',
    r.budget_customers ?? '', r.lastyear_customers ?? '',
    r.nonmember_sales ?? '', r.nonmember_customers ?? '',
    r.memo ?? ''
  ])
  const csv = [headers, ...rows].map(row =>
    row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `売上データ_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportPage() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftMeta, setDraftMeta] = useState({ year: CY, month: CM, week: CW, type: 'weekly' })
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)

  useEffect(() => { loadReports() }, [])

  async function loadReports() {
    setLoading(true)
    const { data } = await supabase.from('reports').select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('week', { ascending: false })
      .limit(20)
    setReports(data ?? [])
    setLoading(false)
  }

  function openNew() {
    setDraft('')
    setDraftMeta({ year: CY, month: CM, week: CW, type: 'weekly' })
    setEditing(true)
  }

  function openEdit(r) {
    setDraft(r.content)
    setDraftMeta({ year: r.year, month: r.month, week: r.week, type: r.report_type || 'weekly', id: r.id })
    setEditing(true)
  }

  async function save() {
    if (!draft.trim()) return
    setSaving(true)
    const payload = {
      year: draftMeta.year, month: draftMeta.month, week: draftMeta.week,
      report_type: draftMeta.type, content: draft
    }
    let err
    if (draftMeta.id) {
      ;({ error: err } = await supabase.from('reports').update(payload).eq('id', draftMeta.id))
    } else {
      ;({ error: err } = await supabase.from('reports').insert(payload))
    }
    setSaving(false)
    if (err) {
      setAlert({ type: 'err', msg: '保存に失敗: ' + err.message })
    } else {
      setAlert({ type: 'ok', msg: '保存しました' })
      setEditing(false)
      loadReports()
    }
    setTimeout(() => setAlert(null), 3000)
  }

  return (
    <div>
      <div className="hd">
        <h1>📄 週報・月報</h1>
        <p>記録・CSVエクスポート</p>
      </div>

      <div className="body">
        {alert && (
          <div className={`alert alert-${alert.type}`}>
            {alert.type === 'ok' ? '✅' : '❌'} {alert.msg}
          </div>
        )}

        {/* 新規作成 */}
        {!editing ? (
          <button className="btn btn-p btn-full" onClick={openNew}>
            ✍️ 週報・月報を書く
          </button>
        ) : (
          <div className="card">
            <div className="card-title">✍️ 報告書を書く</div>

            {/* 種別・期間 */}
            <div className="toggle" style={{ marginBottom: 12 }}>
              <button className={`tgl-btn${draftMeta.type === 'weekly' ? ' on' : ''}`}
                onClick={() => setDraftMeta(m => ({ ...m, type: 'weekly' }))}>週報</button>
              <button className={`tgl-btn${draftMeta.type === 'monthly' ? ' on' : ''}`}
                onClick={() => setDraftMeta(m => ({ ...m, type: 'monthly' }))}>月報</button>
            </div>

            <div className="row" style={{ marginBottom: 10 }}>
              <div className="fg">
                <label>年</label>
                <select className="fi" value={draftMeta.year}
                  onChange={e => setDraftMeta(m => ({ ...m, year: Number(e.target.value) }))}>
                  {[CY - 1, CY, CY + 1].map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
              <div className="fg">
                <label>月</label>
                <select className="fi" value={draftMeta.month}
                  onChange={e => setDraftMeta(m => ({ ...m, month: Number(e.target.value) }))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(mo => (
                    <option key={mo} value={mo}>{mo}月</option>
                  ))}
                </select>
              </div>
              {draftMeta.type === 'weekly' && (
                <div className="fg">
                  <label>週</label>
                  <select className="fi" value={draftMeta.week}
                    onChange={e => setDraftMeta(m => ({ ...m, week: Number(e.target.value) }))}>
                    {[1, 2, 3, 4, 5].map(w => <option key={w} value={w}>第{w}週</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="fg" style={{ marginBottom: 12 }}>
              <label>内容</label>
              <textarea className="fi" rows={10} value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={draftMeta.type === 'weekly'
                  ? '今週の実績・気づき・来週の方針など...'
                  : '今月の総括・来月に向けての方針など...'}
              />
            </div>

            <div className="row">
              <button className="btn btn-g btn-sm" style={{ flex: 1 }}
                onClick={() => setEditing(false)}>キャンセル</button>
              <button className="btn btn-p btn-sm" style={{ flex: 1 }}
                onClick={save} disabled={saving || !draft.trim()}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}

        {/* CSVエクスポート */}
        <div className="card">
          <div className="card-title">📊 データエクスポート</div>
          <p style={{ fontSize: 12, color: 'var(--tl)', marginBottom: 10 }}>
            CSVでダウンロードしてClaudeのチャットに貼り付けて分析できます
          </p>
          <button className="btn btn-o btn-full" onClick={exportCSV}>
            ⬇️ CSVダウンロード
          </button>
        </div>

        {/* 過去の報告書 */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tll)', letterSpacing: '.06em', padding: '4px 0' }}>
          保存済みの報告書
        </div>

        {loading ? (
          <div className="loading"><div className="spin" /> 読み込み中...</div>
        ) : reports.length === 0 ? (
          <div className="empty"><div className="empty-icon">📭</div><p>まだ報告書がありません</p></div>
        ) : (
          reports.map(r => <ReportCard key={r.id} report={r} onEdit={() => openEdit(r)} />)
        )}
      </div>
    </div>
  )
}

function ReportCard({ report, onEdit }) {
  const [open, setOpen] = useState(false)
  const label = report.report_type === 'monthly'
    ? `${report.year}年${report.month}月 月報`
    : `${report.year}年${report.month}月 第${report.week}週 週報`
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}>
        <div>
          <span className="badge">{label}</span>
          <div style={{ fontSize: 12, color: 'var(--tl)', marginTop: 4 }}>
            {new Date(report.created_at).toLocaleDateString('ja-JP')}
          </div>
        </div>
        <span style={{ color: 'var(--tll)', fontSize: 18 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <>
          <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
          <div className="report-text">{report.content}</div>
          <button className="btn btn-o btn-sm btn-full" style={{ marginTop: 10 }} onClick={onEdit}>編集する</button>
        </>
      )}
    </div>
  )
}
