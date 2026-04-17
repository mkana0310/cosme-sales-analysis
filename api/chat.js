export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { messages, context, mode } = req.body

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY が設定されていません' })
  }

  const systemPrompt = mode === 'report'
    ? buildReportPrompt(context)
    : buildChatPrompt(context)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'API エラー' })
    }

    res.json({ content: data.content[0].text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

function buildChatPrompt(context) {
  const { annualPolicy, monthlyPolicy, recentResults, budgets } = context || {}

  let prompt = `あなたは美容・コスメ販売店の売上分析アシスタントです。
店長の相談に乗り、方針に沿った具体的なアドバイスを日本語で提供してください。
回答は簡潔で実践的にしてください。

## 年間方針
${annualPolicy || '（未設定）'}

## 今月の方針
${monthlyPolicy || '（未設定）'}
`

  if (recentResults?.length) {
    prompt += '\n## 直近の実績データ\n'
    for (const r of recentResults) {
      const sv = r.store_visitors || 0
      const tc = r.total_customers || 0
      const ts = r.total_sales || 0
      const bs = r.budget_sales || 0
      const ls = r.lastyear_sales || 0
      const nms = r.nonmember_sales || 0
      const nmc = r.nonmember_customers || 0
      prompt += `
### ${r.year}年${r.month}月 第${r.week}週（${r.granularity === 'weekly' ? '週次' : '月次'}）
- 入店数: ${sv}人 / AP数: ${r.ap_count ?? '-'} / SC数: ${r.sc_count ?? '-'} / ３デモ数: ${r.demo3_count ?? '-'}
- CVR: ${sv ? ((tc/sv)*100).toFixed(1) : '-'}% / AP率: ${sv ? ((r.ap_count||0)/sv*100).toFixed(1) : '-'}% / SC率: ${sv ? ((r.sc_count||0)/sv*100).toFixed(1) : '-'}%
- 売上: ¥${ts.toLocaleString()} / 客数: ${tc}人
- 予算: ¥${bs.toLocaleString()} → 達成率: ${bs ? ((ts/bs)*100).toFixed(1) : '-'}%
- 前年: ¥${ls.toLocaleString()} → 前年比: ${ls ? ((ts/ls)*100).toFixed(1) : '-'}%
${nmc ? `- 新規・非会員: ¥${nms.toLocaleString()} / ${nmc}人 / 単価: ¥${Math.round(nms/nmc).toLocaleString()}` : ''}
${r.memo ? `- メモ: ${r.memo}` : ''}
`
    }
  }

  if (budgets?.length) {
    prompt += '\n## 予算・前年データ\n'
    for (const b of budgets) {
      prompt += `
### ${b.year}年${b.month}月${b.week ? ` 第${b.week}週` : ''}
- 予算売上: ¥${(b.budget_sales || 0).toLocaleString()} / 前年売上: ¥${(b.lastyear_sales || 0).toLocaleString()}
- 予算客数: ${b.budget_customers ?? '-'}人 / 前年客数: ${b.lastyear_customers ?? '-'}人
`
    }
  }

  prompt += '\n方針と実績を照らし合わせて分析し、改善点や具体的なアクションを提案してください。'
  return prompt
}

function buildReportPrompt(context) {
  const base = buildChatPrompt(context)
  return base + `

## 週報生成の指示
以下の形式で週報を生成してください：

【第X週 週次報告】

■ 今週の実績サマリー
（数値を交えた簡潔な実績報告）

■ 方針への照合
（年間・月次方針に対する達成状況）

■ 課題と来週に向けて
（具体的な改善アクション）

週報として読みやすい、300〜500文字程度の文章にしてください。`
}
