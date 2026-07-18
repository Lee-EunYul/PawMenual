import { useEffect, useState } from 'react'
import { PROFILE_STORAGE_KEY } from '../lib/storage'

const initialProfile = {
  name: '',
  breed: '',
  ageMonths: '',
  size: '중형',
  weightKg: '',
  activityLevel: '보통',
  mealCountPerDay: '3회',
  foodPreference: '',
  currentFoodType: '건식',
}

function ProfilePage() {
  const [form, setForm] = useState(initialProfile)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY)

    if (!saved) {
      return
    }

    try {
      const parsed = JSON.parse(saved)
      setForm((prev) => ({ ...prev, ...parsed }))
      setMessage('이전에 저장한 프로필을 불러왔어요.')
      setIsError(false)
    } catch {
      setMessage('저장된 프로필을 불러오지 못했어요. 다시 저장해 주세요.')
      setIsError(true)
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!form.name.trim() || !form.breed.trim()) {
      setMessage('강아지 이름과 견종은 꼭 입력해 주세요.')
      setIsError(true)
      return
    }

    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(form))
    setMessage('저장했어요! 새로고침해도 프로필이 그대로 유지돼요.')
    setIsError(false)
  }

  return (
    <section>
      <h2 className="section-title">강아지 프로필</h2>

      <form className="surface-box profile-form" onSubmit={handleSubmit}>
        <label className="form-row" htmlFor="name">
          강아지 이름
          <input
            id="name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            placeholder="예: 맥스"
          />
        </label>

        <label className="form-row" htmlFor="breed">
          견종
          <input
            id="breed"
            name="breed"
            type="text"
            value={form.breed}
            onChange={handleChange}
            placeholder="예: 포메라니안"
          />
        </label>

        <div className="form-two-cols">
          <label className="form-row" htmlFor="ageMonths">
            나이(개월)
            <input
              id="ageMonths"
              name="ageMonths"
              type="number"
              min="0"
              value={form.ageMonths}
              onChange={handleChange}
              placeholder="예: 6"
            />
          </label>

          <label className="form-row" htmlFor="weightKg">
            몸무게(kg)
            <input
              id="weightKg"
              name="weightKg"
              type="number"
              min="0"
              step="0.1"
              value={form.weightKg}
              onChange={handleChange}
              placeholder="예: 3.5"
            />
          </label>
        </div>

        <label className="form-row" htmlFor="size">
          크기
          <select id="size" name="size" value={form.size} onChange={handleChange}>
            <option value="소형">소형</option>
            <option value="중형">중형</option>
            <option value="대형">대형</option>
          </select>
        </label>

        <label className="form-row" htmlFor="activityLevel">
          활동량
          <select
            id="activityLevel"
            name="activityLevel"
            value={form.activityLevel}
            onChange={handleChange}
          >
            <option value="낮음">낮음</option>
            <option value="보통">보통</option>
            <option value="높음">높음</option>
          </select>
        </label>

        <label className="form-row" htmlFor="mealCountPerDay">
          일일 식사 횟수
          <select
            id="mealCountPerDay"
            name="mealCountPerDay"
            value={form.mealCountPerDay}
            onChange={handleChange}
          >
            <option value="2회">2회</option>
            <option value="3회">3회</option>
            <option value="4회+">4회+</option>
          </select>
        </label>

        <label className="form-row" htmlFor="foodPreference">
          음식 선호 경향
          <input
            id="foodPreference"
            name="foodPreference"
            type="text"
            value={form.foodPreference}
            onChange={handleChange}
            placeholder="예: 고기 향 선호"
          />
        </label>

        <label className="form-row" htmlFor="currentFoodType">
          현재 사료 형태
          <select
            id="currentFoodType"
            name="currentFoodType"
            value={form.currentFoodType}
            onChange={handleChange}
          >
            <option value="건식">건식</option>
            <option value="습식">습식</option>
            <option value="혼합">혼합</option>
          </select>
        </label>

        {message ? (
          <p className={`form-message${isError ? ' form-error' : ' form-success'}`}>
            {message}
          </p>
        ) : null}

        <button type="submit" className="primary-button">
          프로필 저장하기
        </button>
      </form>
    </section>
  )
}

export default ProfilePage
