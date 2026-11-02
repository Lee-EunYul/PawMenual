import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  CARE_CHECKLIST_STORAGE_KEY,
  CARE_LOGS_STORAGE_KEY,
  CARE_REMINDER_LOG_STORAGE_KEY,
  HEALTH_LOGS_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  readJsonStorage,
  writeJsonStorage,
} from '../lib/storage'
import {
  buildCareSchedule,
  getCareStatus,
  getDateDiffDays,
  getUpcomingReminders,
} from '../lib/careSchedule'

const SYMPTOMS = ['노란색 구토', '식욕 저하', '배변 변화', '활동량 감소', '기타']

const CHECK_OPTIONS = [
  '한 번 발생함',
  '반복해서 발생함',
  '식사 전 발생함',
  '식사 후 발생함',
  '평소와 비슷하게 활동함',
  '평소보다 활동이 줄어듦',
  '다른 이상 징후도 함께 관찰됨',
]

function getCautionLevel(checks) {
  const hasRepeat = checks.includes('반복해서 발생함')
  const hasLowActivity = checks.includes('평소보다 활동이 줄어듦')
  const hasOtherSymptoms = checks.includes('다른 이상 징후도 함께 관찰됨')

  if (hasRepeat || hasLowActivity || hasOtherSymptoms) {
    return '주의'
  }

  return '관찰'
}

function getSummary(symptom, checks) {
  if (!symptom) {
    return '상황을 선택하면 요약을 바로 보여드려요.'
  }

  if (checks.length === 0) {
    return `${symptom} 상황이 관찰됐어요. 세부 항목을 고르면 더 정확하게 정리해 드려요.`
  }

  return `${symptom} 상황에서 ${checks.join(', ')} 항목이 확인됐어요.`
}

function getReminderText(diffDays) {
  if (diffDays < 0) {
    return `${Math.abs(diffDays)}일 지났어요.`
  }

  if (diffDays === 0) {
    return '오늘 일정이에요.'
  }

  return `${diffDays}일 남았어요.`
}

function getStatusClassName(status) {
  if (status === '완료') {
    return 'care-status-done'
  }

  if (status === '임박') {
    return 'care-status-urgent'
  }

  if (status === '지남') {
    return 'care-status-overdue'
  }

  return 'care-status-upcoming'
}

