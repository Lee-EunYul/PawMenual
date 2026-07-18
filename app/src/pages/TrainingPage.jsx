import { useEffect, useMemo, useState } from 'react'
import {
  TRAINING_LOGS_STORAGE_KEY,
  TRAINING_PROGRESS_STORAGE_KEY,
  readJsonStorage,
  writeJsonStorage,
} from '../lib/storage'

const RESULT_OPTIONS = [
  '잘 따라 했어요',
  '일부만 따라 했어요',
  '관심을 보이지 않았어요',
  '이해하지 못한 것 같아요',
]

const FAILURE_REASONS = [
  '환경이 산만해요',
  '보상이 맞지 않아요',
  '단계가 어려워요',
  '훈련 시간이 길어요',
  '강아지가 긴장해요',
]

const PROGRAMS = {
  앉기: [
    '간식으로 시선을 위로 유도해 자연스럽게 앉는 자세를 만들어요.',
    '앉는 순간 바로 칭찬하고 보상을 줘서 행동을 연결해요.',
    '손 신호와 “앉아” 음성 신호를 함께 사용해 반복해요.',
    '간식 없이도 신호에 반응하는지 3회 연속 확인해요.',
    '다른 공간에서도 같은 신호로 앉기 성공률을 확인해요.',
  ],
  기다리기: [
    '짧은 2초 기다리기부터 시작하고 바로 보상해요.',
    '거리 1걸음 떨어져도 기다리면 칭찬해요.',
    '기다리는 시간을 5초, 8초로 점진적으로 늘려요.',
    '문 앞이나 밥그릇 앞에서 기다리기를 적용해요.',
    '산책 전 같은 신호로 기다리기 일반화를 해요.',
  ],
  '손 주기': [
    '손바닥을 내밀고 앞발 움직임을 유도해요.',
    '앞발이 손에 닿는 순간 즉시 칭찬해요.',
    '“손” 신호를 짧게 붙여 반복해요.',
    '양손 번갈아 손 주기를 연습해요.',
    '간식 없이도 신호에 반응하는지 확인해요.',
  ],
  엎드리기: [
    '앉은 자세에서 간식을 바닥 방향으로 유도해요.',
    '가슴이 바닥에 닿는 순간 칭찬하고 보상해요.',
    '“엎드려” 신호와 동작을 연결해요.',
    '머무는 시간을 3초 이상으로 늘려요.',
    '다른 장소에서도 엎드리기 반응을 확인해요.',
  ],
  돌기: [
    '강아지가 집중할 수 있는 조용한 환경을 준비해요.',
    '간식으로 원을 그리며 자연스럽게 회전 동작을 유도해요.',
    '회전이 나오면 즉시 칭찬하고 보상해요.',
    '짧게 3~5회 반복해 동작을 안정화해요.',
    '“돌아” 신호를 붙여 동작과 언어를 연결해요.',
  ],
}

const TRAINING_TYPES = Object.keys(PROGRAMS)

function getBranchingGuide(result) {
  if (result === '잘 따라 했어요') {
    return '잘했어요! 다음 단계로 넘어가 볼까요?'
  }

  if (result === '일부만 따라 했어요') {
    return '좋아요! 같은 단계를 더 짧게 나눠서 2~3회 반복해 보세요.'
  }

  if (result === '관심을 보이지 않았어요') {
    return '괜찮아요. 간식 대신 장난감이나 칭찬 보상으로 바꿔 다시 해보세요.'
  }

  return '걱정하지 마세요. 단계를 더 잘게 나누고 동작 범위를 줄여 천천히 반복해 보세요.'
}

