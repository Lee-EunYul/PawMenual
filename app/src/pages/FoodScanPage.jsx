import { useEffect, useState } from 'react'
import {
  FOOD_LABEL_SCANS_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  readJsonStorage,
  writeJsonStorage,
} from '../lib/storage'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('사진을 읽지 못했어요. 다시 선택해 주세요.'))
    reader.readAsDataURL(file)
  })
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '날짜 미기록' : date.toLocaleString('ko-KR')
}

function FoodScanPage() {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [profile] = useState(() => readJsonStorage(PROFILE_STORAGE_KEY, null))
  const [manualMode, setManualMode] = useState(false)
  const [manual, setManual] = useState({ productName: '', brand: '', ingredients: '', nutrients: '', calories: '', feedingTarget: '' })
  const [result, setResult] = useState(null)
  const [resultSource, setResultSource] = useState('')
  const [savedResultId, setSavedResultId] = useState('')
  const [savedScans, setSavedScans] = useState(() => readJsonStorage(FOOD_LABEL_SCANS_STORAGE_KEY, []))
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const handleFile = (event) => {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (!selected) return
    setResult(null)
    setSavedResultId('')
    setMessage('')
    if (!ACCEPTED_TYPES.has(selected.type)) {
      setFile(null)
      setPreviewUrl('')
      setMessage('JPG, PNG, WEBP 사진만 올릴 수 있어요.')
      setIsError(true)
      return
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFile(null)
      setPreviewUrl('')
      setMessage('사진은 5MB 이하만 올릴 수 있어요.')
      setIsError(true)
      return
    }
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setMessage('사진을 선택했어요. 성분표 글자가 잘 보이는지 확인해 주세요.')
    setIsError(false)
  }

  const handleAnalyze = async () => {
    if (!file) {
      setMessage('먼저 사료 성분표 사진을 선택해 주세요.')
      setIsError(true)
      return
    }
    if (isAnalyzing) return
    setIsAnalyzing(true)
    setMessage('사진에서 성분표 정보를 확인하고 있어요...')
    setIsError(false)
    try {
      const imageDataUrl = await readDataUrl(file)
      const response = await fetch('/api/scan-food-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl,
          profile: profile ? {
            breed: profile.breed,
            ageMonths: profile.ageMonths,
            weightKg: profile.weightKg,
            currentFoodType: profile.currentFoodType,
            foodPreference: profile.foodPreference,
            specialNotes: profile.specialNotes,
          } : {},
        }),
        signal: AbortSignal.timeout(65000),
      })
      const data = await response.json()
      if (response.status === 501 && data.code === 'VISION_UNSUPPORTED') {
        setManualMode(true)
        throw new Error('현재 Azure 배포 모델은 이미지 분석을 지원하지 않아요. 직접 입력 모드에서 포장지 내용을 옮겨 적어 주세요. 사진은 서버에 저장되지 않았어요.')
      }
      if (!response.ok) throw new Error(data.error || '현재 AI 분석을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.')
      setResult(data)
      setResultSource('ai')
      setSavedResultId('')
      setMessage(data.labelType === 'food_label' ? '사진에서 확인된 내용을 분석했어요.' : data.summary)
      setIsError(data.labelType !== 'food_label')
    } catch (error) {
      setMessage(error instanceof SyntaxError || error.name === 'TimeoutError' || error.name === 'TypeError'
        ? '현재 AI 분석을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
        : error.message)
      setIsError(true)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleManualChange = (event) => {
    const { name, value } = event.target
    setManual(current => ({ ...current, [name]: value }))
  }

  const handleManualResult = () => {
    const nutrients = manual.nutrients.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      const separator = line.indexOf(':')
      return separator < 0
        ? { name: line, value: '확인되지 않음', meaning: '직접 입력한 항목' }
        : { name: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() || '확인되지 않음', meaning: '직접 입력한 라벨 표기' }
    })
    setResult({
      labelType: 'food_label',
      productName: manual.productName.trim() || '확인되지 않음',
      brand: manual.brand.trim() || '확인되지 않음',
      ingredients: manual.ingredients.split(/[,\n]/).map(value => value.trim()).filter(Boolean),
      nutrients,
      calories: manual.calories.trim() || '확인되지 않음',
      feedingTarget: manual.feedingTarget.trim() || '확인되지 않음',
      summary: '직접 입력한 라벨 정보입니다. AI 이미지 분석 결과가 아닙니다.',
      profileNotes: [],
      caution: '입력한 내용이 실제 포장지 표기와 일치하는지 확인해 주세요. 질환이나 알레르기는 수의사와 상담해 주세요.',
    })
    setResultSource('manual')
    setSavedResultId('')
    setMessage('직접 입력한 내용을 정리했어요. AI가 사진을 분석한 결과가 아닙니다.')
    setIsError(false)
  }

  const handleSave = () => {
    if (!result || result.labelType !== 'food_label') return
    const record = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dateISO: new Date().toISOString(),
      profileId: profile?.id || null,
      productName: result.productName,
      brand: result.brand,
      ingredients: result.ingredients,
      nutrients: result.nutrients,
      calories: result.calories,
      feedingTarget: result.feedingTarget,
      summary: result.summary,
      profileNotes: result.profileNotes,
      caution: result.caution,
      source: resultSource,
    }
    const updated = [record, ...readJsonStorage(FOOD_LABEL_SCANS_STORAGE_KEY, [])]
    writeJsonStorage(FOOD_LABEL_SCANS_STORAGE_KEY, updated)
    setSavedScans(updated)
    setSavedResultId(record.id)
    setMessage('분석 정보만 저장했어요. 원본 사진은 저장하지 않았습니다.')
    setIsError(false)
  }

  const handleDelete = (id) => {
    const updated = savedScans.filter(item => item.id !== id)
    writeJsonStorage(FOOD_LABEL_SCANS_STORAGE_KEY, updated)
    setSavedScans(updated)
    if (savedResultId === id) {
      setResult(null)
      setSavedResultId('')
    }
  }

  const handleViewSaved = (scan) => {
    setResult({ ...scan, labelType: 'food_label' })
    setResultSource(scan.source || 'manual')
    setSavedResultId(scan.id)
    setMessage('저장된 분석 내용을 불러왔어요. 원본 사진은 저장되지 않았습니다.')
    setIsError(false)
  }

  return (
    <section>
      <p className="feature-eyebrow">PAWMENUAL V2</p>
      <h2 className="section-title">AI 사료 성분표 스캐너</h2>
      <p className="section-space-small">사료 포장지의 원료 또는 영양성분표를 촬영해 업로드해 보세요.</p>

      <div className="surface-box section-space">
        <p className="feature-eyebrow">사진 업로드</p>
        <p className="section-space-small">JPG, PNG, WEBP · 최대 5MB · 원본 사진은 저장하지 않아요.</p>
        <div className="scanner-actions section-space-small">
          <label className="primary-button scanner-file-button">사진 보관함에서 선택<input className="scanner-hidden-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile}/></label>
          <label className="chip-button scanner-file-button">사진 촬영하기<input className="scanner-hidden-input" type="file" accept="image/*" capture="environment" onChange={handleFile}/></label>
        </div>
        {previewUrl ? <div className="scanner-preview-wrap section-space-small">
          <img className="scanner-preview" src={previewUrl} alt="업로드한 사료 성분표 미리보기"/>
          <div className="scanner-actions section-space-small">
            <label className="chip-button scanner-file-button">사진 변경<input className="scanner-hidden-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile}/></label>
            <button type="button" className="chip-button" onClick={() => { setFile(null); setPreviewUrl(''); setResult(null); setSavedResultId(''); setMessage('사진을 삭제했어요.') }}>사진 삭제</button>
          </div>
        </div> : <p className="section-space-small">선택한 사진의 미리보기가 여기에 표시돼요.</p>}
        <button type="button" className="primary-button section-space-small" onClick={handleAnalyze} disabled={!file || isAnalyzing || manualMode}>{isAnalyzing ? '성분표 분석 중...' : '분석 시작'}</button>
        <button type="button" className="chip-button section-space-small" onClick={() => { setManualMode(true); setResult(null); setSavedResultId(''); setMessage('직접 입력 모드입니다. 사진 자동 분석 결과가 아닙니다.'); setIsError(false) }} disabled={isAnalyzing}>{manualMode ? '직접 입력 모드' : '텍스트로 직접 입력하기'}</button>
      </div>

      {manualMode ? <div className="surface-box section-space">
        <p className="feature-eyebrow">직접 입력 모드</p>
        <p>모델이 이미지를 분석하지 않습니다. 포장지에 적힌 내용을 직접 옮겨 적어 주세요.</p>
        <label className="form-row section-space-small">제품명<input name="productName" value={manual.productName} onChange={handleManualChange} maxLength={200}/></label>
        <label className="form-row section-space-small">브랜드<input name="brand" value={manual.brand} onChange={handleManualChange} maxLength={200}/></label>
        <label className="form-row section-space-small">원료명 (쉼표 또는 줄바꿈으로 구분)<textarea name="ingredients" rows="4" value={manual.ingredients} onChange={handleManualChange} maxLength={4000}/></label>
        <label className="form-row section-space-small">영양성분 (항목: 표시값, 한 줄에 하나씩)<textarea name="nutrients" rows="5" value={manual.nutrients} onChange={handleManualChange} maxLength={3000} placeholder={'조단백질: 26% 이상\n조지방: 15% 이상'}/></label>
        <label className="form-row section-space-small">열량 (표시된 경우)<input name="calories" value={manual.calories} onChange={handleManualChange} maxLength={100}/></label>
        <label className="form-row section-space-small">연령 또는 급여 대상 (표시된 경우)<input name="feedingTarget" value={manual.feedingTarget} onChange={handleManualChange} maxLength={300}/></label>
        <button type="button" className="primary-button section-space-small" onClick={handleManualResult}>입력한 정보 정리하기</button>
      </div> : null}

      {message ? <p role={isError ? 'alert' : 'status'} className={`form-message section-space ${isError ? 'form-error' : 'form-success'}`}>{message}</p> : null}

      {result ? <section className="surface-box section-space" aria-label="사료 성분표 분석 결과">
        <p className="feature-eyebrow">{resultSource === 'manual' ? '직접 입력 결과' : '사료 성분표 분석 결과'}</p>
        <h3>{result.productName}</h3><p>{result.brand}</p><p className="section-space-small">{result.summary}</p>
        {result.labelType === 'food_label' ? <>
          <div className="scanner-result-section section-space-small"><h3>주요 원료</h3><ol>{result.ingredients.map((item,index)=><li key={`${index}-${item}`}>{item}</li>)}</ol></div>
          <div className="scanner-result-section section-space-small"><h3>영양성분</h3>
            {result.nutrients.length ? <dl className="passport-info-grid">{result.nutrients.map((item,index)=><div className="passport-info-row" key={`${item.name}-${index}`}><dt>{item.name}</dt><dd>{item.value}{item.meaning ? <small> · {item.meaning}</small> : null}</dd></div>)}</dl> : <p>확인되지 않음</p>}
            <p>열량 · {result.calories}</p><p>급여 대상 · {result.feedingTarget}</p>
          </div>
          <div className="scanner-result-section section-space-small"><h3>우리 반려견과 확인할 사항</h3>
            {profile ? <p>{profile.name || '등록된 반려견'} · {profile.breed || '견종 미등록'} · {profile.ageMonths || '나이 미등록'}개월 · {profile.weightKg || '몸무게 미등록'}kg</p> : <p>반려견 프로필이 없어 일반 정보만 표시합니다.</p>}
            {result.profileNotes.length ? <ul>{result.profileNotes.map((note,index)=><li key={index}>{note}</li>)}</ul> : null}
          </div>
          <p className="warning-box section-space-small">{result.caution}</p>
          <button type="button" className="primary-button section-space-small" onClick={handleSave} disabled={Boolean(savedResultId)}>{savedResultId ? '저장된 결과' : '분석 결과 저장'}</button>
        </> : null}
      </section> : null}

      <section className="surface-box section-space">
        <p className="feature-eyebrow">저장한 분석 결과</p>
        {savedScans.length ? <ul className="plain-list section-space-small">{savedScans.map(scan=><li key={scan.id}>
          <strong>{scan.productName}</strong><p>{scan.brand} · {formatDate(scan.dateISO)}</p><p>{scan.source === 'manual' ? '직접 입력' : 'AI 이미지 분석'}</p>
          <button type="button" className="chip-button" onClick={() => handleViewSaved(scan)}>저장 결과 보기</button>
          <button type="button" className="chip-button" onClick={() => handleDelete(scan.id)}>결과 삭제</button>
        </li>)}</ul> : <p className="section-space-small">저장된 분석 결과가 없어요.</p>}
      </section>
    </section>
  )
}

export default FoodScanPage