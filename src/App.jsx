import { useState } from 'react'
import BottomNav from './components/BottomNav.jsx'
import AxisPage from './pages/AxisPage.jsx'
import DataInputPage from './pages/DataInputPage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import ReportPage from './pages/ReportPage.jsx'

export default function App() {
  const [page, setPage] = useState('axis')

  const pages = {
    axis: <AxisPage />,
    input: <DataInputPage />,
    chat: <ChatPage />,
    report: <ReportPage />,
  }

  return (
    <div className="app">
      <main className="main-content">
        {pages[page]}
      </main>
      <BottomNav current={page} onChange={setPage} />
    </div>
  )
}
