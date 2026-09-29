const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}
const db = admin.firestore();
const key = n => String(n || '').trim().toLowerCase().replace(/[\/\s]+/g, '_');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { deviceId, type } = req.body || {};
    // Only ever sends what the real board state justifies, so callers can't spam arbitrary messages.
    const snap = await db.doc('deviceBay/main').get();
    const d = ((snap.data() || {}).devices || []).find(x => x.id === deviceId);
    if (!d || d.status !== 'use' || Date.now() - (d.updatedAt || 0) > 120000) return res.json({ sent: 0, reason: 'stale' });

    let title, body;
    if (type === 'request' && d.handoffRequestedBy) {
      title = 'Device requested: ' + d.name;
      body = d.handoffRequestedBy + ' is requesting ' + d.name + '. Release it when you are done.';
    } else if (type === 'accepted') {
      title = 'Handoff request accepted';
      body = d.name + ' has been assigned to you.';
    } else return res.json({ sent: 0 });

    const ref = db.doc('fcmTokens/' + key(d.usedBy));
    const tokens = ((await ref.get()).data() || {}).tokens || [];
    if (!tokens.length) return res.json({ sent: 0, reason: 'no tokens for ' + d.usedBy });

    const r = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
        notification: { tag: (type === 'request' ? 'req-' : 'acc-') + d.id, requireInteraction: true },
        fcmOptions: { link: 'https://qadevicemgmt.vercel.app/' }
      }
    });
    const dead = tokens.filter((t, i) => !r.responses[i].success &&
      /not-registered|invalid-argument|invalid-registration/.test((r.responses[i].error || {}).code || ''));
    if (dead.length) await ref.update({ tokens: admin.firestore.FieldValue.arrayRemove(...dead) });
    res.json({ sent: r.successCount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'failed' });
  }
};
