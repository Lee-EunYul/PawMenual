import { useEffect, useMemo, useState } from 'react'
import {
  MEAL_LOGS_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  readJsonStorage,
  writeJsonStorage,
} from '../lib/storage'

const FOOD_TYPES = ['건식', '습식', '혼합']
const REACTIONS = ['매우 잘 먹음', '잘 먹음', '보통', '잘 먹지 않음']
const SCENARIOS = [
  '자동 분석',
  '건식을 잘 먹지 않아요',
  '습식을 잘 먹지 않아요',
  '혼합 급여 비율이 고민돼요',
]

const foodTypeDescription = {
  건식: '치아 관리와 급여량 관리에 도움이 돼요.',
  습식: '기호성과 수분 섭취 보완에 도움이 돼요.',
  혼합: '균형과 기호성을 함께 챙기기 좋아요.',
}

const PRODUCT_LIBRARY = {
  pomeranian: {
    wet: [
      {
        name: '로얄캐닌 미니 어덜트 파우치',
        reason: '소형견용 습식으로 기호성과 수분 섭취 보완에 적합해요.',
      },
      {
        name: '시저(CESAR) 소형견용 웻푸드 파우치',
        reason: '입맛이 까다로운 소형견에게 많이 쓰이는 제품군이에요.',
      },
      {
        name: '힐스 사이언스다이어트 스몰앤미니 캔/파우치',
        reason: '소형견 영양 밸런스를 고려한 습식 라인업이에요.',
      },
    ],
    dry: [
      {
        name: '로얄캐닌 포메라니안 어덜트',
        reason: '포메라니안 전용 건식 라인으로 씹기 형태와 영양 설계를 고려해요.',
      },
    ],
  },
  default: {
    wet: [
      {
        name: '로얄캐닌 미니 어덜트 파우치',
        reason: '소형견/중소형견에서 기호성 개선 목적으로 많이 사용해요.',
      },
      {
        name: '시저(CESAR) 웻푸드 파우치',
        reason: '처음 습식을 도입할 때 접근성이 좋아요.',
      },
      {
        name: '힐스 사이언스다이어트 어덜트 습식',
        reason: '주원료 균형이 안정적인 편이라 전환 시 비교 기준이 돼요.',
      },
    ],
  },
}

function getRecommendation(profile) {
  const activity = profile.activityLevel
  const age = Number(profile.ageMonths || 0)
  const weight = Number(profile.weightKg || 0)
  const current = profile.currentFoodType || '건식'

  if (activity === '높음' || weight >= 12) {
    return {
      recommendedType: '혼합',
      reason: '활동량/체중을 고려하면 에너지와 기호성을 함께 챙기는 혼합 급여가 유리해요.',
    }
  }

  if (age > 0 && age <= 12) {
    return {
      recommendedType: '습식',
      reason: '성장기에는 기호성과 수분 보완이 중요해서 습식 비중을 조금 높이는 방법이 좋아요.',
    }
  }

  if (activity === '낮음') {
    return {
      recommendedType: '건식',
      reason: '활동량이 낮은 편이라면 급여량 조절이 쉬운 건식 중심이 관리에 도움이 돼요.',
    }
  }

  return {
    recommendedType: current,
    reason: '현재 생활 패턴 기준으로는 지금 급여 방식을 유지하면서 반응 기록을 비교해 보세요.',
  }
}

