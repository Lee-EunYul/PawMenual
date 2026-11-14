import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CARE_CHECKLIST_STORAGE_KEY,
  CARE_LOGS_STORAGE_KEY,
  HEALTH_LOGS_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  readJsonStorage,
} from '../lib/storage'
import { buildCareSchedule } from '../lib/careSchedule'

const initialSections = { name: true, breed: true, ageMonths: true, weightKg: true, currentFoodType: true, foodNotes: false, careRecords: false, healthRecords: false }
const noInformation = '등록된 정보 없음'
const emptyProfile = {}

function readPassportSnapshot() {
  const profile = readJsonStorage(PROFILE_STORAGE_KEY, null)
  const checklist = readJsonStorage(CARE_CHECKLIST_STORAGE_KEY, {})
  const careLogs = readJsonStorage(CARE_LOGS_STORAGE_KEY, [])
  const healthRecords = readJsonStorage(HEALTH_LOGS_STORAGE_KEY, [])
  const schedule = profile ? buildCareSchedule(profile) : []
  const completed = schedule.filter(item => Boolean(checklist[item.id])).map(item => ({
    id: item.id,
    title: item.title,
    date: checklist[item.id]?.checkedDate || checklist[item.id]?.checkedAt || noInformation,
  }))
  const records = new Map()
  for (const log of careLogs) records.set(String(log.id), {
    id: String(log.id), title: log.title, date: log.date || log.dateISO || noInformation,
  })
  for (const item of completed) records.set(item.id, item)
  return { profile, careRecords: [...records.values()], healthRecords }
}

function formatAge(value) {
  if (value == null || String(value).trim() === '') return noInformation
  const age = Number(value)
  if (!Number.isFinite(age) || age < 0) return noInformation
  const years = Math.floor(age / 12)
  const months = Math.floor(age % 12)
  if (years && months) return `${years}살 ${months}개월`
  if (years) return `${years}살`
  return `${months}개월`
}

function CarePassportPage() {
  const [snapshot, setSnapshot] = useState(readPassportSnapshot)
  const [sections, setSections] = useState(initialSections)
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    const handleStorage = () => setSnapshot(readPassportSnapshot())
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const profile = snapshot.profile || emptyProfile
  const rows = useMemo(() => [
    sections.name && ['이름', profile.name || noInformation],
    sections.breed && ['견종', profile.breed || noInformation],
    sections.ageMonths && ['나이', formatAge(profile.ageMonths)],
    sections.weightKg && ['몸무게', profile.weightKg ? `${profile.weightKg}kg` : noInformation],
    sections.currentFoodType && ['현재 식사 유형', profile.currentFoodType || noInformation],
  ].filter(Boolean), [profile, sections])

  const toggle = (event) => setSections(current => ({ ...current, [event.target.name]: event.target.checked }))

  return (
    <section className="passport-page">
      <div className="no-print">
        <p className="feature-eyebrow">PAWMENUAL V2</p>
        <h2 className="section-title">디지털 케어 패스포트</h2>
        <p>저장된 정보만 불러옵니다. 민감한 항목은 직접 선택하기 전까지 포함하지 않아요.</p>
      </div>
      {!snapshot.profile ? <div className="surface-box section-space"><p>등록된 프로필이 없어요.</p><Link className="primary-button passport-action" to="/profile">정보 등록하기</Link></div> : null}
      {snapshot.profile && !preview ? <div className="surface-box section-space no-print">
        <p className="feature-eyebrow">문서에 포함할 정보</p>
        <div className="passport-options section-space-small">
          {[
            ['name', '이름'], ['breed', '견종'], ['ageMonths', '나이'], ['weightKg', '몸무게'],
            ['currentFoodType', '현재 식사 유형'], ['foodNotes', '식생활 특이사항 (민감 정보)'],
            ['careRecords', `예방·케어 완료 기록 (${snapshot.careRecords.length}건)`],
            ['healthRecords', `건강 관찰 기록 (${snapshot.healthRecords.length}건, 민감 정보)`],
          ].map(([name,label]) => <label className="passport-checkbox" key={name}><input type="checkbox" name={name} checked={sections[name]} onChange={toggle}/><span>{label}</span></label>)}
        </div>
        <div className="passport-actions section-space"><Link className="chip-button" to="/profile">정보 수정하기</Link><button type="button" className="primary-button" onClick={() => { setSnapshot(readPassportSnapshot()); setPreview(true) }}>미리보기</button></div>
      </div> : null}
      {snapshot.profile && preview ? <article className="passport-document section-space" aria-label="케어 패스포트 미리보기">
        <header className="passport-document-header"><p className="passport-brand">PAWMENUAL</p><p className="passport-kicker">DIGITAL CARE PASSPORT</p></header>
        <h2>{sections.name ? profile.name || noInformation : '반려견 케어 정보'}</h2>
        {profile.photoDataUrl && profile.photoDataUrl.startsWith('data:image/') ? <img className="passport-photo" src={profile.photoDataUrl} alt="반려견 사진"/> : null}
        <dl className="passport-info-grid">{rows.map(([label,value]) => <div className="passport-info-row" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {sections.foodNotes ? <section className="passport-section"><h3>식생활 특이사항</h3><p>{profile.specialNotes || profile.foodPreference || noInformation}</p></section> : null}
        {sections.careRecords ? <section className="passport-section"><h3>예방·케어 완료 기록</h3>{snapshot.careRecords.length ? <ul>{snapshot.careRecords.map(item => <li key={item.id}>{item.date} · {item.title}</li>)}</ul> : <p>{noInformation}</p>}</section> : null}
        {sections.healthRecords ? <section className="passport-section"><h3>건강 관찰 기록</h3>{snapshot.healthRecords.length ? <ul>{snapshot.healthRecords.map((item,index) => <li key={item.id || index}>{item.date || item.dateISO || noInformation} · {item.category || '건강 관찰'} · {item.summary || noInformation}</li>)}</ul> : <p>{noInformation}</p>}</section> : null}
        <footer className="passport-document-footer"><strong>PAWMENUAL V2</strong><span>반려견 케어 정보를 한눈에</span><p>본 문서는 보호자가 입력한 정보를 정리한 자료이며, 공식 예방접종 증명서나 수의학적 진단서가 아닙니다.</p></footer>
        <div className="passport-actions no-print section-space"><button type="button" className="chip-button" onClick={() => setPreview(false)}>포함 항목 수정</button><button type="button" className="primary-button" onClick={() => window.print()}>PDF로 저장하기</button></div>
      </article> : null}
    </section>
  )
}

export default CarePassportPage