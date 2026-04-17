import { useState } from 'react'
import BottomNav from './components/BottomNav.jsx'
import AxisPage from './pages/AxisPage.jsx'
import DataInputPage from './pages/DataInputPage.jsx'
import DataViewPage from './pages/DataViewPage.jsx'
import ReportPage from './pages/ReportPage.jsx'

export default function App() {
  const [page, setPage] = useState('axis')

  const pages = {
    axis:   <AxisPage />,
    input:  <DataInputPage />,
    view:   <DataViewPage />,
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
