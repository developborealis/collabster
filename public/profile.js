import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { firebaseConfig } from "/config.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const logEl = document.getElementById('log');
function showLog(message, type = 'info') { if (!logEl) return; logEl.textContent = message; logEl.className = `log ${type}`; logEl.style.display = 'block'; setTimeout(() => { logEl.style.display = 'none'; }, 5000); }

let currentUser = null;
let userProfile = null;

// DOM elements
const signOutBtn = document.getElementById('signOut');
const changePhotoBtn = document.getElementById('changePhotoBtn');
const photoInput = document.getElementById('photoInput');
const profileImage = document.getElementById('profileImage');
const profileName = document.getElementById('profileName');
const profileRole = document.getElementById('profileRole');
const profileCity = document.getElementById('profileCity');

// About section
const editAboutBtn = document.getElementById('editAboutBtn');
const aboutText = document.getElementById('aboutText');
const aboutEdit = document.getElementById('aboutEdit');
const aboutInput = document.getElementById('aboutInput');
const saveAboutBtn = document.getElementById('saveAboutBtn');
const cancelAboutBtn = document.getElementById('cancelAboutBtn');

// Skills section
const editSkillsBtn = document.getElementById('editSkillsBtn');
const skillsDisplay = document.getElementById('skillsDisplay');
const skillsEdit = document.getElementById('skillsEdit');
const skillsInput = document.getElementById('skillsInput');
const saveSkillsBtn = document.getElementById('saveSkillsBtn');
const cancelSkillsBtn = document.getElementById('cancelSkillsBtn');

// Phone section
const editPhoneBtn = document.getElementById('editPhoneBtn');
const phoneText = document.getElementById('phoneText');
const phoneEdit = document.getElementById('phoneEdit');
const phoneInput = document.getElementById('phoneInput');
const savePhoneBtn = document.getElementById('savePhoneBtn');
const cancelPhoneBtn = document.getElementById('cancelPhoneBtn');

// Portfolio section
const addPhotoBtn = document.getElementById('addPhotoBtn');
const portfolioGrid = document.getElementById('portfolioGrid');
const uploadForm = document.getElementById('uploadForm');
const portfolioFile = document.getElementById('portfolioFile');
const uploadPortfolioBtn = document.getElementById('uploadPortfolioBtn');
const cancelUploadBtn = document.getElementById('cancelUploadBtn');

// WhatsApp section
const whatsappBtn = document.getElementById('whatsappBtn');

// Event listeners
signOutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

// Photo upload handlers
changePhotoBtn.addEventListener('click', () => {
  photoInput.click();
});

photoInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    showLog('Пожалуйста, выберите изображение', 'error');
    return;
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showLog('Размер файла не должен превышать 5 МБ', 'error');
    return;
  }

  try {
    changePhotoBtn.disabled = true;
    changePhotoBtn.textContent = '⏳';

    // Upload to Firebase Storage
    const photoUrl = await uploadProfilePhoto(file);

    // Update Firestore
    await updateProfile({ photo: photoUrl });

    // Update UI
    profileImage.src = photoUrl;
    userProfile.photo = photoUrl;

    showLog('Фото профиля обновлено', 'info');
  } catch (error) {
    console.error('Photo upload failed:', error);
    showLog('Ошибка загрузки фото: ' + error.message, 'error');
  } finally {
    changePhotoBtn.disabled = false;
    changePhotoBtn.textContent = '📷';
    photoInput.value = '';
  }
});

editAboutBtn.addEventListener('click', () => {
  aboutEdit.classList.remove('hidden');
  aboutInput.value = userProfile?.about || '';
});

saveAboutBtn.addEventListener('click', async () => {
  const about = aboutInput.value.trim();
  await updateProfile({ about });
  aboutText.textContent = about || 'No description yet. Click edit to add one.';
  aboutEdit.classList.add('hidden');
});

cancelAboutBtn.addEventListener('click', () => {
  aboutEdit.classList.add('hidden');
});

editSkillsBtn.addEventListener('click', () => {
  skillsEdit.classList.remove('hidden');
  skillsInput.value = (userProfile?.tags || []).join(', ');
});

saveSkillsBtn.addEventListener('click', async () => {
  const tags = skillsInput.value.split(',').map(s => s.trim()).filter(Boolean);
  await updateProfile({ tags });
  renderSkills(tags);
  skillsEdit.classList.add('hidden');
});

cancelSkillsBtn.addEventListener('click', () => {
  skillsEdit.classList.add('hidden');
});

