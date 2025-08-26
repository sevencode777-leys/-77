// ————————————————————————————
// إعدادات عامة ومخازن حالة
// ————————————————————————————
const state = {
  coords: null,
  prayerTimings: null,
  nextPrayer: null,
  qiblaAngle: null,
  deviceHeading: null,
  surahs: [],
  currentSurah: 1,
  currentAyahIndex: 0,
  audioAyahs: [],
  hadithBooks: [],
  hadithBookId: 'bukhari',
  hadithRange: { start: 1, end: 10 }
};

const els = {
  tabs: document.querySelectorAll('.tab'),
  views: document.querySelectorAll('.view'),
  locationLabel: document.getElementById('locationLabel'),
  locateBtn: document.getElementById('locateBtn'),
  gregHijri: document.getElementById('gregHijri'),
  prayerList: document.getElementById('prayerList'),
  nextPrayerName: document.querySelector('#nextPrayer .name'),
  nextPrayerCountdown: document.querySelector('#nextPrayer .countdown'),
  manualForm: document.getElementById('manualLocationForm'),
  cityInput: document.getElementById('cityInput'),
  countryInput: document.getElementById('countryInput'),
  qiblaAngle: document.getElementById('qiblaAngle'),
  deviceHeading: document.getElementById('deviceHeading'),
  qiblaNeedle: document.getElementById('qiblaNeedle'),
  orientBtn: document.getElementById('orientBtn'),
  surahSelect: document.getElementById('surahSelect'),
  translationSelect: document.getElementById('translationSelect'),
  ayahContainer: document.getElementById('ayahContainer'),
  playSurah: document.getElementById('playSurah'),
  audio: document.getElementById('audioPlayer'),
  prevAyah: document.getElementById('prevAyah'),
  nextAyah: document.getElementById('nextAyah'),
  toggleAudio: document.getElementById('toggleAudio'),
  audioLabel: document.getElementById('audioLabel'),
  adhkarMorning: document.getElementById('adhkarMorning'),
  adhkarEvening: document.getElementById('adhkarEvening'),
  adhkarGeneral: document.getElementById('adhkarGeneral'),
  hadithBook: document.getElementById('hadithBook'),
  hadithList: document.getElementById('hadithList'),
  hadithRange: document.getElementById('hadithRange'),
  hadithPrev: document.getElementById('hadithPrev'),
  hadithNext: document.getElementById('hadithNext'),
  todayHijri: document.getElementById('todayHijri'),
  todayGreg: document.getElementById('todayGreg'),
  themeToggle: document.getElementById('themeToggle')
};

// ————————————————————————————
// أدوات مساعدة
// ————————————————————————————
const API = {
  aladhanBase: 'https://api.aladhan.com/v1',
  quranBase: 'https://api.alquran.cloud/v1',
  hadithBase: 'https://api.hadith.gading.dev'
};

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data;
}

function formatTime24to12(t) {
  // t like "04:58"
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'م' : 'ص';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, '0')} ${period}`;
}

function pad(n) { return n.toString().padStart(2, '0'); }

function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function load(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  save('theme', t);
}

function activateTab(targetId) {
  els.tabs.forEach(t => t.classList.toggle('active', t.dataset.target === targetId));
  els.views.forEach(v => v.classList.toggle('active', v.id === targetId));
}

function toDegrees(rad) { return rad * (180 / Math.PI); }
function toRadians(deg) { return deg * (Math.PI / 180); }

// ————————————————————————————
// تبويب الواجهات
// ————————————————————————————
els.tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    activateTab(tab.dataset.target);
  });
});

// ————————————————————————————
// تحديد الموقع: GPS أو يدوي
// ————————————————————————————
async function geolocate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation unsupported'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

async function reverseGeocode(lat, lng) {
  // خدمة مجانية بسيطة عبر OpenStreetMap Nominatim
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=ar`;
  const data = await fetchJSON(url, { headers: { 'User-Agent': 'NoorApp/1.0' } });
  const city = data.address?.city || data.address?.town || data.address?.state || 'موقعك';
  const country = data.address?.country || '';
  return `${city}, ${country}`;
}

async function setLocationByCoords(lat, lng) {
  state.coords = { lat, lng };
  save('coords', state.coords);
  try {
    const label = await reverseGeocode(lat, lng);
    els.locationLabel.textContent = label;
  } catch {
    els.locationLabel.textContent = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  }
  await loadPrayersAndHijri();
  await loadQibla();
}

