const NAV_ITEMS = [
  { id: 'axis',   icon: '🎯', label: '軸確認' },
  { id: 'input',  icon: '✏️', label: '入力' },
  { id: 'chat',   icon: '💬', label: '分析' },
  { id: 'report', icon: '📄', label: '週報' },
]

export default function BottomNav({ current, onChange }) {
  return (
    <nav className="bnav">
      {NAV_ITEMS.map(({ id, icon, label }) => (
        <button
          key={id}
          className={`ni${current === id ? ' on' : ''}`}
          onClick={() => onChange(id)}
        >
          <span className="ni-icon">{icon}</span>
          <span className="ni-label">{label}</span>
        </button>
      ))}
    </nav>
  )
}