editPhoneBtn.addEventListener('click', () => {
  phoneEdit.classList.remove('hidden');
  phoneInput.value = userProfile?.phone || '';
});

savePhoneBtn.addEventListener('click', async () => {
  const phone = phoneInput.value.trim();
  await updateProfile({ phone });
  phoneText.textContent = phone || 'Телефон не указан';
  phoneEdit.classList.add('hidden');

  // Update WhatsApp button visibility
  if (phone) {
    whatsappBtn.style.display = 'flex';
  } else {
    whatsappBtn.style.display = 'none';
  }
});

cancelPhoneBtn.addEventListener('click', () => {
  phoneEdit.classList.add('hidden');
});

addPhotoBtn.addEventListener('click', () => {
  uploadForm.classList.remove('hidden');
});

uploadPortfolioBtn.addEventListener('click', async () => {
  const files = Array.from(portfolioFile.files);
  if (!files.length) return;

  uploadPortfolioBtn.disabled = true;
  uploadPortfolioBtn.textContent = 'Uploading...';

  try {
    const uploadPromises = files.map(file => uploadPortfolioPhoto(file));
    const urls = await Promise.all(uploadPromises);

    const portfolio = [...(userProfile?.portfolio || []), ...urls];
    await updateProfile({ portfolio });

    renderPortfolio(portfolio);
    uploadForm.classList.add('hidden');
    portfolioFile.value = '';
    showLog('Фотографии успешно загружены', 'info');
  } catch (error) {
    console.error('Upload failed:', error);
    showLog('Ошибка загрузки: ' + error.message, 'error');
  } finally {
    uploadPortfolioBtn.disabled = false;
    uploadPortfolioBtn.textContent = 'Загрузить';
  }
});

cancelUploadBtn.addEventListener('click', () => {
  uploadForm.classList.add('hidden');
  portfolioFile.value = '';
});

// WhatsApp button handler
whatsappBtn.addEventListener('click', () => {
  const phone = userProfile?.phone;
  if (!phone) {
    showLog('Номер телефона не указан в профиле', 'error');
    return;
  }

  // Convert phone to international format (remove spaces, dashes, parentheses)
  let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

  // Add country code if not present (assuming Russian number if starts with 8 or 9)
  if (cleanPhone.startsWith('8')) {
    cleanPhone = '7' + cleanPhone.substring(1);
  } else if (cleanPhone.startsWith('9') && cleanPhone.length === 10) {
    cleanPhone = '7' + cleanPhone;
  }

  // Ensure it starts with country code
  if (!cleanPhone.startsWith('+')) {
    cleanPhone = '+' + cleanPhone;
  }

  const whatsappUrl = `https://wa.me/${cleanPhone}`;
  window.open(whatsappUrl, '_blank');
});

async function uploadPortfolioPhoto(file) {
  const fileName = `portfolio/${currentUser.uid}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, fileName);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

async function uploadProfilePhoto(file) {
  const fileName = `profiles/${currentUser.uid}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, fileName);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

async function removePortfolioPhoto(url) {
  try {
    const photoRef = ref(storage, url);
    await deleteObject(photoRef);

    const portfolio = userProfile.portfolio.filter(p => p !== url);
    await updateProfile({ portfolio });
    renderPortfolio(portfolio);
    showLog('Фотография удалена', 'info');
  } catch (error) {
    console.error('Remove failed:', error);
    showLog('Ошибка удаления: ' + error.message, 'error');
  }
}

async function updateProfile(data) {
  const profileRef = doc(db, 'profiles', currentUser.uid);
  await setDoc(profileRef, { ...userProfile, ...data, updatedAt: serverTimestamp() }, { merge: true });
  userProfile = { ...userProfile, ...data };
}

function updatePhotoButtonVisibility(isOwnProfile) {
  if (changePhotoBtn) {
    changePhotoBtn.style.display = isOwnProfile ? 'flex' : 'none';
  }
}

async function loadUserProfile() {
  try {
    const profileRef = doc(db, 'profiles', currentUser.uid);
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists()) {
      userProfile = profileSnap.data();
    } else {
      // Create basic profile if doesn't exist
      userProfile = {
        name: currentUser.displayName || 'Пользователь',
        role: 'Творческий',
        city: 'Неизвестно',
        about: '',
        tags: [],
        portfolio: [],
        photo: 'https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_640.png' // Default user icon
      };
      await updateProfile(userProfile);
    }

    renderProfile();
  } catch (error) {
    console.error('Failed to load profile:', error);
    showLog('Не удалось загрузить профиль', 'error');
  }
}

