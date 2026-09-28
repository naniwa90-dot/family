const members = ['철이', '순이', '형재', '윤재'];
const airServiceKey = 'd0f07c7b0b2b1e128da4617d440bb9cd551b0552cad6b3f137fbb3900138a4e7';
const kmaAuthKey = 'd2CcU-KkRL6gnFPipPS-Lw';
const airApiUrl = 'https://apis.data.go.kr/5590000/AirQualityService/getAirQualityList';
const kmaApiUrl = 'https://apihub.kma.go.kr/api/typ01/url/fct_afs_dl.php';
const $ = (selector) => document.querySelector(selector);
const today = new Date();
let calendarDate = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = formatDate(today);
let selectedMember = members[0];
let bucketLists = loadJson('family-bucket-list', {});
let dayMemos = normalizeMemos(loadJson('family-day-memos', {}));

function loadJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function formatDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function displayDate(date) { return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
function normalizeDate(item) { if (item.date) return item.date; if (item.month) return `${today.getFullYear()}-${String(item.month).padStart(2, '0')}-01`; return ''; }
function normalizeMemos(value) { return Object.fromEntries(Object.entries(value).map(([date, memo]) => [date, Array.isArray(memo) ? memo : memo?.text ? [memo] : []])); }
function formatPlannedDate(dateKey) { if (!dateKey) return '날짜 미정'; const date = new Date(`${dateKey}T00:00:00`); return `실행예정: ${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`; }

function renderMembers() {
  $('#memberGrid').innerHTML = members.map((member) => { const list = bucketLists[member] || []; const done = list.filter((item) => item.done).length; return `<button class="member-button" type="button" data-member="${member}"><span class="member-avatar">${member[0]}</span><span class="member-name">${member}</span><span class="member-state">${list.length ? `${done}/${list.length} 달성` : '버킷리스트 작성'}</span></button>`; }).join('');
  $('#bucketCount').textContent = Object.values(bucketLists).flat().length;
  document.querySelectorAll('.member-button').forEach((button) => button.addEventListener('click', () => openBucketModal(button.dataset.member)));
}
function openBucketModal(member) {
  selectedMember = member; const list = bucketLists[member] || [];
  $('#bucketModalTitle').textContent = `${member} 버킷리스트`;
  $('#bucketItems').innerHTML = list.length ? list.map((item, index) => { const date = normalizeDate(item); return `<li class="bucket-item${item.done ? ' completed' : ''}"><span class="bucket-number">${index + 1}</span><span class="bucket-text">${escapeHtml(item.text)}</span><span class="bucket-date">${formatPlannedDate(date)}</span><span class="bucket-actions"><button type="button" class="item-button edit-bucket" data-index="${index}">편집</button><button type="button" class="item-button delete-bucket" data-index="${index}">삭제</button><button type="button" class="item-button done-button" data-index="${index}">${item.done ? '완료' : '달성'}</button></span></li>`; }).join('') : '<li class="empty-bucket">아직 적은 버킷리스트가 없어요.</li>';
  document.querySelectorAll('.edit-bucket').forEach((button) => button.addEventListener('click', () => editBucket(Number(button.dataset.index))));
  document.querySelectorAll('.delete-bucket').forEach((button) => button.addEventListener('click', () => deleteBucket(Number(button.dataset.index))));
  document.querySelectorAll('.done-button').forEach((button) => button.addEventListener('click', () => toggleBucket(Number(button.dataset.index))));
  $('#bucketModal').showModal();
}
function editBucket(index) { const item = bucketLists[selectedMember][index]; $('#bucketInput').value = item.text; $('#bucketDate').value = normalizeDate(item); $('#bucketEditIndex').value = index; }
function deleteBucket(index) { bucketLists[selectedMember].splice(index, 1); saveJson('family-bucket-list', bucketLists); openBucketModal(selectedMember); renderMembers(); renderCalendar(); }
function toggleBucket(index) { bucketLists[selectedMember][index].done = !bucketLists[selectedMember][index].done; saveJson('family-bucket-list', bucketLists); openBucketModal(selectedMember); renderMembers(); renderCalendar(); }
function saveBucket() {
  const text = $('#bucketInput').value.trim(); if (!text) return;
  const list = bucketLists[selectedMember] || (bucketLists[selectedMember] = []); const index = Number($('#bucketEditIndex').value); const oldItem = list[index];
  const item = { text, date: $('#bucketDate').value, done: index >= 0 ? Boolean(oldItem?.done) : false };
  if (index >= 0) list[index] = item; else list.push(item);
  saveJson('family-bucket-list', bucketLists); $('#bucketInput').value = ''; $('#bucketDate').value = ''; $('#bucketEditIndex').value = '-1'; openBucketModal(selectedMember); renderMembers(); renderCalendar();
}
function openAllBuckets() {
  const items = allPlannedItems();
  const completedItems = items.filter((item) => item.done);
  const upcomingItems = items.filter((item) => !item.done);
  const renderAllItems = (list) => list.length
    ? `<ul class="all-bucket-items">${list.map((item) => `<li class="all-bucket-item${item.done ? ' completed' : ''}"><span class="all-bucket-copy"><strong>${escapeHtml(item.text)}</strong><small>${item.member} · ${formatPlannedDate(item.date)}</small></span><b>${item.member}</b></li>`).join('')}</ul>`
    : '<p class="all-bucket-empty">표시할 버킷리스트가 없습니다.</p>';
  $('#allBucketContent').innerHTML = `<section class="all-bucket-group completed-group"><h3>실행완료 버킷</h3>${renderAllItems(completedItems)}</section><section class="all-bucket-group upcoming-group"><h3>실행예정 버킷</h3>${renderAllItems(upcomingItems)}</section>`;
  $('#allBucketModal').showModal();
}
function allPlannedItems() { return members.flatMap((member) => (bucketLists[member] || []).map((item) => ({ ...item, member, date: normalizeDate(item) }))); }
function plannedForDate(dateKey) { return allPlannedItems().filter((item) => item.date === dateKey); }
function renderCalendar() {
  const year = calendarDate.getFullYear(); const month = calendarDate.getMonth(); $('#calendarTitle').textContent = `${year}.${String(month + 1).padStart(2, '0')}`;
  const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const cells = [];
  for (let index = 0; index < firstDay; index += 1) cells.push('<div class="day-cell empty"></div>');
  for (let day = 1; day <= daysInMonth; day += 1) { const key = formatDate(new Date(year, month, day)); const planned = plannedForDate(key); const isToday = key === formatDate(today); const isSelected = key === selectedDate; cells.push(`<button class="day-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}" type="button" data-date="${key}"><span class="day-number">${day}</span><span class="day-dots">${planned.map(() => '<i class="day-dot"></i>').join('')}</span></button>`); }
  $('#calendarGrid').innerHTML = cells.join(''); document.querySelectorAll('.day-cell[data-date]').forEach((cell) => cell.addEventListener('click', () => { selectedDate = cell.dataset.date; renderCalendar(); openMemoModal(selectedDate); })); renderDayDetail();
}
function renderDayDetail() { const memos = dayMemos[selectedDate] || []; const planned = plannedForDate(selectedDate); const parts = [...planned.map((item) => `${item.member}: ${item.text}`), ...memos.map((memo) => `${memo.writer}: ${memo.text}`)]; $('#dayDetail').innerHTML = `<span class="detail-dot"></span><span>${parts.length ? `${displayDate(new Date(`${selectedDate}T00:00:00`))} · ${parts.map(escapeHtml).join(' / ')}` : `${displayDate(new Date(`${selectedDate}T00:00:00`))} · 기록이 없습니다.`}</span>`; }
function openMemoModal(dateKey) {
  const memos = dayMemos[dateKey] || []; const planned = plannedForDate(dateKey); $('#modalDate').textContent = displayDate(new Date(`${dateKey}T00:00:00`));
  $('#modalPlanned').innerHTML = planned.length ? `<h3>이 날 실행예정</h3><ul>${planned.map((item) => `<li class="modal-planned-item${item.done ? ' completed' : ''}"><span>${escapeHtml(item.text)}</span><b>${item.member}</b></li>`).join('')}</ul>` : '';
  $('#modalMembers').innerHTML = memos.length ? memos.map((memo, index) => `<div class="memo-entry"><span><b>${escapeHtml(memo.writer)}</b>${escapeHtml(memo.text)}</span><span class="memo-entry-actions"><button class="item-button edit-memo" data-index="${index}" type="button">수정</button><button class="item-button delete-memo" data-index="${index}" type="button">삭제</button></span></div>`).join('') : '';
  $('#memoWriter').value = members[0]; $('#memoText').value = ''; $('#memoEditIndex').value = '-1';
  document.querySelectorAll('.edit-memo').forEach((button) => button.addEventListener('click', () => editMemo(Number(button.dataset.index)))); document.querySelectorAll('.delete-memo').forEach((button) => button.addEventListener('click', () => deleteMemo(Number(button.dataset.index)))); $('#dayModal').showModal();
}
function editMemo(index) { const memo = dayMemos[selectedDate][index]; $('#memoWriter').value = memo.writer; $('#memoText').value = memo.text; $('#memoEditIndex').value = index; }
function deleteMemo(index) { dayMemos[selectedDate].splice(index, 1); if (!dayMemos[selectedDate].length) delete dayMemos[selectedDate]; saveJson('family-day-memos', dayMemos); openMemoModal(selectedDate); renderDayDetail(); }
function saveMemo() { const text = $('#memoText').value.trim(); if (!text) return; const memos = dayMemos[selectedDate] || (dayMemos[selectedDate] = []); const index = Number($('#memoEditIndex').value); const memo = { writer: $('#memoWriter').value, text }; if (index >= 0) memos[index] = memo; else memos.push(memo); saveJson('family-day-memos', dayMemos); openMemoModal(selectedDate); renderDayDetail(); }
function resetMemoForm() { $('#memoWriter').value = members[0]; $('#memoText').value = ''; $('#memoEditIndex').value = '-1'; }

async function loadAirQuality() { try { const now = new Date(); const searchDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`; const params = new URLSearchParams({ serviceKey: airServiceKey, pageNo: '1', numOfRows: '1', searchDate, dataType: 'JSON' }); const response = await fetch(`${airApiUrl}?${params}`); if (!response.ok) throw new Error('air response'); const item = (await response.json())?.response?.body?.items?.[0]; const pm = Number.parseInt(item?.pm10Value, 10); if (Number.isNaN(pm)) throw new Error('PM10 missing'); const level = pm <= 30 ? ['좋음', 20] : pm <= 80 ? ['보통', 55] : pm <= 150 ? ['나쁨', 82] : ['매우 나쁨', 100]; $('#pmValue').textContent = pm; $('#airBadge').textContent = level[0]; $('#airMeter').style.width = `${level[1]}%`; $('#airNote').textContent = `${item.stationName || '양주 측정소'} · ${item.dataTime || searchDate}`; } catch { $('#airNote').textContent = '대기정보를 불러오지 못했어요. API 키 또는 CORS를 확인해주세요.'; $('#airBadge').textContent = '연결 대기'; } }
function getForecastDate() { const date = new Date(); if (date.getHours() < 6) date.setDate(date.getDate() - 1); return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`; }
function parseWeatherText(text) { const row = text.split(/\r?\n/).find((line) => line.trim().startsWith('11B20304')); if (!row) return null; const values = row.trim().split(/\s+/); return { temperature: values.find((value) => /^-?\d+(\.\d+)?$/.test(value)), sky: values.find((value) => /^DB0\d$/.test(value)), rain: values.find((value) => /^[0-4]$/.test(value)) }; }
async function loadWeather() { try { const date = getForecastDate(); const params = new URLSearchParams({ reg: '11B20304', tmfc1: `${date}0000`, tmfc2: `${date}2359`, disp: '0', help: '1', authKey: kmaAuthKey }); const response = await fetch(`${kmaApiUrl}?${params}`); if (!response.ok) throw new Error('weather response'); const parsed = parseWeatherText(await response.text()); if (!parsed?.temperature) throw new Error('temperature missing'); const skyNames = { DB01: '맑음', DB02: '구름 조금', DB03: '구름 많음', DB04: '흐림' }; const rainNames = { 0: '없음', 1: '비', 2: '비/눈', 3: '눈', 4: '소나기' }; $('#temperature').textContent = `${Math.round(Number(parsed.temperature))}°`; $('#skyStatus').textContent = skyNames[parsed.sky] || '확인됨'; $('#rainStatus').textContent = rainNames[parsed.rain] || '없음'; $('#weatherIcon').textContent = parsed.sky === 'DB04' ? '☁' : '☀'; $('#weatherNote').textContent = `기상청 단기 육상정보 · ${date} 발표`; } catch { try { const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.785&longitude=127.045&current=temperature_2m,weather_code,precipitation&timezone=Asia%2FSeoul'); if (!response.ok) throw new Error('fallback weather response'); const current = (await response.json()).current; const weatherCode = Number(current.weather_code); $('#temperature').textContent = `${Math.round(Number(current.temperature_2m))}°`; $('#skyStatus').textContent = weatherCode === 0 ? '맑음' : weatherCode <= 3 ? '구름 많음' : '흐림'; $('#rainStatus').textContent = Number(current.precipitation) > 0 ? '비' : '없음'; $('#weatherIcon').textContent = weatherCode > 3 ? '☁' : '☀'; $('#weatherNote').textContent = '양주 현재 날씨 · 대체 조회'; } catch { $('#weatherNote').textContent = '기상정보를 불러오지 못했어요. 잠시 후 다시 확인해주세요.'; } } }
function setup() { $('#todayLabel').textContent = displayDate(today); $('#memoWriter').innerHTML = members.map((member) => `<option>${member}</option>`).join(''); $('#closeBucketModal').addEventListener('click', () => $('#bucketModal').close()); $('#closeAllBuckets').addEventListener('click', () => $('#allBucketModal').close()); $('#closeDayModal').addEventListener('click', () => $('#dayModal').close()); $('#openAllBuckets').addEventListener('click', openAllBuckets); $('#saveBucket').addEventListener('click', saveBucket); $('#saveMemo').addEventListener('click', saveMemo); $('#prevMonth').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); }); $('#nextMonth').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); }); renderMembers(); renderCalendar(); loadAirQuality(); loadWeather(); }
setup();
