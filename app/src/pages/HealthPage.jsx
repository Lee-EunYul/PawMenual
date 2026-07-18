import { useMemo, useState } from 'react'
import {
  HEALTH_LOGS_STORAGE_KEY,
  readJsonStorage,
  writeJsonStorage,
} from '../lib/storage'

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

async function fetchOverpassHospitals({ endpoint, lat, lon, radius }) {
  const query = `[out:json][timeout:20];(node["amenity"="veterinary"](around:${radius},${lat},${lon});way["amenity"="veterinary"](around:${radius},${lat},${lon});relation["amenity"="veterinary"](around:${radius},${lat},${lon}););out center 50;`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error('병원 정보를 불러오지 못했어요.')
    }

    const data = await response.json()
    return data.elements || []
  } finally {
    clearTimeout(timeoutId)
  }
}

function normalizeHospitals(elements, originLat, originLon) {
  return elements
    .map((element) => {
      const latitude = element.lat ?? element.center?.lat
      const longitude = element.lon ?? element.center?.lon

      if (!latitude || !longitude) {
        return null
      }

      const name = element.tags?.name || '이름이 확인되지 않은 동물병원'

      return {
        id: `${element.type}-${element.id}`,
        name,
        lat: latitude,
        lon: longitude,
        distanceKm: getDistanceKm(originLat, originLon, latitude, longitude),
        mapUrl: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`,
      }
    })
    .filter(Boolean)
}

async function fetchNominatimHospitals(lat, lon) {
  const queries = ['동물병원', 'veterinary clinic']
  const deltas = [0.08, 0.2, 0.35]
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
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]
  const radiuses = [6000, 12000]
  const allHospitals = []

  for (const radius of radiuses) {
    for (const endpoint of endpoints) {
      try {
        const elements = await fetchOverpassHospitals({ endpoint, lat, lon, radius })
        const normalized = normalizeHospitals(elements, lat, lon)
        allHospitals.push(...normalized)
      } catch {
        // 다른 엔드포인트를 계속 시도합니다.
      }
    }

    if (allHospitals.length > 0) {
      break
    }
  }

  const uniqueByLocation = Array.from(
    new Map(
      allHospitals.map((item) => [
        `${item.name}-${item.lat.toFixed(6)}-${item.lon.toFixed(6)}`,
        item,
      ]),
    ).values(),
  ).sort((a, b) => a.distanceKm - b.distanceKm)

  if (uniqueByLocation.length > 0) {
    return uniqueByLocation.slice(0, 5)
  }

  try {
    const nominatimHospitals = await fetchNominatimHospitals(lat, lon)

    if (nominatimHospitals.length > 0) {
      return nominatimHospitals.slice(0, 5)
    }
  } catch {
    // 보조 API 실패 시 최종 오류를 반환합니다.
  }

  if (uniqueByLocation.length === 0) {
    throw new Error('실시간 병원 조회 결과가 없어요.')
  }

  return uniqueByLocation.slice(0, 5)
}

function HealthPage() {
  const [selectedSymptom, setSelectedSymptom] = useState('')
  const [selectedChecks, setSelectedChecks] = useState([])
  const [hospitals, setHospitals] = useState([])
  const [isLoadingHospitals, setIsLoadingHospitals] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

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
          setMessage('실시간 병원 조회가 지연되고 있어요. 잠시 뒤 다시 시도해 주세요.')
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
      { enableHighAccuracy: true, timeout: 10000 },
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

  return (
    <section>
      <h2 className="section-title">건강 상황 확인</h2>

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