async function loadOtherUserProfile(uid) {
  try {
    // First try to get from sessionStorage (from discover page)
    const storedProfile = sessionStorage.getItem('viewProfile');
    if (storedProfile) {
      userProfile = JSON.parse(storedProfile);
      sessionStorage.removeItem('viewProfile'); // Clear after use
      renderOtherUserProfile();
      return;
    }

    // Fallback to Firestore
    const profileRef = doc(db, 'profiles', uid);
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists()) {
      userProfile = profileSnap.data();
      renderOtherUserProfile();
    } else {
      showLog('Профиль не найден', 'error');
      setTimeout(() => window.location.href = '/discover.html', 2000);
    }
  } catch (error) {
    console.error('Failed to load other user profile:', error);
    showLog('Не удалось загрузить профиль', 'error');
  }
}

function renderProfile() {
  profileImage.src = userProfile.photo;
  profileName.textContent = userProfile.name;
  profileRole.textContent = userProfile.role;
  profileCity.textContent = userProfile.city;

  aboutText.textContent = userProfile.about || 'Пока нет описания. Нажмите редактировать, чтобы добавить.';
  renderSkills(userProfile.tags || []);
  renderPortfolio(userProfile.portfolio || []);

  // Update phone display
  phoneText.textContent = userProfile.phone || 'Телефон не указан';

  // Show WhatsApp button for own profile if phone is available
  if (userProfile.phone) {
    whatsappBtn.style.display = 'flex';
  } else {
    whatsappBtn.style.display = 'none';
  }

  // Show photo change button on own profile
  updatePhotoButtonVisibility(true);
}

function renderOtherUserProfile() {
  profileImage.src = userProfile.photo;
  profileName.textContent = userProfile.name;
  profileRole.textContent = userProfile.role;
  profileCity.textContent = userProfile.city;

  aboutText.textContent = userProfile.about || 'Описание недоступно.';
  renderSkills(userProfile.tags || []);
  renderPortfolio(userProfile.portfolio || []);

  // Update phone display
  phoneText.textContent = userProfile.phone || 'Телефон не указан';

  // Hide edit buttons for other user's profile
  editAboutBtn.style.display = 'none';
  editSkillsBtn.style.display = 'none';
  editPhoneBtn.style.display = 'none';
  addPhotoBtn.style.display = 'none';

  // Show WhatsApp button for other users if they have phone
  if (userProfile.phone) {
    whatsappBtn.style.display = 'flex';
  } else {
    whatsappBtn.style.display = 'none';
  }

  // Hide photo change button on other user's profile
  updatePhotoButtonVisibility(false);
}

function renderSkills(tags) {
  skillsDisplay.innerHTML = '';
  if (tags.length === 0) {
    skillsDisplay.innerHTML = '<p style="color: #999;">Пока нет навыков. Нажмите редактировать, чтобы добавить.</p>';
    return;
  }

  tags.forEach(tag => {
    const span = document.createElement('span');
    span.className = 'skill-tag';
    span.textContent = tag;
    skillsDisplay.appendChild(span);
  });
}

function renderPortfolio(portfolio) {
  portfolioGrid.innerHTML = '';
  if (portfolio.length === 0) {
    portfolioGrid.innerHTML = '<p style="color: #999; grid-column: 1/-1; text-align: center;">Пока нет фотографий. Нажмите +, чтобы добавить.</p>';
    return;
  }

  // Check if we're viewing own profile or someone else's
  const urlParams = new URLSearchParams(window.location.search);
  const viewUid = urlParams.get('view');
  const isOwnProfile = !viewUid || viewUid === (currentUser?.uid);

  portfolio.forEach((url, index) => {
    const item = document.createElement('div');
    item.className = 'portfolio-item';

    if (isOwnProfile) {
      item.innerHTML = `
        <img src="${url}" alt="Портфолио ${index + 1}" />
        <button class="remove" onclick="removePortfolioPhoto('${url}')">×</button>
      `;
    } else {
      item.innerHTML = `
        <img src="${url}" alt="Портфолио ${index + 1}" />
      `;
    }

    portfolioGrid.appendChild(item);
  });
}

// Make removePortfolioPhoto globally available
window.removePortfolioPhoto = removePortfolioPhoto;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/';
  } else {
    // Check if we're viewing someone else's profile
    const urlParams = new URLSearchParams(window.location.search);
    const viewUid = urlParams.get('view');

    if (viewUid && viewUid !== user.uid) {
      // Viewing someone else's profile
      await loadOtherUserProfile(viewUid);
    } else {
      // Viewing own profile
      currentUser = user;
      await loadUserProfile();
    }
  }
});
