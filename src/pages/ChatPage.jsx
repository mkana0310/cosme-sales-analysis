import { useState, useEffect, useRef } from 'react'
import { supabase, getCurrentPeriod } from '../lib/supabase.js'

const WELCOME = {
  role: 'assistant',
  content: 'こんにちは！売上データと方針をもとに分析・アドバイスします。\n何でも聞いてください 😊',
}

export default function ChatPage() {
  const { year, month, week } = getCurrentPeriod()
  const [messages, setMessages] = useState([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => { loadContext() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadContext() {
    const [annualRes, monthlyRes, resultsRes, budgetsRes] = await Promise.all([
      supabase.from('policies').select('content').eq('type', 'annual').eq('year', year)
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('policies').select('content').eq('type', 'monthly').eq('year', year).eq('month', month)
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('results').select('*').eq('year', year)
        .order('month', { ascending: false }).order('week', { ascending: false }).limit(8),
      supabase.from('budgets').select('*').eq('year', year).eq('month', month),
    ])
    setContext({
      annualPolicy:  annualRes.data?.[0]?.content ?? '',
      monthlyPolicy: monthlyRes.data?.[0]?.content ?? '',
      recentResults: resultsRes.data ?? [],
      budgets:       budgetsRes.data ?? [],
    })
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages.filter(m => m.role !== 'assistant' || messages.indexOf(m) > 0), userMsg]
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Build messages array for API (exclude the welcome message)
    const apiMessages = newMessages
      .filter(m => !(m === WELCOME))
      .map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, context, mode: 'chat' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'API エラー')
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ エラー: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function autoResize(e) {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'
  }

  return (
    <div>
      <div className="hd">
        <h1>💬 チャット分析</h1>
        <p>方針・実績をもとにAIが分析します</p>
      </div>

      <div className="chat-msgs" style={{ paddingTop: 14 }}>
        {!context && (
          <div className="loading"><div className="spin" /> データ読み込み中...</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'ai'}`}>
            <div className="msg-av">{m.role === 'user' ? '👤' : '🤖'}</div>
            <div className="msg-bbl">{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="msg ai">
            <div className="msg-av">🤖</div>
            <div className="msg-bbl" style={{ color: 'var(--tl)' }}>
              <div className="spin" style={{ width: 14, height: 14, borderWidth: 2 }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-foot">
        <textarea
          ref={textareaRef}
          className="chat-in"
          rows={1}
          value={input}
          onChange={e => { setInput(e.target.value); autoResize(e) }}
          onKeyDown={onKeyDown}
          placeholder="メッセージを入力..."
          disabled={loading || !context}
        />
        <button className="chat-send" onClick={send} disabled={loading || !input.trim() || !context}>
          ➤
        </button>
      </div>
    </div>
  )
}