function FoodGuidePage() {
  const [profile, setProfile] = useState(null)
  const [selectedFoodType, setSelectedFoodType] = useState('건식')
  const [selectedScenario, setSelectedScenario] = useState('자동 분석')
  const [mealLogs, setMealLogs] = useState([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    const savedProfile = readJsonStorage(PROFILE_STORAGE_KEY, null)
    const savedMealLogs = readJsonStorage(MEAL_LOGS_STORAGE_KEY, [])

    setProfile(savedProfile)
    setMealLogs(savedMealLogs)

    if (savedProfile?.currentFoodType) {
      setSelectedFoodType(savedProfile.currentFoodType)
    }
  }, [])

  const recommendation = useMemo(
    () => getRecommendation(profile || {}),
    [profile],
  )

  const feedingDirection = useMemo(() => {
    const breed = String(profile?.breed || '').toLowerCase()
    const isPomeranian = breed.includes('포메') || breed.includes('pomeranian')
    const latestLog = mealLogs[0]

    const dryRefusalByAuto =
      latestLog &&
      latestLog.foodType === '건식' &&
      latestLog.reaction === '잘 먹지 않음'

    const dryRefusal =
      selectedScenario === '건식을 잘 먹지 않아요' ||
      (selectedScenario === '자동 분석' && dryRefusalByAuto)

    if (dryRefusal && isPomeranian) {
      return {
        title: '포메라니안 + 건식 기호성 낮음 상황이에요',
        action:
          '포메라니안 전용 건식을 기준으로, 소형견용 습식을 20~30% 섞어 5~7일 동안 천천히 전환해 보세요.',
        products: PRODUCT_LIBRARY.pomeranian.wet,
      }
    }

    if (dryRefusal) {
      return {
        title: '건식 기호성 보완이 필요해요',
        action:
          '건식을 완전히 중단하기보다 습식을 소량 섞어 기호성을 높이고, 1주일 단위로 반응을 비교해 보세요.',
        products: PRODUCT_LIBRARY.default.wet,
      }
    }

    if (selectedScenario === '습식을 잘 먹지 않아요') {
      return {
        title: '습식 기호성 낮음 상황이에요',
        action:
          '습식은 토핑(5~10%) 수준으로 줄이고 건식 비율을 높여, 하루 단위로 섭취량 변화를 확인해 보세요.',
        products: isPomeranian ? PRODUCT_LIBRARY.pomeranian.dry : PRODUCT_LIBRARY.default.wet,
      }
    }

    if (selectedScenario === '혼합 급여 비율이 고민돼요') {
      return {
        title: '혼합 급여 비율 조정이 필요해요',
        action:
          '처음에는 건식 70% + 습식 30%로 시작하고, 3일 간격으로 반응을 보고 10% 단위로 조절해 보세요.',
        products: isPomeranian ? PRODUCT_LIBRARY.pomeranian.wet : PRODUCT_LIBRARY.default.wet,
      }
    }

    return {
      title: '현재 반응은 안정적이에요',
      action:
        '지금 급여 방식을 유지하면서 반응 기록을 3회 이상 쌓아 비교하면 더 정확한 방향을 제시할 수 있어요.',
      products: isPomeranian ? PRODUCT_LIBRARY.pomeranian.dry : PRODUCT_LIBRARY.default.wet,
    }
  }, [mealLogs, profile, selectedScenario])

  const handleReactionSave = (reaction) => {
    const now = new Date()
    const newLog = {
      id: now.getTime(),
      dateISO: now.toISOString().slice(0, 10),
      date: now.toLocaleDateString('ko-KR'),
      time: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      foodType: selectedFoodType,
      reaction,
    }

    const updatedLogs = [newLog, ...mealLogs]
    setMealLogs(updatedLogs)
    writeJsonStorage(MEAL_LOGS_STORAGE_KEY, updatedLogs)
    setMessage('반응을 저장했어요! 최근 식사 기록에서 바로 확인할 수 있어요.')
  }

  return (
    <section>
      <h2 className="section-title">식생활 가이드</h2>

      <div className="surface-box recommendation-box">
        <p className="feature-eyebrow">맞춤 추천</p>
        <h3>추천 급여 방식: {recommendation.recommendedType}</h3>
        <p>{recommendation.reason}</p>
      </div>

      <div className="surface-box section-space">
        <p className="feature-eyebrow">현재 상황 선택</p>
        <div className="chip-row">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario}
              type="button"
              className={`chip-button${selectedScenario === scenario ? ' chip-button-active' : ''}`}
              onClick={() => setSelectedScenario(scenario)}
            >
              {scenario}
            </button>
          ))}
        </div>
      </div>

      <div className="surface-box section-space direction-box">
        <p className="feature-eyebrow">방향성 제안</p>
        <h3>{feedingDirection.title}</h3>
        <p>{feedingDirection.action}</p>
      </div>

      <div className="surface-box section-space">
        <p className="feature-eyebrow">제품 추천 (실판매 제품명 기준)</p>
        <ul className="plain-list section-space-small">
          {feedingDirection.products.map((product) => (
            <li key={product.name}>
              <strong>{product.name}</strong>
              <p>{product.reason}</p>
            </li>
          ))}
        </ul>
        <p className="section-space-small">
          구매 전 성분표/연령/알레르기 정보를 꼭 확인해 주세요.
        </p>
      </div>

      <div className="card-grid">
        <article className="feature-card">
          <p className="feature-eyebrow">건식</p>
          <h3>건식 사료</h3>
          <p>{foodTypeDescription.건식}</p>
        </article>

        <article className="feature-card">
          <p className="feature-eyebrow">습식</p>
          <h3>습식 사료</h3>
          <p>{foodTypeDescription.습식}</p>
        </article>

        <article className="feature-card">
          <p className="feature-eyebrow">혼합</p>
          <h3>혼합 급여</h3>
          <p>{foodTypeDescription.혼합}</p>
        </article>
      </div>

      <div className="surface-box section-space">
        <p className="feature-eyebrow">현재 급여 방식</p>
        <div className="chip-row">
          {FOOD_TYPES.map((foodType) => (
            <button
              key={foodType}
              type="button"
              className={`chip-button${selectedFoodType === foodType ? ' chip-button-active' : ''}`}
              onClick={() => setSelectedFoodType(foodType)}
            >
              {foodType}
            </button>
          ))}
        </div>
      </div>

      <div className="surface-box section-space">
        <p className="feature-eyebrow">오늘의 반응 기록</p>
        <div className="chip-row">
          {REACTIONS.map((reaction) => (
            <button
              key={reaction}
              type="button"
              className="chip-button"
              onClick={() => handleReactionSave(reaction)}
            >
              {reaction}
            </button>
          ))}
        </div>

        {message ? <p className="form-message form-success section-space-small">{message}</p> : null}
      </div>

      <div className="surface-box section-space">
        <p className="feature-eyebrow">최근 식사 기록</p>
        {mealLogs.length === 0 ? (
          <p className="section-space-small">아직 저장된 기록이 없어요.</p>
        ) : (
          <ul className="plain-list section-space-small">
            {mealLogs.slice(0, 5).map((log) => (
              <li key={log.id}>
                {log.date} {log.time} · {log.foodType} · {log.reaction}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default FoodGuidePage
