const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'app-ventas-db' });
const db = admin.firestore();
async function run() {
  const snaps = await db.collection('businesses').limit(1).get();
  const bId = snaps.docs[0].id;
  const tSnaps = await db.collection('businesses').doc(bId).collection('turnos').where('ESTADO_TURNO', '==', 'ABIERTO').get();
  tSnaps.forEach(d => console.log(d.data().NOMBRE_USUARIO_LOGUEADO, d.data().NOMBRE_TIENDA));
}
run();
