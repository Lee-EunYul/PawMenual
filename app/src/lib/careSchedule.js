function addMonths(baseDate, months) {
  const date = new Date(baseDate)
  date.setMonth(date.getMonth() + months)
  return date
}

function toISODate(date) {
  return date.toISOString().slice(0, 10)
}

function toKoreanDate(date) {
  return date.toLocaleDateString('ko-KR')
}

function parseAgeMonths(profile) {
  const ageMonths = Number(profile?.ageMonths || 0)
  if (!Number.isFinite(ageMonths) || ageMonths < 0) {
    return 0
  }

  return ageMonths
}

function estimateBirthDate(ageMonths) {
  const now = new Date()
  const estimated = new Date(now)
  estimated.setMonth(estimated.getMonth() - ageMonths)
  return estimated
}

function createFixedVaccineItems(birthDate) {
  const vaccineRules = [
    {
      id: 'vaccine-dhppl-1',
      title: '종합백신(DHPPL) 1차',
      dueMonth: 2,
      category: '예방접종',
      note: '초기 면역 형성을 위한 기본 접종 단계예요.',
    },
    {
      id: 'vaccine-dhppl-2',
      title: '종합백신(DHPPL) 2차',
      dueMonth: 3,
      category: '예방접종',
      note: '1차 후 3~4주 간격으로 진행해요.',
    },
    {
      id: 'vaccine-dhppl-3',
      title: '종합백신(DHPPL) 3차',
      dueMonth: 4,
      category: '예방접종',
      note: '접종 간격은 병원 안내를 우선으로 맞춰 주세요.',
    },
    {
      id: 'vaccine-kennel',
      title: '켄넬코프 예방접종',
      dueMonth: 2,
      category: '예방접종',
      note: '미용실, 호텔, 놀이터 이용 전 확인이 좋아요.',
    },
    {
      id: 'vaccine-corona-1',
      title: '코로나 장염 백신 1차',
      dueMonth: 2,
      category: '예방접종',
      note: '지역/생활 환경에 따라 선택 접종 여부가 달라질 수 있어요.',
    },
    {
      id: 'vaccine-corona-2',
      title: '코로나 장염 백신 2차',
      dueMonth: 3,
      category: '예방접종',
      note: '1차 후 추가 접종을 진행해 면역 유지에 도움을 줘요.',
    },
    {
      id: 'vaccine-rabies-1',
      title: '광견병 예방접종(첫 접종)',
      dueMonth: 3,
      category: '예방접종',
      note: '법정 예방접종 기준은 지역 지침을 확인해 주세요.',
    },
  ]

  return vaccineRules.map((rule) => {
    const dueDate = addMonths(birthDate, rule.dueMonth)

    return {
      id: rule.id,
      category: rule.category,
      title: rule.title,
      dueAgeMonths: rule.dueMonth,
      dueDateISO: toISODate(dueDate),
      dueDateLabel: toKoreanDate(dueDate),
      note: rule.note,
    }
  })
}

function createRecurringItems(birthDate, currentAgeMonths) {
  const currentMonth = Math.max(0, Math.floor(currentAgeMonths))
  const startMonth = Math.max(2, currentMonth - 1)
  const endMonth = currentMonth + 6
  const items = []

  for (let month = startMonth; month <= endMonth; month += 1) {
    const dueDate = addMonths(birthDate, month)

    items.push({
      id: `heartworm-${month}`,
      category: '구충/예방',
      title: '심장사상충 예방약',
      dueAgeMonths: month,
      dueDateISO: toISODate(dueDate),
      dueDateLabel: toKoreanDate(dueDate),
      note: '매달 같은 시기에 복용하면 관리가 쉬워요.',
    })

    items.push({
      id: `ectoparasite-${month}`,
      category: '구충/예방',
      title: '외부기생충 예방(진드기/벼룩)',
      dueAgeMonths: month,
      dueDateISO: toISODate(dueDate),
      dueDateLabel: toKoreanDate(dueDate),
      note: '산책이 잦다면 계절과 무관하게 꾸준한 예방이 좋아요.',
    })

    if ((month - 2) % 3 === 0) {
      items.push({
        id: `deworming-${month}`,
        category: '구충/예방',
        title: '내부 구충제',
        dueAgeMonths: month,
        dueDateISO: toISODate(dueDate),
        dueDateLabel: toKoreanDate(dueDate),
        note: '보통 3개월 주기로 관리해요. 병원 일정에 맞춰 조정해 주세요.',
      })
    }
  }

  const rabiesStart = Math.max(15, currentMonth)
  for (let month = rabiesStart; month <= currentMonth + 24; month += 12) {
    const dueDate = addMonths(birthDate, month)
    items.push({
      id: `rabies-booster-${month}`,
      category: '예방접종',
      title: '광견병 추가접종(연 1회)',
      dueAgeMonths: month,
      dueDateISO: toISODate(dueDate),
      dueDateLabel: toKoreanDate(dueDate),
      note: '추가접종 주기는 지역 정책과 병원 권고를 확인해 주세요.',
    })
  }

  return items
}

export function buildCareSchedule(profile) {
  const ageMonths = parseAgeMonths(profile)
  const birthDate = estimateBirthDate(ageMonths)

  return [...createFixedVaccineItems(birthDate), ...createRecurringItems(birthDate, ageMonths)].sort(
    (a, b) => (a.dueDateISO > b.dueDateISO ? 1 : -1),
  )
}

export function getDateDiffDays(targetISO, today = new Date()) {
  const now = new Date(today)
  now.setHours(0, 0, 0, 0)

  const target = new Date(targetISO)
  target.setHours(0, 0, 0, 0)

  const millisecondsPerDay = 24 * 60 * 60 * 1000
  return Math.round((target.getTime() - now.getTime()) / millisecondsPerDay)
}

export function getCareStatus(item, checklistMap) {
  if (checklistMap[item.id]) {
    return '완료'
  }

  const diffDays = getDateDiffDays(item.dueDateISO)

  if (diffDays < 0) {
    return '지남'
  }

  if (diffDays <= 7) {
    return '임박'
  }

  return '예정'
}

export function getUpcomingReminders(items, checklistMap, daysThreshold = 14) {
  return items
    .filter((item) => !checklistMap[item.id])
    .map((item) => ({
      ...item,
      diffDays: getDateDiffDays(item.dueDateISO),
    }))
    .filter((item) => item.diffDays >= -7 && item.diffDays <= daysThreshold)
    .sort((a, b) => a.diffDays - b.diffDays)
}
