import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { firebaseConfig } from "./config.js";
import { getFirestore, collection, getDocs, query, limit } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const logEl = document.getElementById('log');
function showLog(message, type='info'){ if(!logEl) return; logEl.textContent = message; logEl.className = `log ${type}`; logEl.style.display = 'block'; setTimeout(()=>{ logEl.style.display='none'; }, 5000); }
console.log('[Discover] Firebase initialized for project:', firebaseConfig.projectId);

// no mock – only data from Firestore; we will show an empty-state if none

async function fetchProfiles(currentUid){
  try {
    const q = query(collection(db, 'profiles'), limit(20));
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

let index = 0;
let profiles = [];

const card = document.getElementById('card');
const dots = document.getElementById('dots');
const yesBtn = document.getElementById('yesBtn');
const noBtn = document.getElementById('noBtn');
const signOutBtn = document.getElementById('signOut');
const profileBtn = document.getElementById('profileBtn');

// Dialog elements
const likeDialog = document.getElementById('likeDialog');
const viewProfileBtn = document.getElementById('viewProfileBtn');
const continueBtn = document.getElementById('continueBtn');

let currentProfile = null;

// Ensure dialog is hidden on page load
if (likeDialog) {
  likeDialog.classList.add('hidden');
  likeDialog.style.display = 'none';
}

signOutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

profileBtn.addEventListener('click', () => {
  window.location.href = '/profile.html';
});

function renderDots(){
  dots.innerHTML = '';
  profiles.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'dot' + (i===index ? ' active' : '');
    dots.appendChild(d);
  });
}

function render(){
  if (!profiles.length){
    card.innerHTML = `
      <div class="body">
        <p class="desc">Пока нет профилей. Создайте один при регистрации, затем возвращайтесь!</p>
      </div>
    `;
    dots.innerHTML='';
    return;
  }
  const p = profiles[index];
  card.innerHTML = `
    <div class="photo" style="background-image:url('${p.photo}')">
      <div class="badge">ⓘ</div>
      <div class="overlay"></div>
      <div class="name">${p.name}</div>
      <div class="meta">${p.role} • ${p.city}</div>
    </div>
    <div class="body">
      <p class="desc">${p.desc}</p>
      <div class="tags">${(p.tags||[]).map(t=>`<span class='tag'>${t}</span>`).join('')}</div>
    </div>
  `;
  renderDots();
}

function next(){
  index = (index + 1) % profiles.length;
  render();
}

// Dialog event handlers
viewProfileBtn.addEventListener('click', () => {
  if (currentProfile) {
    // Store the profile data in sessionStorage to pass to profile page
    sessionStorage.setItem('viewProfile', JSON.stringify(currentProfile));
    // Open profile in new window
    window.open('/profile.html?view=' + currentProfile.uid, '_blank');
  }
  hideDialog();
});

continueBtn.addEventListener('click', () => {
  hideDialog();
  next();
});

// Show dialog function
function showDialog() {
  if (likeDialog) {
    likeDialog.classList.remove('hidden');
    likeDialog.style.display = 'grid';
  }
}

// Hide dialog function
function hideDialog() {
  if (likeDialog) {
    likeDialog.classList.add('hidden');
    likeDialog.style.display = 'none';
  }
}

// Close dialog when clicking on overlay
likeDialog.addEventListener('click', (e) => {
  if (e.target === likeDialog) {
    hideDialog();
  }
});

// Close dialog with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && likeDialog && !likeDialog.classList.contains('hidden')) {
    hideDialog();
  }
});

// Handle like button click
yesBtn.addEventListener('click', () => {
  if (profiles.length > 0) {
    currentProfile = profiles[index];
    showDialog();
  }
});

noBtn.addEventListener('click', next);


onAuthStateChanged(auth, async (user) => {
  console.log('[Discover] Auth state user:', user ? user.uid : null);
  if (!user) {
    window.location.href = '/';
  } else {
    profiles = await fetchProfiles(user.uid);
    index = 0;
    render();
  }
});


