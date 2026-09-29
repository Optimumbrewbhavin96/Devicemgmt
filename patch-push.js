// Usage: node patch-push.js path\to\index.html YOUR_VAPID_KEY
const fs = require('fs');
const [file, vapid] = [process.argv[2], process.argv[3]];
if (!file || !vapid) { console.log('Usage: node patch-push.js path\\to\\index.html YOUR_VAPID_KEY'); process.exit(1); }

let src = fs.readFileSync(file, 'utf8');
const crlf = src.includes('\r\n');
if (crlf) src = src.replace(/\r\n/g, '\n');
const P = [];
const add = (name, o, n) => P.push({ name, o, n });

add('imports',
`import { getFirestore, doc, onSnapshot, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";`,
`import { getFirestore, doc, onSnapshot, setDoc, runTransaction, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
  import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js";`);

add('push helpers',
`  var deviceDocRef = doc(db, "deviceBay", "main");`,
`  var deviceDocRef = doc(db, "deviceBay", "main");

  var VAPID_KEY = '${vapid}';
  var pushMessaging = null;
  async function registerPush(){
    try{
      if(!currentUser || !('serviceWorker' in navigator) || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      var reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      await navigator.serviceWorker.ready;
      if(!pushMessaging) pushMessaging = getMessaging(fbApp);
      var token = await getToken(pushMessaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
      if(token) await setDoc(doc(db, 'fcmTokens', norm(currentUser).replace(/[\\/\\s]+/g, '_')), { tokens: arrayUnion(token) }, { merge: true });
    }catch(e){ console.error('push register failed', e); }
  }
  function pingNotify(id, type){
    try{ fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: id, type: type }) }); }catch(e){}
  }`);

add('register after permission granted',
`      notifyPref = (p === 'granted');
      syncNotifyUI();`,
`      notifyPref = (p === 'granted');
      syncNotifyUI();
      if(notifyPref) registerPush();`);

add('register on load',
`  document.getElementById('notifyBtn').addEventListener('click', function(){`,
`  registerPush();
  document.getElementById('notifyBtn').addEventListener('click', function(){`);

add('register after name set',
`    setIdentity(name);`,
`    setIdentity(name);
    registerPush();`);

add('ping on release',
`      commitDeviceChange(id, mutateMarkFree);
    }else if(act.kind === 'handoff'){`,
`      var hadReq = !!dev.handoffRequestedBy;
      commitDeviceChange(id, mutateMarkFree).then(function(){ if(hadReq) pingNotify(id, 'accepted'); });
    }else if(act.kind === 'handoff'){`);

add('ping on request',
`        commitDeviceChange(id, function(d){ mutateRequestHandoff(d, currentUser); });`,
`        commitDeviceChange(id, function(d){ mutateRequestHandoff(d, currentUser); }).then(function(){ pingNotify(id, 'request'); });`);

add('ping on request (name modal)',
`      commitDeviceChange(pendingId, function(d){ mutateRequestHandoff(d, name); });`,
`      var reqId = pendingId;
      commitDeviceChange(reqId, function(d){ mutateRequestHandoff(d, name); }).then(function(){ pingNotify(reqId, 'request'); });`);

add('ping on release all',
`      await commitDeviceChange(ids[i], mutateMarkFree);`,
`      var hadReq2 = devices.some(function(x){ return x.id === ids[i] && x.handoffRequestedBy; });
      await commitDeviceChange(ids[i], mutateMarkFree);
      if(hadReq2) pingNotify(ids[i], 'accepted');`);

let out = src, bad = [];
for (const p of P) {
  const n = out.split(p.o).length - 1;
  if (n !== 1) { bad.push(p.name + ' (found ' + n + ' times)'); continue; }
  out = out.replace(p.o, () => p.n);
}
if (bad.length) { console.log('NOT patched. No match for:\n - ' + bad.join('\n - ') + '\nNothing was written.'); process.exit(1); }
fs.writeFileSync(file + '.push.bak', crlf ? src.replace(/\n/g, '\r\n') : src);
fs.writeFileSync(file, crlf ? out.replace(/\n/g, '\r\n') : out);
console.log('Done. ' + P.length + ' changes applied.');