async function setLocationByCity(city, country) {
  const q = encodeURIComponent(`${city}, ${country}`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&accept-language=ar`;
  const data = await fetchJSON(url, { headers: { 'User-Agent': 'NoorApp/1.0' } });
  if (!data.length) throw new Error('لم يتم العثور على الموقع');
  const { lat, lon } = data[0];
  els.locationLabel.textContent = `${city}, ${country}`;
  await setLocationByCoords(parseFloat(lat), parseFloat(lon));
}

els.locateBtn.addEventListener('click', async () => {
  els.locateBtn.disabled = true;
  try {
    const pos = await geolocate();
    await setLocationByCoords(pos.lat, pos.lng);
  } catch {
    alert('تعذر تحديد الموقع تلقائيًا. استخدم الإدخال اليدوي.');
  } finally {
    els.locateBtn.disabled = false;
  }
});

els.manualForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const city = els.cityInput.value.trim();
  const country = els.countryInput.value.trim();
  if (!city || !country) return alert('أدخل المدينة والدولة');
  try { await setLocationByCity(city, country); }
  catch (e) { alert('تعذر ضبط الموقع: ' + e.message); }
});

// ————————————————————————————
// أوقات الصلاة + التاريخ الهجري
// ————————————————————————————
async function loadPrayersAndHijri() {
  if (!state.coords) return;
  const { lat, lng } = state.coords;
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    method: 2, // جامعة العلوم الإسلامية - كراتشي
    timezonestring: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const url = `${API.aladhanBase}/timings?${params.toString()}`;
  const data = await fetchJSON(url);
  const t = data.data.timings;
  state.prayerTimings = {
    Fajr: t.Fajr, Sunrise: t.Sunrise, Dhuhr: t.Dhuhr, Asr: t.Asr, Maghrib: t.Maghrib, Isha: t.Isha
  };
  // عرض القائمة
  els.prayerList.innerHTML = '';
  Object.entries(state.prayerTimings).forEach(([name, time]) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="name">${name}</span><span class="time">${formatTime24to12(time)}</span>`;
    els.prayerList.appendChild(li);
  });
  // التاريخ الهجري والغريغوري
  const hijri = data.data.date.hijri;
  const greg = data.data.date.gregorian;
  els.gregHijri.textContent = `${greg.weekday.ar} ${greg.date} — ${hijri.weekday.ar} ${hijri.day} ${hijri.month.ar} ${hijri.year}`;
  document.getElementById('todayHijri').textContent = `${hijri.day} ${hijri.month.ar} ${hijri.year} هـ`;
  document.getElementById('todayGreg').textContent = `${greg.date} م`;
  // احسب الصلاة القادمة
  calcNextPrayer();
}

function calcNextPrayer() {
  if (!state.prayerTimings) return;
  const order = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  let upcoming = null;
  for (const name of order) {
    const [hh, mm] = state.prayerTimings[name].split(':').map(Number);
    const dt = new Date();
    dt.setHours(hh, mm, 0, 0);
    if (dt > now || name === 'Isha') { // آخرها العشاء حتى لو مضى وقتها
      upcoming = { name, time: dt }; break;
    }
  }
  state.nextPrayer = upcoming;
  updateCountdown();
}

function updateCountdown() {
  const np = state.nextPrayer;
  if (!np) return;
  els.nextPrayerName.textContent = np.name;
  const update = () => {
    const now = new Date();
    let diff = Math.max(0, np.time - now);
    const h = Math.floor(diff / 3600000); diff -= h*3600000;
    const m = Math.floor(diff / 60000); diff -= m*60000;
    const s = Math.floor(diff / 1000);
    els.nextPrayerCountdown.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
    if (diff <= 0) loadPrayersAndHijri();
  };
  update();
  clearInterval(updateCountdown._t);
  updateCountdown._t = setInterval(update, 1000);
}

// ————————————————————————————
// اتجاه القبلة + بوصلة الجهاز
// ————————————————————————————
async function loadQibla() {
  if (!state.coords) return;
  const { lat, lng } = state.coords;
  const url = `${API.aladhanBase}/qibla/${lat}/${lng}`;
  const data = await fetchJSON(url);
  state.qiblaAngle = data.data.direction; // درجات من الشمال الجغرافي مع عقارب الساعة
  els.qiblaAngle.textContent = state.qiblaAngle.toFixed(1);
  rotateNeedle();
}

function rotateNeedle() {
  // الزاوية المطلوب توجيه الإبرة إليها = زاوية القبلة - اتجاه الجهاز
  const device = state.deviceHeading ?? 0;
  const angle = (state.qiblaAngle ?? 0) - device;
  els.qiblaNeedle.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
}

