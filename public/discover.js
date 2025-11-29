import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { firebaseConfig } from "./config.js";
import { getFirestore, collection, getDocs, query, limit } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const logEl = document.getElementById('log');
function showLog(message, type = 'info') { if (!logEl) return; logEl.textContent = message; logEl.className = `log ${type}`; logEl.style.display = 'block'; setTimeout(() => { logEl.style.display = 'none'; }, 5000); }
console.log('[Discover] Firebase initialized for project:', firebaseConfig.projectId);

async function fetchProfiles(currentUid) {
  try {
    const q = query(collection(db, 'profiles'), limit(100));
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const filtered = currentUid ? items.filter(p => p.uid !== currentUid) : items;
    console.log('[Discover] Loaded profiles:', items.length, 'after filter:', filtered.length);
    return filtered;
  } catch (e) {
    console.warn('Firestore fetch failed:', e);
    showLog(e.message || 'Не удалось загрузить профили', 'error');
    return [];
  }
}

let profiles = [];
let filteredProfiles = [];

const cardsList = document.getElementById('cardsList');
const searchInput = document.getElementById('searchInput');
const signOutBtn = document.getElementById('signOut');

signOutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

// Filter profiles by search query (tags)
function filterProfiles(query) {
  if (!query.trim()) return profiles;
  const lowerQuery = query.toLowerCase();
  return profiles.filter(p =>
    p.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
    p.role?.toLowerCase().includes(lowerQuery) ||
    p.name?.toLowerCase().includes(lowerQuery)
  );
}

// Render all matching cards in vertical list
function renderCards(profilesToRender) {
  if (!profilesToRender.length) {
    cardsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <p class="empty-text">Специалисты не найдены</p>
        <p class="empty-hint">Попробуйте изменить поисковый запрос</p>
      </div>
    `;
    return;
  }

  cardsList.innerHTML = profilesToRender.map(p => `
    <div class="card" data-uid="${p.uid}">
      <div class="photo" style="background-image:url('${p.photo}')">
        <div class="badge">ⓘ</div>
        <div class="overlay"></div>
        <div class="name">${p.name}</div>
        <div class="meta">${p.role} • ${p.city}</div>
      </div>
      <div class="body">
        <p class="desc">${p.desc}</p>
        <div class="tags">${(p.tags || []).map(t => `<span class='tag'>${t}</span>`).join('')}</div>
      </div>
    </div>
  `).join('');

  // Add click handlers to cards
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const uid = card.getAttribute('data-uid');
      viewProfile(uid);
    });
  });
}

// Navigate to profile
function viewProfile(uid) {
  const profile = profiles.find(p => p.uid === uid);
  if (profile) {
    sessionStorage.setItem('viewProfile', JSON.stringify(profile));
    window.location.href = '/profile.html?view=' + uid;
  }
}

// Search input handler
searchInput.addEventListener('input', (e) => {
  const query = e.target.value;
  filteredProfiles = filterProfiles(query);
  renderCards(filteredProfiles);
});

onAuthStateChanged(auth, async (user) => {
  console.log('[Discover] Auth state user:', user ? user.uid : null);
  if (!user) {
    window.location.href = '/';
  } else {
    profiles = await fetchProfiles(user.uid);
    filteredProfiles = profiles;
    renderCards(filteredProfiles);
  }
});
