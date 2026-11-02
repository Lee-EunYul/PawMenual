const { test } = require('node:test')
const assert = require('node:assert/strict')
const { validateInput, recommend } = require('./index')

test('supports Foundry v1 endpoints without appending Azure deployment paths', () => {
  const { createModelClient } = require('./index')
  const client = createModelClient({ endpoint: 'https://example.services.ai.azure.com/openai/v1', apiKey: 'test-only', deployment: 'test-model', apiVersion: '2024-10-21' })
  assert.equal(client.baseURL, 'https://example.services.ai.azure.com/openai/v1/')
  const responsesClient = createModelClient({ endpoint: 'https://example.services.ai.azure.com/openai/v1/responses', apiKey: 'test-only' })
  assert.equal(responsesClient.baseURL, 'https://example.services.ai.azure.com/openai/v1/')
  const legacyClient = createModelClient({ endpoint: 'https://example.openai.azure.com/', apiKey: 'test-only', deployment: 'test-model', apiVersion: '2024-10-21' })
  assert.equal(legacyClient.baseURL, 'https://example.openai.azure.com/openai')
})

test('explains an out-of-range saved age without calling Azure', async () => {
  const handler = require('./index')
  const context = {}
  await handler(context, { body: { profile: { breed: '불독', weightKg: '6.8', ageMonths: '500' } } })
  assert.equal(context.res.status, 400)
  assert.match(context.res.body.error, /360/)
  assert.match(context.res.body.error, /개월/)
  assert.equal(validateInput({ profile: { breed: '불독', weightKg: '6.8', ageMonths: '60' } }).ageMonths, 60)
})

test('validates breed, weight and age and omits personal identifiers', () => {
  const input = validateInput({ profile: { breed: '포메라니안', weightKg: 3, ageMonths: 24, name: 'Private' } })
  assert.equal(input.weightKg, 3)
  assert.equal(input.name, undefined)
  assert.throws(() => validateInput({ profile: { breed: '포메', weightKg: -1, ageMonths: 24 } }))
})

test('passes profile to Azure and validates the recommendation', async () => {
  const output = { recommendedType: '건식', reason: '이유', title: '제목', action: '방향', products: [{ id: 'rc-mini-adult', reason: '이유' }], caution: '수의사 상담' }
  const client = { chat: { completions: { create: async (request) => {
    assert.equal(request.model, 'deployment-name')
    assert.equal(request.max_completion_tokens, 1200)
    const payload = JSON.parse(request.messages.at(-1).content)
    assert.equal(payload.weightKg, 3)
    assert.ok(payload.catalog.some(product => product.id === 'rc-mini-adult'))
    return { choices: [{ message: { content: JSON.stringify(output) } }] }
  } } } }
  const result = await recommend({ weightKg: 3, ageMonths: 24 }, client, 'deployment-name')
  assert.equal(result.recommendedType, '건식')
  assert.equal(result.products[0].name, '로얄캐닌 미니 어덜트')
  assert.match(result.products[0].url, /^https:\/\/www.royalcanin.com\//)
  assert.equal(result.products[0].reason, '이유')
  for (const products of [[{ id: 'invented-food', reason: '이유' }], [{ id: 'rc-mini-puppy', reason: '이유' }], [{ id: 'rc-mini-adult', reason: '이유' }, { id: 'rc-mini-adult', reason: '이유' }]]) {
    client.chat.completions.create = async () => ({ choices: [{ message: { content: JSON.stringify({ ...output, products }) } }] })
    await assert.rejects(recommend({ ageMonths: 24 }, client, 'deployment-name'))
  }
  client.chat.completions.create = async () => ({ choices: [{ message: { content: JSON.stringify({ ...output, products: [] }) } }] })
  assert.deepEqual((await recommend({ ageMonths: 1 }, client, 'deployment-name')).products, [])
  client.chat.completions.create = async () => ({ choices: [{ message: { content: '{}' } }] })
  await assert.rejects(recommend({}, client, 'deployment-name'))
})

test('uses individual adult weight even when breed averages differ', async () => {
  const output = { recommendedType: '혼합', reason: '이유', title: '제목', action: '방향', products: [{ id: 'rc-mini-adult-wet', reason: '72개월, 6.8kg 조건에 맞는 후보' }], caution: '체형 확인 필요' }
  const client = { chat: { completions: { create: async (request) => {
    const catalog = JSON.parse(request.messages.at(-1).content).catalog
    assert.ok(catalog.some(product => product.id === 'rc-mini-adult'))
    assert.ok(catalog.some(product => product.id === 'rc-mini-adult-wet'))
    assert.ok(catalog.some(product => product.id === 'fromm-chicken-a-la-veg'))
    assert.ok(!catalog.some(product => product.id === 'rc-medium-adult'))
    return { choices: [{ message: { content: JSON.stringify(output) } }] }
  } } } }
  const input = { breed: '불독', ageMonths: 72, weightKg: 6.8 }
  assert.equal((await recommend(input, client, 'deployment-name')).products[0].id, 'rc-mini-adult-wet')
  for (const products of [[], [{ id: 'rc-medium-adult', reason: '잘못된 체중 범위' }]]) {
    client.chat.completions.create = async () => ({ choices: [{ message: { content: JSON.stringify({ ...output, products }) } }] })
    await assert.rejects(recommend(input, client, 'deployment-name'))
  }
})

test('allows a verified non-Royal-Canin product across adult size ranges', async () => {
  const output = { recommendedType: '건식', reason: '이유', title: '제목', action: '방향', products: [{ id: 'fromm-chicken-a-la-veg', reason: '성견용 후보' }], caution: '성분 확인' }
  const client = { chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify(output) } }] }) } } }
  const result = await recommend({ breed: '리트리버', ageMonths: 36, weightKg: 30 }, client, 'deployment-name')
  assert.equal(result.products[0].brand, '프롬')
  assert.match(result.products[0].url, /^https:\/\/www.frommfamily.com\//)
})

test('compares four brands and enforces inclusive small-breed limits', async () => {
  const output = { recommendedType: '건식', reason: '이유', title: '제목', action: '방향', products: [{ id: 'brit-care-adult-small', reason: '체격 후보' }], caution: '성분 확인' }
  const client = { chat: { completions: { create: async (request) => {
    const payload = JSON.parse(request.messages.at(-1).content)
    assert.equal(new Set(payload.catalog.map(product => product.brand)).size, 4)
    assert.equal(payload.foodPreference, '양고기')
    return { choices: [{ message: { content: JSON.stringify(output) } }] }
  } } } }
  assert.equal((await recommend({ ageMonths: 24, weightKg: 4, foodPreference: '양고기' }, client, 'deployment-name')).products[0].brand, '브릿')
  client.chat.completions.create = async () => ({ choices: [{ message: { content: JSON.stringify(output) } }] })
  assert.equal((await recommend({ ageMonths: 24, weightKg: 10 }, client, 'deployment-name')).products[0].id, 'brit-care-adult-small')
  await assert.rejects(recommend({ ageMonths: 24, weightKg: 10.1 }, client, 'deployment-name'))
  await assert.rejects(recommend({ ageMonths: 6, weightKg: 4 }, client, 'deployment-name'))
})