import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://arskacukxopovmlzxnli.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_O2MfbHDZOEC6iRu_1oRsqQ_OfMydk58';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const members = ['철이', '순이', '형재', '윤재'];
let memberRecords = members.map((name) => ({ id: name, display_name: name }));
const $ = (selector) => document.querySelector(selector);
const today = new Date();
let calendarDate = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = formatDate(today);
let selectedMember = members[0];
let bucketLists = {};
let dayMemos = {};
let bucketRows = {};
function getMemberRecord(name) { return memberRecords.find((member) => member.display_name === name) || { id: name, display_name: name }; }
function formatDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function displayDate(date) { return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
function normalizeDate(item) { if (item.date) return item.date; if (item.month) return `${today.getFullYear()}-${String(item.month).padStart(2, '0')}-01`; return ''; }
function normalizeMemos(value) { return Object.fromEntries(Object.entries(value).map(([date, memo]) => [date, Array.isArray(memo) ? memo : memo?.text ? [memo] : []])); }
function formatPlannedDate(dateKey) { if (!dateKey) return '날짜 미정'; const date = new Date(`${dateKey}T00:00:00`); return `실행예정: ${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`; }
function normalizePlannedMonth(value) { if (!value) return null; return /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value; }

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
async function deleteBucket(index) {
  const row = bucketRows[selectedMember]?.[index]; if (!row?.id) return;
  const { error } = await supabase.from('family_app_bucket_items').delete().eq('id', row.id);
  if (error) return showDataError(error);
  await loadFamilyData(); openBucketModal(selectedMember);
}
async function toggleBucket(index) {
  const row = bucketRows[selectedMember]?.[index]; if (!row?.id) return;
  const { error } = await supabase.from('family_app_bucket_items').update({ is_completed: !row.is_completed }).eq('id', row.id);
  if (error) return showDataError(error);
  await loadFamilyData(); openBucketModal(selectedMember);
}
async function saveBucket() {
  const text = $('#bucketInput').value.trim(); if (!text) return;
  const index = Number($('#bucketEditIndex').value); const row = bucketRows[selectedMember]?.[index];
  const payload = { member_id: getMemberRecord(selectedMember).id, content: text, planned_month: normalizePlannedMonth($('#bucketDate').value), is_completed: row?.is_completed || false };
  const request = row?.id ? supabase.from('family_app_bucket_items').update(payload).eq('id', row.id) : supabase.from('family_app_bucket_items').insert(payload);
  const { error } = await request; if (error) return showDataError(error);
  $('#bucketInput').value = ''; $('#bucketDate').value = ''; $('#bucketEditIndex').value = '-1'; await loadFamilyData(); openBucketModal(selectedMember);
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
  $('#memoWriter').value = getMemberRecord(members[0]).id; $('#memoText').value = ''; $('#memoEditIndex').value = '-1';
  document.querySelectorAll('.edit-memo').forEach((button) => button.addEventListener('click', () => editMemo(Number(button.dataset.index)))); document.querySelectorAll('.delete-memo').forEach((button) => button.addEventListener('click', () => deleteMemo(Number(button.dataset.index)))); $('#dayModal').showModal();
}
function editMemo(index) { const memo = dayMemos[selectedDate][index]; $('#memoWriter').value = getMemberRecord(memo.writer).id; $('#memoText').value = memo.text; $('#memoEditIndex').value = index; }
async function deleteMemo(index) {
  const memo = dayMemos[selectedDate]?.[index]; if (!memo?.id) return;
  const { error } = await supabase.from('family_app_diary_entries').delete().eq('id', memo.id);
  if (error) return showDataError(error);
  await loadFamilyData(); openMemoModal(selectedDate);
}
async function saveMemo() {
  const text = $('#memoText').value.trim(); if (!text) return;
  const memos = dayMemos[selectedDate] || []; const index = Number($('#memoEditIndex').value); const oldMemo = memos[index];
  const payload = { entry_date: selectedDate, member_id: getMemberRecord($('#memoWriter').value).id, content: text };
  const request = oldMemo?.id ? supabase.from('family_app_diary_entries').update(payload).eq('id', oldMemo.id) : supabase.from('family_app_diary_entries').insert(payload);
  const { error } = await request; if (error) return showDataError(error);
  await loadFamilyData(); openMemoModal(selectedDate); renderDayDetail();
}

function showDataError(error) { console.error('Supabase 오류:', error.message); $('#savedMessage').textContent = `저장 오류: ${error.message}`; }
async function loadFamilyData() {
  const [{ data: buckets, error: bucketError }, { data: memos, error: memoError }] = await Promise.all([
    supabase.from('family_app_bucket_items').select('id, member_id, content, planned_month, is_completed').order('id'),
    supabase.from('family_app_diary_entries').select('id, entry_date, member_id, content').order('entry_date').order('id')
  ]);
  if (bucketError || memoError) { showDataError(bucketError || memoError); return; }
  bucketRows = members.reduce((result, member) => { const memberId = getMemberRecord(member).id; result[member] = (buckets || []).filter((row) => row.member_id === memberId || row.member_id === member); return result; }, {});
  bucketLists = members.reduce((result, member) => { result[member] = (bucketRows[member] || []).map((row) => ({ id: row.id, text: row.content, date: row.planned_month || '', done: Boolean(row.is_completed) })); return result; }, {});
  dayMemos = (memos || []).reduce((result, row) => { const date = row.entry_date; const writer = memberRecords.find((member) => member.id === row.member_id)?.display_name || row.member_id; (result[date] ||= []).push({ id: row.id, writer, text: row.content }); return result; }, {});
  renderMembers(); renderCalendar();
}

async function loadMemberRecords() {
  const { data, error } = await supabase.from('family_app_members').select('id, display_name');
  if (!error && data?.length) memberRecords = data.map((member) => ({ id: member.id, display_name: member.display_name }));
}

async function loadAirQuality() {
  try {
    const { data: item, error } = await supabase.functions.invoke('air-quality', { method: 'GET' });
    if (error) throw error;
    const pm = Number.parseInt(item?.pm10Value ?? item?.pm10, 10);
    if (Number.isNaN(pm)) throw new Error('PM10 missing');
    const level = pm <= 30 ? ['좋음', 20] : pm <= 80 ? ['보통', 55] : pm <= 150 ? ['나쁨', 82] : ['매우 나쁨', 100];
    $('#pmValue').textContent = pm; $('#airBadge').textContent = level[0]; $('#airMeter').style.width = `${level[1]}%`;
    $('#airNote').textContent = `${item.stationName || '양주 측정소'} · ${item.dataTime || ''}`;
  } catch (error) {
    console.error('미세먼지 Edge Function 오류:', error);
    try {
      const response = await fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=37.785&longitude=127.045&current=pm10&timezone=Asia%2FSeoul');
      if (!response.ok) throw new Error(`air fallback ${response.status}`);
      const pm = Number.parseInt((await response.json())?.current?.pm10, 10);
      if (Number.isNaN(pm)) throw new Error('fallback PM10 missing');
      const level = pm <= 30 ? ['좋음', 20] : pm <= 80 ? ['보통', 55] : pm <= 150 ? ['나쁨', 82] : ['매우 나쁨', 100];
      $('#pmValue').textContent = pm; $('#airBadge').textContent = level[0]; $('#airMeter').style.width = `${level[1]}%`;
      $('#airNote').textContent = '양주 PM10 · 대체 조회';
    } catch (fallbackError) {
      console.error('대체 미세먼지 조회 오류:', fallbackError);
      $('#pmValue').textContent = '--'; $('#airBadge').textContent = '연결 대기'; $('#airMeter').style.width = '0%';
      $('#airNote').textContent = '양주 미세먼지 Edge Function이 배포되었는지 확인해주세요.';
    }
  }
}
function getForecastDate() { const date = new Date(); if (date.getHours() < 6) date.setDate(date.getDate() - 1); return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`; }
function parseWeatherText(text) { const row = text.split(/\r?\n/).find((line) => line.trim().startsWith('11B20304')); if (!row) return null; const values = row.trim().split(/\s+/); return { temperature: values.find((value) => /^-?\d+(\.\d+)?$/.test(value)), sky: values.find((value) => /^DB0\d$/.test(value)), rain: values.find((value) => /^[0-4]$/.test(value)) }; }
async function loadWeather() {
  try {
    const { data, error } = await supabase.functions.invoke('weather', { method: 'GET' });
    if (error) throw error;
    renderWeather(data.current || data, '양주 기상정보 · Edge Function');
  } catch (error) {
    console.error('기상정보 Edge Function 오류:', error);
    try {
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.785&longitude=127.045&current=temperature_2m,weather_code,precipitation&timezone=Asia%2FSeoul');
      if (!response.ok) throw new Error(`weather fallback ${response.status}`);
      renderWeather((await response.json()).current, '양주 현재 날씨 · 대체 조회');
    } catch (fallbackError) {
      console.error('대체 날씨 조회 오류:', fallbackError);
      $('#weatherNote').textContent = '양주 기상정보 Edge Function이 배포되었는지 확인해주세요.';
    }
  }
}
function renderWeather(current, note) {
  const weatherCode = Number(current.weather_code ?? current.weatherCode ?? 0);
  const skyNames = { DB01: '맑음', DB02: '구름 조금', DB03: '구름 많음', DB04: '흐림' };
  const rainNames = { 0: '없음', 1: '비', 2: '비/눈', 3: '눈', 4: '소나기' };
  $('#temperature').textContent = `${Math.round(Number(current.temperature_2m ?? current.temperature))}°`;
  $('#skyStatus').textContent = skyNames[current.sky] || (weatherCode === 0 ? '맑음' : weatherCode <= 3 ? '구름 많음' : '흐림');
  $('#rainStatus').textContent = rainNames[current.rain] || (Number(current.precipitation ?? 0) > 0 ? '비' : '없음');
  $('#weatherIcon').textContent = current.sky === 'DB04' || weatherCode > 3 ? '☁' : '☀';
  $('#weatherNote').textContent = note;
}
async function setup() { $('#todayLabel').textContent = displayDate(today); $('#memoWriter').innerHTML = members.map((member) => `<option value="${getMemberRecord(member).id}">${member}</option>`).join(''); $('#closeBucketModal').addEventListener('click', () => $('#bucketModal').close()); $('#closeAllBuckets').addEventListener('click', () => $('#allBucketModal').close()); $('#closeDayModal').addEventListener('click', () => $('#dayModal').close()); $('#openAllBuckets').addEventListener('click', openAllBuckets); $('#saveBucket').addEventListener('click', saveBucket); $('#saveMemo').addEventListener('click', saveMemo); $('#prevMonth').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); }); $('#nextMonth').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); }); renderMembers(); renderCalendar(); await loadMemberRecords(); $('#memoWriter').innerHTML = members.map((member) => `<option value="${getMemberRecord(member).id}">${member}</option>`).join(''); await loadFamilyData(); loadAirQuality(); loadWeather(); }
setup();