function HealthPage() {
  const [profile, setProfile] = useState(null)
  const [careChecklist, setCareChecklist] = useState({})
  const [selectedSymptom, setSelectedSymptom] = useState('')
  const [selectedChecks, setSelectedChecks] = useState([])
  const [hospitals, setHospitals] = useState([])
  const [searchRadius, setSearchRadius] = useState(5000)
  const [locationAccuracy, setLocationAccuracy] = useState(null)
  const [hospitalMessage, setHospitalMessage] = useState('')
  const [hospitalError, setHospitalError] = useState(false)
  const [isLoadingHospitals, setIsLoadingHospitals] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    setProfile(readJsonStorage(PROFILE_STORAGE_KEY, null))
    setCareChecklist(readJsonStorage(CARE_CHECKLIST_STORAGE_KEY, {}))
  }, [])

  const careItems = useMemo(() => {
    if (!profile?.ageMonths && profile?.ageMonths !== 0) {
      return []
    }

    return buildCareSchedule(profile)
  }, [profile])

  const reminders = useMemo(
    () => getUpcomingReminders(careItems, careChecklist, 14),
    [careItems, careChecklist],
  )

  const visibleChecklist = useMemo(() => {
    return careItems
      .filter((item) => {
        const diffDays = getDateDiffDays(item.dueDateISO)
        return diffDays >= -45 && diffDays <= 90
      })
      .slice(0, 20)
  }, [careItems])

  const careSummary = useMemo(() => {
    const total = visibleChecklist.length
    const done = visibleChecklist.filter((item) => careChecklist[item.id]).length
    return { total, done, pending: Math.max(0, total - done) }
  }, [careChecklist, visibleChecklist])

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }

    if (Notification.permission !== 'granted') {
      return
    }

    const todayISO = new Date().toISOString().slice(0, 10)
    const reminderLog = readJsonStorage(CARE_REMINDER_LOG_STORAGE_KEY, {})
    const targets = reminders.filter((item) => item.diffDays >= 0 && item.diffDays <= 3).slice(0, 2)
    let hasUpdates = false

    targets.forEach((item) => {
      if (reminderLog[item.id] === todayISO) {
        return
      }

      new Notification('PAWMENUAL 케어 알림', {
        body: `${item.title} · ${getReminderText(item.diffDays)}`,
      })
      reminderLog[item.id] = todayISO
      hasUpdates = true
    })

    if (hasUpdates) {
      writeJsonStorage(CARE_REMINDER_LOG_STORAGE_KEY, reminderLog)
    }
  }, [reminders])

  const summary = useMemo(
    () => getSummary(selectedSymptom, selectedChecks),
    [selectedChecks, selectedSymptom],
  )
  const cautionLevel = useMemo(() => getCautionLevel(selectedChecks), [selectedChecks])

  const toggleCheck = (check) => {
    setSelectedChecks((prev) =>
      prev.includes(check) ? prev.filter((item) => item !== check) : [...prev, check],
    )
  }

  const handleFindHospitals = () => {
    setHospitals([])
    setLocationAccuracy(null)
    if (!navigator.geolocation) {
      setHospitalMessage('이 브라우저에서는 위치 기능을 지원하지 않아요.')
      setHospitalError(true)
      return
    }

    setIsLoadingHospitals(true)
    setHospitalMessage('현재 위치를 확인하고 있어요...')
    setHospitalError(false)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setLocationAccuracy(accuracy)
        setHospitalMessage('현재 위치 주변 동물병원을 검색하고 있어요...')
        try {
          const response = await fetch('/api/nearby-hospitals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude, longitude, radius: searchRadius }),
            signal: AbortSignal.timeout(15000),
          })
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || '병원 검색을 완료하지 못했어요.')
          setHospitals(data.hospitals)
          setHospitalMessage(data.hospitals.length
            ? `현재 위치 반경 ${searchRadius / 1000}km에서 ${data.hospitals.length}곳을 가까운 순으로 찾았어요.${data.hasMore ? ' 검색 서비스의 결과 제한으로 일부만 표시돼요.' : ''}`
            : `반경 ${searchRadius / 1000}km 내 등록된 동물병원이 검색되지 않았어요. 반경을 넓혀 다시 검색해 주세요.`)
        } catch (error) {
          setHospitalMessage(error instanceof SyntaxError || error.name === 'TypeError' || error.name === 'TimeoutError'
            ? '병원 검색 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' : error.message)
          setHospitalError(true)
        } finally {
          setIsLoadingHospitals(false)
        }
      },
      (error) => {
        setHospitalMessage(error.code === 1
          ? '위치 접근이 차단됐어요. 브라우저 사이트 설정에서 위치를 허용해 주세요.'
          : error.code === 3 ? '위치 확인 시간이 초과됐어요. 기기의 위치 서비스를 켜고 다시 시도해 주세요.'
            : '현재 위치를 확인하지 못했어요. 기기의 위치 서비스와 네트워크를 확인해 주세요.')
        setHospitalError(true)
        setIsLoadingHospitals(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const handleSaveLog = () => {
    if (!selectedSymptom) {
      setMessage('먼저 어떤 상황인지 선택해 주세요.')
      setIsError(true)
      return
    }

    const now = new Date()
    const newLog = {
      id: now.getTime(),
      dateISO: now.toISOString().slice(0, 10),
      date: now.toLocaleDateString('ko-KR'),
      time: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      category: selectedSymptom,
      checks: selectedChecks,
      summary,
      cautionLevel,
      nearbyHospitals: hospitals.slice(0, 3),
    }

    const prevLogs = readJsonStorage(HEALTH_LOGS_STORAGE_KEY, [])
    writeJsonStorage(HEALTH_LOGS_STORAGE_KEY, [newLog, ...prevLogs])

    setMessage('건강 관찰 기록을 저장했어요! 성장 기록 화면에서 확인해 보세요.')
    setIsError(false)
  }

  const handleToggleCareComplete = (item) => {
    const now = new Date()

    setCareChecklist((prev) => {
      const next = { ...prev }

      if (next[item.id]) {
        delete next[item.id]
      } else {
        next[item.id] = {
          checkedAt: now.toISOString(),
          checkedDate: now.toLocaleDateString('ko-KR'),
        }

        const prevCareLogs = readJsonStorage(CARE_LOGS_STORAGE_KEY, [])
        const newCareLog = {
          id: now.getTime(),
          dateISO: now.toISOString().slice(0, 10),
          date: now.toLocaleDateString('ko-KR'),
          time: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          title: item.title,
          category: item.category,
          dueDateISO: item.dueDateISO,
        }

        writeJsonStorage(CARE_LOGS_STORAGE_KEY, [newCareLog, ...prevCareLogs])
      }

      writeJsonStorage(CARE_CHECKLIST_STORAGE_KEY, next)
      return next
    })
  }

  const handleEnableNotification = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setMessage('이 브라우저에서는 알림 기능을 지원하지 않아요.')
      setIsError(true)
      return
    }

    const permission = await Notification.requestPermission()

    if (permission === 'granted') {
      setMessage('브라우저 알림을 켰어요. 일정이 가까워지면 알려드릴게요.')
      setIsError(false)
      return
    }

    setMessage('알림 권한이 허용되지 않아 앱 내부 안내로만 알려드릴게요.')
    setIsError(true)
  }

  return (
    <section>
      <h2 className="section-title">건강 상황 확인</h2>

      <div className="surface-box recommendation-box">
        <p className="feature-eyebrow">예방접종 · 건강 일정</p>
        {profile?.name ? (
          <>
            <h3>{profile.name} 맞춤 일정이 자동 생성됐어요</h3>
            <p>
              현재 나이 {Number(profile.ageMonths || 0)}개월 기준으로 예방접종, 심장사상충, 구충 일정을
              정리했어요.
            </p>
          </>
        ) : (
          <>
            <h3>프로필을 먼저 등록해 주세요</h3>
            <p>나이 정보를 기반으로 일정이 자동 생성돼요.</p>
            <Link className="chip-button section-space-small" to="/profile">
              프로필 등록하러 가기
            </Link>
          </>
        )}
      </div>

      {profile?.name ? (
        <>
          <div className="surface-box section-space">
            <p className="feature-eyebrow">다가오는 일정 알림</p>
            <p className="section-space-small">
              체크리스트 {careSummary.done}/{careSummary.total} 완료 · 남은 일정 {careSummary.pending}개
            </p>
            {reminders.length === 0 ? (
              <p className="section-space-small">14일 이내 예정된 일정이 없어요.</p>
            ) : (
              <ul className="plain-list section-space-small care-reminder-list">
                {reminders.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <p>
                      {item.dueDateLabel} · {getReminderText(item.diffDays)}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <button type="button" className="chip-button section-space-small" onClick={handleEnableNotification}>
              브라우저 알림 켜기
            </button>
          </div>

          <div className="surface-box section-space">
            <p className="feature-eyebrow">예방접종/구충 체크리스트</p>
            {visibleChecklist.length === 0 ? (
              <p className="section-space-small">프로필 나이를 저장하면 체크리스트가 보여요.</p>
            ) : (
              <ul className="plain-list care-checklist section-space-small">
                {visibleChecklist.map((item) => {
                  const status = getCareStatus(item, careChecklist)
                  const doneInfo = careChecklist[item.id]

                  return (
                    <li key={item.id} className="care-check-item">
                      <div>
                        <div className="care-item-head">
                          <strong>{item.title}</strong>
                          <span className={`care-status-badge ${getStatusClassName(status)}`}>{status}</span>
                        </div>
                        <p>
                          {item.category} · {item.dueDateLabel} · {item.dueAgeMonths}개월차
                        </p>
                        <p>{item.note}</p>
                        {doneInfo ? <p>완료일: {doneInfo.checkedDate}</p> : null}
                      </div>

                      <button
                        type="button"
                        className={`chip-button ${doneInfo ? 'chip-button-active' : ''}`}
                        onClick={() => handleToggleCareComplete(item)}
                      >
                        {doneInfo ? '완료 취소' : '완료 체크'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      ) : null}

      <div className="surface-box">
        <p className="feature-eyebrow">어떤 상황을 발견했나요?</p>
        <div className="symptom-grid">
          {SYMPTOMS.map((symptom) => (
            <button
              key={symptom}
              type="button"
              className={`symptom-button${selectedSymptom === symptom ? ' symptom-button-active' : ''}`}
              onClick={() => setSelectedSymptom(symptom)}
            >
              {symptom}
            </button>
          ))}
        </div>
      </div>

      <div className="surface-box section-space">
        <p className="feature-eyebrow">세부 체크 항목</p>
        <div className="chip-row">
          {CHECK_OPTIONS.map((check) => (
            <button
              key={check}
              type="button"
              className={`chip-button${selectedChecks.includes(check) ? ' chip-button-active' : ''}`}
              onClick={() => toggleCheck(check)}
            >
              {check}
            </button>
          ))}
        </div>
      </div>

      <div className="surface-box section-space">
        <p className="feature-eyebrow">건강 요약</p>
        <p className="section-space-small">{summary}</p>
        <p className="section-space-small">현재 안내 단계: {cautionLevel}</p>
      </div>

      <div className="surface-box warning-box section-space">
        <p>이 기능은 진단이 아니에요. 걱정되는 증상이 반복되면 수의사 상담을 받아 주세요.</p>
      </div>

      <div className="surface-box section-space">
        <p className="feature-eyebrow">내 주변 동물병원</p>
        <label className="form-row section-space-small" htmlFor="hospital-radius">
          검색 반경
          <select id="hospital-radius" value={searchRadius} disabled={isLoadingHospitals} onChange={(event) => {
            setSearchRadius(Number(event.target.value))
            setHospitals([])
            setHospitalMessage('')
            setLocationAccuracy(null)
          }}>
            {[3000, 5000, 10000, 20000].map(radius => <option key={radius} value={radius}>{radius / 1000}km</option>)}
          </select>
        </label>
        <p className="section-space-small">검색 시 현재 좌표를 병원 검색 서버와 카카오맵에 전달해요.</p>
        <button
          type="button"
          className="primary-button"
          onClick={handleFindHospitals}
          disabled={isLoadingHospitals}
        >
          {isLoadingHospitals ? '위치 확인 및 병원 검색 중...' : '현재 위치로 주변 병원 찾기'}
        </button>

        {hospitalMessage ? <p role={hospitalError ? 'alert' : 'status'} className={`form-message section-space-small ${hospitalError ? 'form-error' : 'form-success'}`}>{hospitalMessage}</p> : null}
        {Number.isFinite(locationAccuracy) ? <p className="section-space-small">위치 오차 약 {Math.round(locationAccuracy)}m · 거리는 직선거리 기준{locationAccuracy > 1000 ? ' · 위치 오차가 커서 실제 주변과 다를 수 있어요.' : ''}</p> : null}
        <ul className="plain-list hospital-list">
          {hospitals.map(hospital => <li key={hospital.id}>
            <strong>{hospital.name}</strong>
            <p>{hospital.distanceMeters < 1000 ? `${hospital.distanceMeters}m` : `${hospital.distanceKm.toFixed(1)}km`}</p>
            <p>{hospital.address}</p>
            {hospital.phone ? <p>전화: {hospital.phone}</p> : null}
            <a href={hospital.mapUrl} target="_blank" rel="noreferrer">카카오맵에서 병원 상세 보기</a>
          </li>)}
        </ul>
        <p className="section-space-small">카카오맵 등록 정보 기준으로 최대 45곳까지 조회해요. 모든 병원이나 현재 진료 여부를 보장하지 않으므로 방문 전 병원에 확인해 주세요.</p>
      </div>

      <div className="surface-box section-space">
        <button type="button" className="primary-button" onClick={handleSaveLog}>
          건강 기록 저장하기
        </button>
      </div>

      {message ? (
        <p className={`form-message section-space ${isError ? ' form-error' : ' form-success'}`}>
          {message}
        </p>
      ) : null}
    </section>
  )
}

export default HealthPage
