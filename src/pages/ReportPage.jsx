import { useState, useEffect } from 'react'
import { supabase, getCurrentPeriod } from '../lib/supabase.js'

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

  const bom = '\uFEFF'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `売上データ_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportPage() {
  const { year, month, week } = getCurrentPeriod()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [alert, setAlert] = useState(null)

  useEffect(() => { loadReports() }, [])

  async function loadReports() {
    setLoading(true)
    const { data } = await supabase
      .from('reports')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('week', { ascending: false })
      .limit(10)
    setReports(data ?? [])
    setLoading(false)
  }

  async function generate() {
    setGenerating(true)
    setDraft('')

    const [annualRes, monthlyRes, resultsRes, budgetsRes] = await Promise.all([
      supabase.from('policies').select('content').eq('type', 'annual').eq('year', year)
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('policies').select('content').eq('type', 'monthly').eq('year', year).eq('month', month)
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('results').select('*').eq('year', year).eq('month', month)
        .order('week', { ascending: false }).limit(5),
      supabase.from('budgets').select('*').eq('year', year).eq('month', month),
    ])

    const context = {
      annualPolicy:  annualRes.data?.[0]?.content ?? '',
      monthlyPolicy: monthlyRes.data?.[0]?.content ?? '',
      recentResults: resultsRes.data ?? [],
      budgets:       budgetsRes.data ?? [],
    }

    const prompt = `${year}年${month}月 第${week}週の週報を生成してください。`

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          context,
          mode: 'report',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'API エラー')
      setDraft(data.content)
      setEditing(true)
    } catch (err) {
      setAlert({ type: 'err', msg: '生成に失敗: ' + err.message })
      setTimeout(() => setAlert(null), 4000)
    } finally {
      setGenerating(false)
    }
  }

  async function saveReport() {
    const existing = reports.find(r => r.year === year && r.month === month && r.week === week)
    let err
    if (existing) {
      ;({ error: err } = await supabase.from('reports').update({ content: draft }).eq('id', existing.id))
    } else {
      ;({ error: err } = await supabase.from('reports').insert({ year, month, week, content: draft }))
    }
    if (err) {
      setAlert({ type: 'err', msg: '保存に失敗: ' + err.message })
    } else {
      setAlert({ type: 'ok', msg: '週報を保存しました' })
      setEditing(false)
      loadReports()
    }
    setTimeout(() => setAlert(null), 3000)
  }

  return (
    <div>
      <div className="hd">
        <h1>📄 週報出力</h1>
        <p>{year}年{month}月 第{week}週</p>
      </div>

      <div className="body">
        {alert && (
          <div className={`alert alert-${alert.type}`}>
            {alert.type === 'ok' ? '✅' : '❌'} {alert.msg}
          </div>
        )}

        {/* 生成エリア */}
        <div className="card">
          <div className="card-title">✨ 今週の週報を生成</div>
          {!editing ? (
            <button
              className="btn btn-p btn-full"
              onClick={generate}
              disabled={generating}
            >
              {generating ? (
                <><div className="spin" style={{ width: 16, height: 16, borderWidth: 2 }} /> 生成中...</>
              ) : (
                '🤖 AIで週報を生成する'
              )}
            </button>
          ) : (
            <>
              <div className="fg" style={{ marginBottom: 12 }}>
                <label>週報内容（編集可）</label>
                <textarea
                  className="fi"
                  rows={12}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                />
              </div>
              <div className="row">
                <button className="btn btn-g btn-sm" style={{ flex: 1 }} onClick={() => { setEditing(false); setDraft('') }}>
                  キャンセル
                </button>
                <button className="btn btn-o btn-sm" style={{ flex: 1 }} onClick={generate} disabled={generating}>
                  再生成
                </button>
                <button className="btn btn-p btn-sm" style={{ flex: 1 }} onClick={saveReport}>
                  保存
                </button>
              </div>
            </>
          )}
        </div>

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

        {/* 過去の週報 */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tll)', letterSpacing: '.06em', padding: '4px 0' }}>
          過去の週報
        </div>

        {loading ? (
          <div className="loading"><div className="spin" /> 読み込み中...</div>
        ) : reports.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📭</div>
            <p>まだ週報がありません</p>
          </div>
        ) : (
          reports.map(r => (
            <ReportCard key={r.id} report={r} onEdit={() => { setDraft(r.content); setEditing(true) }} />
          ))
        )}
      </div>
    </div>
  )
}

function ReportCard({ report, onEdit }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card">
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <span className="badge">{report.year}年{report.month}月 第{report.week}週</span>
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
          <button className="btn btn-o btn-sm btn-full" style={{ marginTop: 10 }} onClick={onEdit}>
            編集する
          </button>
        </>
      )}
    </div>
  )
}