async function enableOrientation() {
  const handler = (e) => {
    // بعض الأجهزة تستخدم webkitCompassHeading (0 = الشمال، عقارب الساعة)
    let heading = null;
    if (typeof e.webkitCompassHeading === 'number') {
      heading = e.webkitCompassHeading;
    } else if (e.absolute && e.alpha != null) {
      // alpha (0 = الشمال الحقيقي)، نحتاج تصحيح حسب الإطار المرجعي—نستخدم مباشرة كقيمة تقريبية
      heading = 360 - e.alpha;
    }
    if (heading != null) {
      state.deviceHeading = (heading + 360) % 360;
      els.deviceHeading.textContent = state.deviceHeading.toFixed(0);
      rotateNeedle();
    }
  };

  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const resp = await DeviceOrientationEvent.requestPermission();
      if (resp !== 'granted') return alert('لم يتم منح إذن مستشعر الاتجاه.');
      window.addEventListener('deviceorientation', handler, true);
    } catch {
      alert('تعذر تفعيل البوصلة.');
    }
  } else {
    window.addEventListener('deviceorientationabsolute', handler, true);
    window.addEventListener('deviceorientation', handler, true);
  }
}

els.orientBtn.addEventListener('click', enableOrientation);

// ————————————————————————————
// القرآن الكريم: قائمة السور، عرض، ترجمة، صوت
// ————————————————————————————
async function loadSurahList() {
  const data = await fetchJSON(`${API.quranBase}/surah`);
  state.surahs = data.data;
  els.surahSelect.innerHTML = state.surahs
    .map(s => `<option value="${s.number}">${s.number}. ${s.name} — ${s.englishName}</option>`)
    .join('');
  const last = load('surah', 1);
  els.surahSelect.value = last;
  state.currentSurah = parseInt(last, 10);
  await loadSurah(state.currentSurah);
}

async function loadSurah(num) {
  state.currentSurah = num;
  save('surah', num);
  els.ayahContainer.innerHTML = '<div class="subtle">جاري التحميل…</div>';

  const [ar, tr, au] = await Promise.all([
    fetchJSON(`${API.quranBase}/surah/${num}/quran-uthmani`).then(r => r.data.ayahs),
    (async () => {
      const ed = els.translationSelect.value;
      if (ed === 'none') return null;
      const res = await fetchJSON(`${API.quranBase}/surah/${num}/${ed}`);
      return res.data.ayahs;
    })(),
    fetchJSON(`${API.quranBase}/surah/${num}/ar.alafasy`).then(r => r.data.ayahs)
  ]);

  state.audioAyahs = au.map(a => a.audio);
  renderAyahs(ar, tr);
  setupAudioBar();
}

function renderAyahs(arAyahs, trAyahs) {
  els.ayahContainer.innerHTML = '';
  arAyahs.forEach((a, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'ayah';
    const trans = trAyahs ? `<div class="trans">${trAyahs[i]?.text || ''}</div>` : '';
    wrap.innerHTML = `
      <div class="meta"><span>آية ${a.numberInSurah}</span><button class="btn ghost play-ayah" data-index="${i}"><i class="fa-solid fa-play"></i> استماع</button></div>
      <div class="arabic">${a.text}</div>
      ${trans}
    `;
    els.ayahContainer.appendChild(wrap);
  });
  // أزرار تشغيل الآية
  els.ayahContainer.querySelectorAll('.play-ayah').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentAyahIndex = parseInt(btn.dataset.index, 10);
      playCurrentAyah();
    });
  });
}

els.surahSelect.addEventListener('change', async () => {
  await loadSurah(parseInt(els.surahSelect.value, 10));
});
els.translationSelect.addEventListener('change', async () => {
  await loadSurah(state.currentSurah);
});

function setupAudioBar() {
  els.audio.src = '';
  els.audioLabel.textContent = '—';
  state.currentAyahIndex = 0;
}

function playCurrentAyah() {
  const idx = state.currentAyahIndex;
  const url = state.audioAyahs[idx];
  els.audio.src = url;
  els.audio.play().catch(()=>{});
  els.audioLabel.textContent = `سورة ${state.currentSurah} — آية ${idx + 1}`;
  els.toggleAudio.innerHTML = '<i class="fa-solid fa-pause"></i>';
}

function playNextAyah() {
  if (state.currentAyahIndex < state.audioAyahs.length - 1) {
    state.currentAyahIndex++;
    playCurrentAyah();
  } else {
    els.toggleAudio.innerHTML = '<i class="fa-solid fa-play"></i>';
  }
}

els.audio.addEventListener('ended', playNextAyah);

