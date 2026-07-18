import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import pawIcon from '../assets/paw.svg'
import {
  HEALTH_LOGS_STORAGE_KEY,
  MEAL_LOGS_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  TRAINING_LOGS_STORAGE_KEY,
  readJsonStorage,
} from '../lib/storage'

function HomePage() {
  const [latestMeal, setLatestMeal] = useState(null)
  const [profileName, setProfileName] = useState('우리 강아지')
  const [summary, setSummary] = useState({ meal: 0, health: 0, training: 0 })

  useEffect(() => {
    const mealLogs = readJsonStorage(MEAL_LOGS_STORAGE_KEY, [])
    const healthLogs = readJsonStorage(HEALTH_LOGS_STORAGE_KEY, [])
    const trainingLogs = readJsonStorage(TRAINING_LOGS_STORAGE_KEY, [])
    const profile = readJsonStorage(PROFILE_STORAGE_KEY, null)

    setLatestMeal(mealLogs[0] || null)
    setSummary({
      meal: mealLogs.length,
      health: healthLogs.length,
      training: trainingLogs.length,
    })
    if (profile?.name) {
      setProfileName(profile.name)
    }
  }, [])

  return (
    <section>
      <h2 className="section-title">오늘의 케어</h2>

      <div className="surface-box hero-panel">
        <p className="feature-eyebrow">환영해요</p>
        <h3>{profileName}의 오늘 루틴, 시작해볼까요?</h3>
        <p>기록을 남길수록 추천 정확도가 높아져요.</p>
      </div>

      <div className="summary-grid section-space">
        <article className="surface-box summary-card">
          <p className="feature-eyebrow">식사</p>
          <h3>{summary.meal}건</h3>
        </article>
        <article className="surface-box summary-card">
          <p className="feature-eyebrow">건강</p>
          <h3>{summary.health}건</h3>
        </article>
        <article className="surface-box summary-card">
          <p className="feature-eyebrow">훈련</p>
          <h3>{summary.training}건</h3>
        </article>
      </div>

      <Link className="surface-box profile-entry-card section-space" to="/profile">
        <div className="profile-entry-head">
          <p className="feature-eyebrow">프로필</p>
          <img className="paw-icon-image" src={pawIcon} alt="발바닥 아이콘" />
        </div>
        <h3>강아지 정보를 먼저 등록해요</h3>
        <p>처음 1번만 입력하면 식생활/건강/훈련 화면에 맞춤 정보가 연결돼요.</p>
      </Link>

      <div className="card-grid">
        <Link className="feature-card" to="/care/food">
          <p className="feature-eyebrow">식생활</p>
          <h3>강아지 맞춤형 사료 추천</h3>
          <p>프로필 기반으로 건식/습식/혼합 급여 가이드를 확인해요.</p>
        </Link>

        <Link className="feature-card" to="/care/health">
          <p className="feature-eyebrow">건강</p>
          <h3>이상 상황 확인 + 동물병원 안내</h3>
          <p>증상을 선택하고 주변 동물병원을 찾아볼 수 있어요.</p>
        </Link>

        <Link className="feature-card" to="/training">
          <p className="feature-eyebrow">훈련</p>
          <h3>반응형 맞춤 훈련</h3>
          <p>훈련 결과에 맞춰 다음 단계나 다른 방법을 안내해요.</p>
        </Link>
      </div>

      <div className="surface-box section-space">
        <p className="feature-eyebrow">최근 식사 반응</p>
        {latestMeal ? (
          <>
            <h3>{latestMeal.reaction}</h3>
            <p>
              {latestMeal.date} {latestMeal.time} · {latestMeal.foodType}
            </p>
          </>
        ) : (
          <p className="section-space-small">아직 반응 기록이 없어요. 식생활 가이드에서 저장해 보세요.</p>
        )}
      </div>
    </section>
  )
}

export default HomePage
