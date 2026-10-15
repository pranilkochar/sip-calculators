/* Firebase placeholder integration + small topbar sign-in UI */

/* Placeholders added only; Firebase will be activated when you paste firebaseConfig into window.__FIREBASE_CONFIG */

/* Topbar sign-in UI: inject Sign In / Sign Out button */
(function addTopbarAuthUI(){
  try{
    const topbar = document.querySelector('.topbar');
    if(!topbar) return;
    const authContainer = document.createElement('div');
    authContainer.id = 'authContainer';
    authContainer.style.display = 'flex';
    authContainer.style.alignItems = 'center';
    authContainer.style.gap = '10px';

    const signBtn = document.createElement('button');
    signBtn.id = 'signBtn';
    signBtn.textContent = 'Sign in (cloud)';
    signBtn.style.padding = '8px 10px';
    signBtn.style.borderRadius = '10px';
    signBtn.style.border = '0';
    signBtn.style.cursor = 'pointer';
    signBtn.style.background = 'linear-gradient(135deg,var(--primary),var(--primary-2))';
    signBtn.style.color = '#fff';

    authContainer.appendChild(signBtn);
    topbar.appendChild(authContainer);

    signBtn.addEventListener('click', () => {
      alert('Cloud sign-in not configured. To enable cross-device profiles, follow the instructions in the README to add Firebase config.');
    });
  }catch(e){console.error(e)}
})();
