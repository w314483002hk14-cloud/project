export const regionCountries = [
  {
    region: '亞洲',
    countries: ['大陸地區', '中國', '日本', '以色列', '印尼', '印度', '南韓', '香港', '泰國', '馬來西亞', '捷克', '越南', '新加坡', '蒙古', '澳門'],
  },
  {
    region: '歐洲',
    countries: [
      '土耳其',
      '丹麥',
      '比利時',
      '立陶宛',
      '冰島',
      '匈牙利',
      '西班牙',
      '希臘',
      '拉脫維亞',
      '法國',
      '波蘭',
      '芬蘭',
      '俄羅斯',
      '科索沃',
      '英國',
      '挪威',
      '捷克',
      '荷蘭',
      '斯洛維尼亞',
      '奧地利',
      '瑞士',
      '瑞典',
      '義大利',
      '葡萄牙',
      '德國',
      '盧森堡',
    ],
  },
  { region: '美洲', countries: ['巴西', '加拿大', '美國', '哥倫比亞', '智利', '墨西哥'] },
  { region: '大洋洲', countries: ['紐西蘭', '澳大利亞'] },
  { region: '非洲', countries: ['南非'] },
];

export function getRegionByCountry(country: string) {
  return regionCountries.find(({ countries }) => countries.includes(country))?.region ?? '其他';
}

export function getRegionByLatLng(lat: number, lng: number) {
  if (lat < -60) return '南極洲';
  if (lng >= -170 && lng < -30) return '美洲';
  if (lng >= -30 && lng < 60) return lat >= 0 ? '歐洲' : '非洲';
  if (lng >= 60 && lng < 150) return '亞洲';
  return '大洋洲';
}
