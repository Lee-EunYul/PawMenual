async function searchHospitals({ latitude, longitude, radius }, apiKey, request = fetch) {
  const hospitals = new Map()
  const signal = AbortSignal.timeout(12000)
  let hasMore = false
  for (let page = 1; page <= 3; page += 1) {
    const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json')
    url.search = new URLSearchParams({ query: '동물병원', x: String(longitude), y: String(latitude), radius: String(radius), sort: 'distance', size: '15', page: String(page) })
    const response = await request(url, { headers: { Authorization: `KakaoAK ${apiKey}` }, signal })
    if (!response.ok) throw new Error('PROVIDER')
    const data = await response.json()
    if (!Array.isArray(data.documents) || typeof data.meta?.is_end !== 'boolean') throw new Error('PROVIDER')
    for (const item of data.documents) {
      const distanceMeters = Number(item.distance)
      if (!item.id || !item.place_name || !item.category_name?.includes('동물병원') ||
          item.distance === '' || !Number.isFinite(distanceMeters) || distanceMeters < 0 || distanceMeters > radius) continue
      hospitals.set(item.id, {
        id: item.id, name: item.place_name, distanceMeters,
        distanceKm: distanceMeters / 1000,
        address: item.road_address_name || item.address_name || '주소 미제공',
        phone: item.phone || '',
        mapUrl: `https://place.map.kakao.com/${encodeURIComponent(item.id)}`,
      })
    }
    hasMore = !data.meta.is_end
    if (!hasMore) break
  }
  return { hospitals: [...hospitals.values()].sort((first, second) => first.distanceMeters - second.distanceMeters), radius, hasMore, source: '카카오맵' }
}

async function handler(context, req) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  const { latitude, longitude, radius = 5000 } = req.body || {}
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      ![3000, 5000, 10000, 20000].includes(radius)) {
    context.res = { status: 400, headers, body: { error: '올바른 현재 좌표와 검색 반경이 필요해요.' } }
    return
  }
  const apiKey = process.env.KAKAO_REST_API_KEY?.trim()
  if (!apiKey) {
    context.res = { status: 503, headers, body: { error: '병원 검색 서버에 KAKAO_REST_API_KEY 설정이 필요해요. 위치 감지는 가능하지만 병원 정보 조회는 아직 연결되지 않았어요.' } }
    return
  }
  try {
    context.res = { status: 200, headers, body: await searchHospitals({ latitude, longitude, radius }, apiKey) }
  } catch {
    context.res = { status: 502, headers, body: { error: '병원 검색 서비스에 연결하지 못했어요. 서버의 카카오 키·API 사용 권한과 네트워크를 확인해 주세요.' } }
  }
}

module.exports = handler
module.exports.searchHospitals = searchHospitals