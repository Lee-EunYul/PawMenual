const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parseImage, normalizeResult, isVisionUnsupported, analyzeImage } = require('./index')

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'

test('accepts supported image types and rejects invalid or mismatched content', () => {
  assert.equal(parseImage(png).mimeType, 'image/png')
  assert.throws(() => parseImage('data:image/gif;base64,AAAA'), /IMAGE_FORMAT/)
  assert.throws(() => parseImage('data:image/png;base64,AAAA'), /IMAGE_CONTENT_TYPE/)
  const oversized = `data:image/png;base64,${'A'.repeat(Math.ceil(5 * 1024 * 1024 / 3) * 4)}`
  assert.throws(() => parseImage(oversized), /IMAGE_SIZE/)
})

test('uses unknown labels for absent values and preserves printed nutrient values', () => {
  const result = normalizeResult({
    labelType: 'food_label', productName: null, brand: null, ingredients: ['닭고기', '현미'],
    nutrients: [{ name: '조단백질', value: '26% 이상', meaning: '단백질 표시량' }],
    calories: null, feedingTarget: null, summary: '읽힌 정보', profileNotes: [],
  }, {})
  assert.equal(result.productName, '확인되지 않음')
  assert.deepEqual(result.ingredients, ['닭고기', '현미'])
  assert.equal(result.nutrients[0].value, '26% 이상')
  assert.equal(result.calories, '확인되지 않음')
})

test('does not invent ingredients for non-food or unreadable images', () => {
  assert.equal(normalizeResult({ labelType: 'not_food_label' }).ingredients.length, 0)
  assert.match(normalizeResult({ labelType: 'unreadable' }).summary, /정확히 확인하기 어렵습니다/)
})

test('identifies model capability errors without exposing raw provider error text', () => {
  assert.equal(isVisionUnsupported({ status: 400, message: 'This model does not support image input' }), true)
  assert.equal(isVisionUnsupported({ status: 400, code: 'image_parse_error', message: 'bad image' }), false)
})

test('does not promote a generic package heading to a product name', () => {
  const { normalizeResult } = require('./index')
  const result = normalizeResult({
    labelType: 'food_label', productName: '반려견용 완전 사료', brand: null,
    ingredients: ['닭고기'], nutrients: [], profileNotes: [],
  }, {})
  assert.equal(result.productName, '확인되지 않음')
})

test('bounds and sanitizes profile context sent with the image request', () => {
  const { sanitizeProfile } = require('./index')
  const profile = sanitizeProfile({ breed: '포메라니안', ageMonths: '24', weightKg: '3.2', name: 'Private', specialNotes: '주의'.repeat(1000) })
  assert.equal(profile.ageMonths, 24)
  assert.equal(profile.weightKg, 3.2)
  assert.equal(profile.name, undefined)
  assert.equal(profile.specialNotes.length, 500)
  assert.equal(sanitizeProfile(null).breed, '')
})

test('sends an in-memory data URL to the model and returns only structured label data', async () => {
  const expected = { labelType: 'food_label', productName: null, brand: 'TEST BRAND', ingredients: ['닭고기', '현미'], nutrients: [{ name: '조단백질', value: '26%', meaning: '단백질 표시량' }], calories: null, feedingTarget: '성견', summary: '확인된 라벨 정보', profileNotes: [], caution: '' }
  const client = { chat: { completions: { create: async request => {
    const userContent = request.messages.at(-1).content
    assert.match(userContent[1].image_url.url, /^data:image\/png;base64,/)
    assert.equal(JSON.parse(userContent[0].text).profile.specialNotes, '주의사항')
    return { choices: [{ message: { content: JSON.stringify(expected) } }] }
  } } } }
  const result = await analyzeImage({ imageDataUrl: png, profile: { specialNotes: '주의사항' } }, client, 'vision-model')
  assert.equal(result.productName, '확인되지 않음')
  assert.deepEqual(result.ingredients, ['닭고기', '현미'])
  assert.equal(Object.keys(result).some(key => /image|photo|dataUrl/i.test(key)), false)
})