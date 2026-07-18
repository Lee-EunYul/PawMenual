import { useEffect, useState } from 'react'
import {
  HEALTH_LOGS_STORAGE_KEY,
  MEAL_LOGS_STORAGE_KEY,
  TRAINING_LOGS_STORAGE_KEY,
  readJsonStorage,
} from '../lib/storage'

const TYPE_FILTERS = ['전체', '식사', '건강', '훈련']

function normalizeDateFromLog(log) {
  if (log.dateISO) {
    return log.dateISO
  }

  const parts = String(log.date || '').match(/\d+/g)
  if (!parts || parts.length < 3) {
    return ''
  }

  const [year, month, day] = parts
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function RecordsPage() {
  const [mealLogs, setMealLogs] = useState([])
  const [healthLogs, setHealthLogs] = useState([])
  const [trainingLogs, setTrainingLogs] = useState([])
  const [typeFilter, setTypeFilter] = useState('전체')
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => {
    setMealLogs(readJsonStorage(MEAL_LOGS_STORAGE_KEY, []))
    setHealthLogs(readJsonStorage(HEALTH_LOGS_STORAGE_KEY, []))
    setTrainingLogs(readJsonStorage(TRAINING_LOGS_STORAGE_KEY, []))
  }, [])

  const integratedLogs = [
    ...mealLogs.map((log) => ({
      id: `meal-${log.id}`,
      type: '식사',
      date: log.date,
      time: log.time,
      dateISO: normalizeDateFromLog(log),
      title: `${log.reaction}`,
      description: `${log.foodType} 급여 반응`,
    })),
    ...healthLogs.map((log) => ({
      id: `health-${log.id}`,
      type: '건강',
      date: log.date,
      time: log.time,
      dateISO: normalizeDateFromLog(log),
      title: `${log.category} (${log.cautionLevel})`,
      description: log.summary,
    })),
    ...trainingLogs.map((log) => ({
      id: `training-${log.id}`,
      type: '훈련',
      date: log.date,
      time: log.time,
      dateISO: normalizeDateFromLog(log),
      title: `${log.trainingType} ${log.step}단계 · ${log.result}`,
      description: log.nextAction,
    })),
  ]
    .sort((a, b) => (a.id < b.id ? 1 : -1))

  const filteredLogs = integratedLogs.filter((log) => {
    const typeMatched = typeFilter === '전체' || log.type === typeFilter
    const dateMatched = !dateFilter || log.dateISO === dateFilter
    return typeMatched && dateMatched
  })

  return (
    <section>
      <h2 className="section-title">성장 기록</h2>

      <div className="surface-box">
        <p className="feature-eyebrow">기록 필터</p>
        <div className="chip-row">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`chip-button${typeFilter === filter ? ' chip-button-active' : ''}`}
              onClick={() => setTypeFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>

        <p className="section-space-small">유형과 날짜를 함께 선택하면 원하는 기록만 빠르게 볼 수 있어요.</p>

        <label className="form-row section-space-small" htmlFor="record-date-filter">
          날짜 선택
          <input
            id="record-date-filter"
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          />
        </label>

        <button
          type="button"
          className="chip-button section-space-small"
          onClick={() => {
            setTypeFilter('전체')
            setDateFilter('')
          }}
        >
          필터 초기화
        </button>
      </div>

      <div className="card-grid">
        <article className="feature-card">
          <p className="feature-eyebrow">식사</p>
          <h3>{mealLogs.length}건</h3>
          <p>저장해 둔 식사 반응 기록이에요.</p>
        </article>

        <article className="feature-card">
          <p className="feature-eyebrow">건강</p>
          <h3>{healthLogs.length}건</h3>
          <p>저장해 둔 건강 관찰 기록이에요.</p>
        </article>

        <article className="feature-card">
          <p className="feature-eyebrow">훈련</p>
          <h3>{trainingLogs.length}건</h3>
          <p>저장해 둔 훈련 진행 기록이에요.</p>
        </article>
      </div>

      <div className="surface-box section-space">
        <p className="feature-eyebrow">통합 타임라인</p>
        {filteredLogs.length === 0 ? (
          <p className="section-space-small">선택한 조건에 맞는 기록이 아직 없어요.</p>
        ) : (
          <ul className="timeline-list section-space-small">
            {filteredLogs.map((log) => (
              <li key={log.id} className="timeline-item">
                <div className="timeline-meta">
                  <span className="timeline-type">{log.type}</span>
                  <span>
                    {log.date} {log.time}
                  </span>
                </div>
                <p className="timeline-title">{log.title}</p>
                <p>{log.description}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default RecordsPage