function getDetailedPlan(trainingType, result, reason) {
  if (result === '잘 따라 했어요') {
    return {
      title: '다음 단계 진행 플랜',
      steps: [
        `${trainingType} 다음 단계를 3회만 짧게 진행해요.`,
        '성공한 즉시 칭찬 + 보상을 주세요.',
        '마지막 1회는 간식 없이 반응을 확인해요.',
      ],
      retry: '오늘 1~2회, 회당 3분 이내로 진행해 보세요.',
    }
  }

  const plansByReason = {
    '환경이 산만해요': {
      title: '환경 정리 우선 플랜',
      steps: [
        'TV 소리/장난감/사람 이동이 적은 곳으로 이동해요.',
        '리드줄 또는 짧은 공간에서 시작해 집중 범위를 좁혀요.',
        `${trainingType} 동작을 1단계만 2회 반복하고 바로 종료해요.`,
      ],
      retry: '10분 휴식 후 같은 환경에서 2분만 다시 시도해 보세요.',
    },
    '보상이 맞지 않아요': {
      title: '보상 교체 플랜',
      steps: [
        '간식 대신 장난감/칭찬 중 반응이 높은 보상으로 교체해요.',
        '보상은 동작 직후 1초 안에 바로 주세요.',
        `${trainingType} 동작을 작게 성공시켜 즉시 보상 연결을 강화해요.`,
      ],
      retry: '다음 시도에서는 같은 보상으로 3회 연속 진행해 보세요.',
    },
    '단계가 어려워요': {
      title: '단계 쪼개기 플랜',
      steps: [
        '현재 단계 목표를 절반 수준으로 낮춰요.',
        '유도 동작 범위를 줄여 작은 성공부터 만들어요.',
        '성공 2회 후에만 난이도를 아주 조금 올려요.',
      ],
      retry: '오늘은 쉬운 단계만 유지하고, 내일 난이도를 올려보세요.',
    },
    '훈련 시간이 길어요': {
      title: '짧고 자주 플랜',
      steps: [
        '훈련 시간을 2~3분으로 줄여요.',
        '한 세션당 목표를 1개만 잡아요.',
        '끝낼 때 쉬운 성공 동작 1회로 마무리해요.',
      ],
      retry: '하루 2~3회 짧게 나눠 진행해 보세요.',
    },
    '강아지가 긴장해요': {
      title: '긴장 완화 플랜',
      steps: [
        '훈련 전 1분 산책 또는 코놀이로 긴장을 낮춰요.',
        '부드러운 목소리로 쉬운 동작만 먼저 해요.',
        '실패 동작은 건너뛰고 성공 동작에서 종료해요.',
      ],
      retry: '컨디션이 좋은 시간대(식후 1시간 이후)에 다시 시도해 보세요.',
    },
  }

  const selectedPlan = plansByReason[reason] || plansByReason['단계가 어려워요']

  return {
    ...selectedPlan,
    title: `${trainingType} 재시도: ${selectedPlan.title}`,
  }
}

