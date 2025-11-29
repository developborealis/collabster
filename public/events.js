import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { firebaseConfig } from "/config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const logEl = document.getElementById('log');
function showLog(message, type='info'){ if(!logEl) return; logEl.textContent = message; logEl.className = `log ${type}`; logEl.style.display = 'block'; setTimeout(()=> { logEl.style.display='none'; }, 5000); }
console.log('[Events] Firebase initialized for project:', firebaseConfig.projectId);

const signOutBtn = document.getElementById('signOut');

signOutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  console.log('[Events] Auth state user:', user ? user.uid : null);
  if (!user) {
    window.location.href = '/';
  }
});
