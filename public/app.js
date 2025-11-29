import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp, getDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";
import { firebaseConfig } from "/config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const logEl = document.getElementById('log');
function showLog(message, type = 'info') { if (!logEl) return; logEl.textContent = message; logEl.className = `log ${type}`; logEl.style.display = 'block'; setTimeout(() => { logEl.style.display = 'none'; }, 5000); }
console.log('[App] Firebase initialized for project:', firebaseConfig.projectId);

const signInForm = document.querySelector('#signinForm');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const button = signInForm.querySelector('button');
const title = document.querySelector('.title');

const tabs = document.querySelectorAll('.tab');
const signUpForm = document.querySelector('#signupForm');
const signUpBtn = signUpForm.querySelector('button');
const categories = document.querySelector('.categories');
let isSavingProfile = false;

// Photo upload elements
const photoFileInput = document.querySelector('#suPhotoFile');
const photoUploadLabel = document.querySelector('.photo-upload-label');
const photoPreview = document.querySelector('#photoPreview');
const previewImage = document.querySelector('#previewImage');
const removePhotoBtn = document.querySelector('#removePhoto');
let selectedPhotoFile = null;

// Photo upload handlers
photoUploadLabel.addEventListener('click', () => {
  photoFileInput.click();
});

photoFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      photoPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
});

removePhotoBtn.addEventListener('click', () => {
  selectedPhotoFile = null;
  photoFileInput.value = '';
  photoPreview.style.display = 'none';
});

// Upload photo to Firebase Storage
async function uploadPhotoToStorage(file, uid) {
  const fileName = `profiles/${uid}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, fileName);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.getAttribute('data-target');
    // let CSS classes control visibility; clear inline styles
    signInForm.style.removeProperty('display');
    signUpForm.style.removeProperty('display');
    signInForm.classList.toggle('hidden', target !== 'signin');
    signUpForm.classList.toggle('hidden', target !== 'signup');
    if (categories) categories.classList.toggle('hidden', target === 'signup');
  });
});

// open signup by URL param ?mode=signup
const params = new URLSearchParams(location.search);
if (params.get('mode') === 'signup') {
  const t = Array.from(tabs).find(x => x.dataset.target === 'signup');
  if (t) t.click();
}
// removed debug write button

signInForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  button.disabled = true;
  button.textContent = 'Вход...';
  try {
    console.log('[Auth] Sign in attempt for', emailInput.value.trim());
    await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    console.log('[Auth] Sign in success');
  } catch (err) {
    console.error('Sign in error', err);
    showLog(err.message || 'Ошибка входа', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Войти';
  }
});

signUpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  signUpBtn.disabled = true;
  signUpBtn.textContent = 'Сохранение...';
  isSavingProfile = true;
  const profile = {
    name: document.querySelector('#suName').value.trim(),
    role: document.querySelector('#suRole').value.trim(),
    city: document.querySelector('#suCity').value.trim(),
    phone: document.querySelector('#suPhone').value.trim(),
    desc: document.querySelector('#suDesc').value.trim(),
    tags: (document.querySelector('#suTags').value || '').split(',').map(s => s.trim()).filter(Boolean),
    photo: 'https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_640.png' // Default user icon
  };
  const email = document.querySelector('#suEmail').value.trim();
  const password = document.querySelector('#suPassword').value;
  try {
    // Ensure the user exists in Firebase Auth; create if not signed in
    let uid = auth.currentUser ? auth.currentUser.uid : null;
    let userEmail = auth.currentUser ? (auth.currentUser.email || email) : email;
    if (!uid) {
      console.log('[Auth] Creating user for', userEmail);
      const cred = await createUserWithEmailAndPassword(auth, userEmail, password);
      uid = cred.user.uid;
      userEmail = cred.user.email || userEmail;
      console.log('[Auth] Created user uid', uid);
    }

    const data = {
      uid,
      email: userEmail,
      ...profile,
      createdAt: serverTimestamp()
    };

    // Upload photo if selected
    if (selectedPhotoFile) {
      try {
        data.photo = await uploadPhotoToStorage(selectedPhotoFile, uid);
        console.log('[Storage] Photo uploaded successfully:', data.photo);
      } catch (error) {
        console.error('[Storage] Photo upload failed:', error);
        showLog('Ошибка загрузки фотографии, используется фото по умолчанию', 'error');
      }
    }

    await setDoc(doc(db, 'profiles', uid), data, { merge: true });
    console.log('[Profiles] Upserted profile for uid', uid, data);
    showLog('Профиль сохранен. Перенаправление…', 'info');
    // redirect immediately; auth listener will also redirect but do it eagerly
    window.location.href = '/discover.html';
  } catch (err) {
    console.error('Signup/profile save error', err);
    const msg = err.code === 'permission-denied'
      ? 'Нет разрешения на запись профиля. Пожалуйста, обновите правила Firestore, чтобы разрешить аутентифицированным пользователям записывать в profiles/{uid}.'
      : (err.code ? `${err.code}: ${err.message}` : err.message);
    showLog(msg, 'error');
  } finally {
    signUpBtn.disabled = false;
    signUpBtn.textContent = 'Создать аккаунт';
    // Allow auth state redirect again
    setTimeout(() => { isSavingProfile = false; }, 500);
  }
});

onAuthStateChanged(auth, async (user) => {
  console.log('[Auth] State changed. User:', user ? user.uid : null);
  if (user) {
    if (isSavingProfile) { console.log('[Auth] Redirect deferred while saving profile'); return; }
    window.location.href = '/discover.html';
  } else {
    title.textContent = 'Collabster';
    // do not force inline display; tabs control visibility
  }
});


