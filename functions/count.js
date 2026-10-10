const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'app-ventas-db'
});

const db = admin.firestore();

async function analyze() {
  try {
    const businessesSnap = await db.collection('businesses').get();
    let businessesCount = businessesSnap.size;
    let employeesCount = 0;

    for (const doc of businessesSnap.docs) {
      const employeesSnap = await db.collection(`businesses/${doc.id}/employees`).get();
      employeesCount += employeesSnap.size;
    }

    console.log(`Negocios totales: ${businessesCount}`);
    console.log(`Empleados totales: ${employeesCount}`);
  } catch (error) {
    console.error("Error connecting:", error.message);
  }
}

analyze();
