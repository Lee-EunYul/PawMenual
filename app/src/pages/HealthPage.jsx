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

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const earthRadius = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function fetchNominatimHospitals(lat, lon) {
  const queries = ['동물병원', 'veterinary clinic']
  const deltas = [0.08, 0.2, 0.35, 0.6]
  const collected = []

  for (const delta of deltas) {
    const left = lon - delta
    const right = lon + delta
    const top = lat + delta
    const bottom = lat - delta

    for (const query of queries) {
      const url =
        `https://nominatim.openstreetmap.org/search?` +
        `format=jsonv2&q=${encodeURIComponent(query)}` +
        `&limit=20&bounded=1&viewbox=${left},${top},${right},${bottom}`

      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.7',
        },
      })

      if (!response.ok) {
        continue
      }

      const data = await response.json()
      const hospitals = (Array.isArray(data) ? data : [])
        .map((item) => {
          const latitude = Number(item.lat)
          const longitude = Number(item.lon)

          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null
          }

          const name = item.display_name?.split(',')[0]?.trim() || '이름이 확인되지 않은 동물병원'

          return {
            id: `nominatim-${item.place_id}`,
            name,
            lat: latitude,
            lon: longitude,
            distanceKm: getDistanceKm(lat, lon, latitude, longitude),
            mapUrl: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`,
          }
        })
        .filter(Boolean)

      collected.push(...hospitals)
    }

    if (collected.length > 0) {
      break
    }
  }

  const uniqueHospitals = Array.from(
    new Map(
      collected.map((item) => [
        `${item.name}-${item.lat.toFixed(6)}-${item.lon.toFixed(6)}`,
        item,
      ]),
    ).values(),
  )

  return uniqueHospitals.sort((a, b) => a.distanceKm - b.distanceKm)
}

async function fetchNearbyVeterinaries(lat, lon) {
  const hospitals = await fetchNominatimHospitals(lat, lon)

  if (hospitals.length === 0) {
    throw new Error('실시간 병원 조회 결과가 없어요.')
  }

  return hospitals.slice(0, 7)
}

function HealthPage() {
  const [profile, setProfile] = useState(null)
  const [careChecklist, setCareChecklist] = useState({})
  const [selectedSymptom, setSelectedSymptom] = useState('')
  const [selectedChecks, setSelectedChecks] = useState([])
  const [hospitals, setHospitals] = useState([])
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
    if (!navigator.geolocation) {
      setMessage('이 브라우저에서는 위치 기능을 지원하지 않아요.')
      setIsError(true)
      return
    }

    setIsLoadingHospitals(true)
    setMessage('위치를 확인하고 있어요...')
    setIsError(false)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords

        try {
          const nearby = await fetchNearbyVeterinaries(latitude, longitude)
          setHospitals(nearby)
          setMessage(`주변 동물병원 ${nearby.length}곳을 찾았어요.`)
          setIsError(false)
        } catch {
          setHospitals([])
          setMessage('주변 동물병원 정보를 찾지 못했어요. 위치를 다시 확인한 뒤 재시도해 주세요.')
          setIsError(true)
        } finally {
          setIsLoadingHospitals(false)
        }
      },
      () => {
        setMessage('위치 권한이 필요해요. 브라우저에서 위치를 허용한 뒤 다시 시도해 주세요.')
        setIsError(true)
        setIsLoadingHospitals(false)
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
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
        <button
          type="button"
          className="primary-button"
          onClick={handleFindHospitals}
          disabled={isLoadingHospitals}
        >
          {isLoadingHospitals ? '주변 병원 검색 중...' : '주변 동물병원 찾기'}
        </button>

        {hospitals.length > 0 ? (
          <ul className="plain-list hospital-list">
            {hospitals.map((hospital) => (
              <li key={hospital.id}>
                <strong>{hospital.name}</strong>
                <p>{hospital.distanceKm.toFixed(1)}km</p>
                <a href={hospital.mapUrl} target="_blank" rel="noreferrer">
                  지도 보기
                </a>
              </li>
            ))}
          </ul>
        ) : null}
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