els.prevAyah.addEventListener('click', () => {
  state.currentAyahIndex = Math.max(0, state.currentAyahIndex - 1);
  playCurrentAyah();
});
els.nextAyah.addEventListener('click', () => {
  state.currentAyahIndex = Math.min(state.audioAyahs.length - 1, state.currentAyahIndex + 1);
  playCurrentAyah();
});
els.toggleAudio.addEventListener('click', () => {
  if (!els.audio.src) {
    playCurrentAyah();
  } else if (els.audio.paused) {
    els.audio.play(); els.toggleAudio.innerHTML = '<i class="fa-solid fa-pause"></i>';
  } else {
    els.audio.pause(); els.toggleAudio.innerHTML = '<i class="fa-solid fa-play"></i>';
  }
});
els.playSurah.addEventListener('click', () => {
  state.currentAyahIndex = 0; playCurrentAyah();
});

// ————————————————————————————
// الأذكار (محلية بدون API)
// ————————————————————————————
const ADHKAR = {
  morning: [
    'أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.',
    'اللهم بك أصبحنا وبك أمسينا وبك نحيا وبك نموت وإليك النشور.',
    'اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك...'
  ],
  evening: [
    'أمسينا وأمسى الملك لله والحمد لله...',
    'اللهم بك أمسينا وبك أصبحنا وبك نحيا وبك نموت وإليك المصير.',
    'أعوذ بكلمات الله التامات من شر ما خلق.'
  ],
  general: [
    'سبحان الله وبحمده، سبحان الله العظيم.',
    'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير (100 مرة).',
    'أستغفر الله وأتوب إليه.'
  ]
};

function renderAdhkar() {
  els.adhkarMorning.innerHTML = ADHKAR.morning.map(x => `<li>${x}</li>`).join('');
  els.adhkarEvening.innerHTML = ADHKAR.evening.map(x => `<li>${x}</li>`).join('');
  els.adhkarGeneral.innerHTML = ADHKAR.general.map(x => `<li>${x}</li>`).join('');
}

// ————————————————————————————
// الأحاديث — Hadith Gading API
// ————————————————————————————
async function loadHadithBooks() {
  const data = await fetchJSON(`${API.hadithBase}/books`);
  state.hadithBooks = data.data;
  els.hadithBook.innerHTML = state.hadithBooks
    .map(b => `<option value="${b.id}">${b.id.toUpperCase()} — ${b.name} (${b.available})</option>`)
    .join('');
  els.hadithBook.value = load('hadithBook', 'bukhari');
  state.hadithBookId = els.hadithBook.value;
  await loadHadithPage();
}

async function loadHadithPage() {
  const { start, end } = state.hadithRange;
  const url = `${API.hadithBase}/books/${state.hadithBookId}?range=${start}-${end}`;
  const data = await fetchJSON(url);
  const hadiths = data.data.hadiths || [];
  els.hadithList.innerHTML = hadiths.map(h => `
    <li>
      <div class="meta">${data.data.name} — حديث رقم ${h.number}</div>
      <div class="text">${h.arab}</div>
    </li>
  `).join('') || '<li>لا توجد بيانات في هذا المدى.</li>';
  els.hadithRange.textContent = `${start}–${end}`;
  save('hadithBook', state.hadithBookId);
}

els.hadithBook.addEventListener('change', async () => {
  state.hadithBookId = els.hadithBook.value;
  state.hadithRange = { start: 1, end: 10 };
  await loadHadithPage();
});
els.hadithPrev.addEventListener('click', async () => {
  const size = 10;
  state.hadithRange = {
    start: Math.max(1, state.hadithRange.start - size),
    end: Math.max(10, state.hadithRange.end - size)
  };
  await loadHadithPage();
});
els.hadithNext.addEventListener('click', async () => {
  const size = 10;
  state.hadithRange = {
    start: state.hadithRange.start + size,
    end: state.hadithRange.end + size
  };
  await loadHadithPage();
});

// ————————————————————————————
// تهيئة عامة + الثيم
// ————————————————————————————
document.getElementById('year').textContent = new Date().getFullYear();

els.themeToggle.addEventListener('click', () => {
  const cur = load('theme', 'dark');
  const next = cur === 'dark' ? 'dark' : 'dark'; // واجهة داكنة افتراضيًا—يمكنك توسيعها لاحقًا
  setTheme(next);
});

(function initTheme() {
  setTheme(load('theme', 'dark'));
})();

async function init() {
  renderAdhkar();
  await loadSurahList();
  await loadHadithBooks();

  const saved = load('coords', null);
  if (saved) {
    await setLocationByCoords(saved.lat, saved.lng);
  } else {
    // تحديد موقع افتراضي: مكة
    await setLocationByCoords(21.3891, 39.8579);
  }
}

init().catch(err => {
  console.error(err);
  alert('حدث خطأ أثناء تهيئة التطبيق.');
});
