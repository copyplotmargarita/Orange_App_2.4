const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'app-ventas-db' });
const db = admin.firestore();
db.collectionGroup('employees').get().then(s => {
  s.docs.forEach(d => console.log(d.id, d.data()));
}).catch(console.error);