function TrainingPage() {
  const [trainingType, setTrainingType] = useState('앉기')
  const [progress, setProgress] = useState({})
  const [trainingLogs, setTrainingLogs] = useState([])
  const [lastResult, setLastResult] = useState('')
  const [failureReason, setFailureReason] = useState(FAILURE_REASONS[0])
  const [branchGuide, setBranchGuide] = useState('결과를 선택하면 다음에 할 방법을 안내해 드려요.')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const savedProgress = readJsonStorage(TRAINING_PROGRESS_STORAGE_KEY, {})
    const savedLogs = readJsonStorage(TRAINING_LOGS_STORAGE_KEY, [])
    setProgress(savedProgress)
    setTrainingLogs(savedLogs)
  }, [])

  const totalSteps = PROGRAMS[trainingType].length
  const currentStep = progress[trainingType] || 1
  const currentInstruction = useMemo(
    () => PROGRAMS[trainingType][Math.max(0, currentStep - 1)],
    [currentStep, trainingType],
  )
  const detailedPlan = useMemo(
    () => getDetailedPlan(trainingType, lastResult, failureReason),
    [failureReason, lastResult, trainingType],
  )

  const handleResult = (result) => {
    const now = new Date()
    const nextGuide = getBranchingGuide(result)
    const actionablePlan = getDetailedPlan(trainingType, result, failureReason)

    let nextStep = currentStep
    if (result === '잘 따라 했어요') {
      nextStep = Math.min(currentStep + 1, totalSteps)
    }

    const updatedProgress = {
      ...progress,
      [trainingType]: nextStep,
    }

    const newLog = {
      id: now.getTime(),
      dateISO: now.toISOString().slice(0, 10),
      date: now.toLocaleDateString('ko-KR'),
      time: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      trainingType,
      step: currentStep,
      result,
      nextAction: nextGuide,
      failureReason: result === '잘 따라 했어요' ? '' : failureReason,
      actionSteps: actionablePlan.steps,
    }

    const updatedLogs = [newLog, ...trainingLogs]
    setProgress(updatedProgress)
    setTrainingLogs(updatedLogs)
    setLastResult(result)
    setBranchGuide(nextGuide)
    setMessage('훈련 결과를 저장했어요! 성장 기록에서 바로 확인할 수 있어요.')

    writeJsonStorage(TRAINING_PROGRESS_STORAGE_KEY, updatedProgress)
    writeJsonStorage(TRAINING_LOGS_STORAGE_KEY, updatedLogs)
  }

  return (
    <section>
      <h2 className="section-title">훈련 선택</h2>

      <div className="training-grid">
        {TRAINING_TYPES.map((type) => {
          const typeStep = progress[type] || 1
          const typeTotal = PROGRAMS[type].length
          const doneCount = Math.max(typeStep - 1, 0)
          return (
            <button
              key={type}
              type="button"
              className={`training-type-card${trainingType === type ? ' training-type-card-active' : ''}`}
              onClick={() => {
                setTrainingType(type)
                setMessage('')
              }}
            >
              <strong>{type}</strong>
              <p>
                {doneCount} / {typeTotal} 단계 완료
              </p>
            </button>
          )
        })}
      </div>

      <div className="surface-box">
        <p className="feature-eyebrow">현재 진행 단계</p>
        <h3>
          {trainingType} · {currentStep} / {totalSteps}
        </h3>
        <p>{currentInstruction}</p>
      </div>

      <div className="surface-box section-space">
        <p className="feature-eyebrow">훈련 결과 선택</p>
        <div className="chip-row">
          {RESULT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className="chip-button"
              onClick={() => handleResult(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {lastResult && lastResult !== '잘 따라 했어요' ? (
        <div className="surface-box section-space">
          <p className="feature-eyebrow">안된 이유 선택</p>
          <div className="chip-row">
            {FAILURE_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                className={`chip-button${failureReason === reason ? ' chip-button-active' : ''}`}
                onClick={() => setFailureReason(reason)}
              >
                {reason}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="surface-box section-space recommendation-box">
        <p className="feature-eyebrow">다음 방법 안내</p>
        <p className="section-space-small">{branchGuide}</p>
        <h3 className="section-space-small">{detailedPlan.title}</h3>
        <ol className="plan-list section-space-small">
          {detailedPlan.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="section-space-small">재시도 팁: {detailedPlan.retry}</p>
      </div>

      {message ? <p className="form-message form-success section-space">{message}</p> : null}

      <div className="surface-box section-space">
        <p className="feature-eyebrow">최근 훈련 기록</p>
        {trainingLogs.length === 0 ? (
          <p className="section-space-small">아직 저장된 훈련 기록이 없어요.</p>
        ) : (
          <ul className="plain-list section-space-small">
            {trainingLogs.slice(0, 5).map((log) => (
              <li key={log.id}>
                {log.date} {log.time} · {log.trainingType} {log.step}단계 · {log.result}
                {log.failureReason ? ` · 원인: ${log.failureReason}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default TrainingPage
