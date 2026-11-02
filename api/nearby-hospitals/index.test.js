const { test } = require('node:test')
const assert = require('node:assert/strict')
const handler = require('./index')

test('passes current coordinates, paginates, deduplicates and sorts veterinary results', async () => {
  let calls = 0
  const request = async (url, options) => {
    calls += 1
    assert.equal(url.searchParams.get('x'), '127')
    assert.equal(url.searchParams.get('y'), '37')
    assert.equal(url.searchParams.get('sort'), 'distance')
    assert.equal(options.headers.Authorization, 'KakaoAK test')
    const place = (id, distance, category_name = '의료 > 동물병원') => ({ id, distance, category_name, place_name: '테스트 병원', road_address_name: '테스트 주소' })
    return { ok: true, json: async () => ({ meta: { is_end: calls === 2 }, documents: calls === 1 ? [place('1', '500'), place('2', '6000'), place('3', '100', '애견용품')] : [place('1', '500'), place('4', '200')] }) }
  }
  const result = await handler.searchHospitals({ latitude: 37, longitude: 127, radius: 5000 }, 'test', request)
  assert.equal(calls, 2)
  assert.deepEqual(result.hospitals.map(item => item.id), ['4', '1'])
  assert.equal(result.hospitals[0].address, '테스트 주소')
  assert.equal(result.hasMore, false)
})

test('rejects invalid coordinates before contacting provider', async () => {
  const context = {}
  await handler(context, { body: { latitude: null, longitude: 127 } })
  assert.equal(context.res.status, 400)
})

test('distinguishes no results from provider failure', async () => {
  const input = { latitude: 37, longitude: 127, radius: 5000 }
  const empty = await handler.searchHospitals(input, 'test', async () => ({ ok: true, json: async () => ({ documents: [], meta: { is_end: true } }) }))
  assert.deepEqual(empty.hospitals, [])
  await assert.rejects(handler.searchHospitals(input, 'test', async () => ({ ok: false })))
})