import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'

const headerMap = {
  '/': { title: '강아지 맞춤 케어', subtitle: '오늘의 루틴을 확인해요' },
  '/profile': { title: '강아지 프로필', subtitle: '기본 정보를 차근차근 저장해요' },
  '/care/food': { title: '식생활 가이드', subtitle: '맞춤 사료와 반응을 비교해요' },
  '/care/health': { title: '건강 상황 확인', subtitle: '이상 상황을 정리하고 병원을 찾아요' },
  '/training': { title: '훈련 시스템', subtitle: '결과에 맞춰 다음 방법을 제안해요' },
  '/records': { title: '성장 기록', subtitle: '날짜별 변화를 한눈에 확인해요' },
}

function MainLayout() {
  const { pathname } = useLocation()
  const header = headerMap[pathname] || headerMap['/']

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-brand">PAWMENUAL</p>
          <h1 className="app-title">{header.title}</h1>
          <p className="app-subtitle">{header.subtitle}</p>
        </div>
      </header>

      <main className="app-content">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}

export default MainLayout
