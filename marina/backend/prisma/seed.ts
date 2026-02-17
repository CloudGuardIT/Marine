import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.activityLog.deleteMany();
  await prisma.tractorRequest.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.vessel.deleteMany();
  await prisma.parkingSpot.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.user.deleteMany();

  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword) {
    console.error('SEED_PASSWORD environment variable is required');
    process.exit(1);
  }
  const password = await bcrypt.hash(seedPassword, 10);

  // ─── Users (9 users: 3 admins, 2 operators, 4 customers) ───
  // Naor admin with separate password
  const naorPassword = await bcrypt.hash('Daga', 10);
  const admin0 = await prisma.user.create({
    data: { name: 'נאור', phone: '0501111111', password: naorPassword, role: 'admin' },
  });
  const admin1 = await prisma.user.create({
    data: { name: 'יוסי כהן', phone: '0501234567', password, role: 'admin' },
  });
  const admin2 = await prisma.user.create({
    data: { name: 'רונית שמעון', phone: '0501234568', password, role: 'admin' },
  });
  const operator1 = await prisma.user.create({
    data: { name: 'משה לוי', phone: '0521234567', password, role: 'operator' },
  });
  const operator2 = await prisma.user.create({
    data: { name: 'דוד אברהם', phone: '0531234567', password, role: 'operator' },
  });
  const customer1 = await prisma.user.create({
    data: { name: 'רון ישראלי', phone: '0541234567', password, role: 'customer' },
  });
  const customer2 = await prisma.user.create({
    data: { name: 'שרה גולד', phone: '0551234567', password, role: 'customer' },
  });
  const customer3 = await prisma.user.create({
    data: { name: 'אבי מזרחי', phone: '0541234568', password, role: 'customer' },
  });
  const customer4 = await prisma.user.create({
    data: { name: 'מיכל ברק', phone: '0551234568', password, role: 'customer' },
  });

  console.log('Created 9 users');

  // ─── Zones (keep existing layout as template) ───
  const zoneConfigs = [
    {
      name: 'A',
      color: '#3B82F6',
      polygon: [
        [32.16300, 34.79100],
        [32.16300, 34.79180],
        [32.16240, 34.79180],
        [32.16240, 34.79100],
      ] as [number, number][],
    },
    {
      name: 'B',
      color: '#22C55E',
      polygon: [
        [32.16300, 34.79190],
        [32.16300, 34.79270],
        [32.16240, 34.79270],
        [32.16240, 34.79190],
      ] as [number, number][],
    },
    {
      name: 'C',
      color: '#EAB308',
      polygon: [
        [32.16230, 34.79100],
        [32.16230, 34.79180],
        [32.16180, 34.79180],
        [32.16180, 34.79100],
      ] as [number, number][],
    },
    {
      name: 'D',
      color: '#A855F7',
      polygon: [
        [32.16230, 34.79190],
        [32.16230, 34.79270],
        [32.16180, 34.79270],
        [32.16180, 34.79190],
      ] as [number, number][],
    },
  ];

  const zoneRecords: any[] = [];
  for (const zc of zoneConfigs) {
    const zone = await prisma.zone.create({
      data: { name: zc.name, color: zc.color, polygon: zc.polygon },
    });
    zoneRecords.push(zone);
  }
  console.log(`Created ${zoneRecords.length} zones`);

  // ─── Spots (30 spots, ALL available — no vessels assigned) ───
  function spotsInZone(polygon: [number, number][], rows: number, cols: number) {
    const lats = polygon.map((p) => p[0]);
    const lngs = polygon.map((p) => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latStep = (maxLat - minLat) / (rows + 1);
    const lngStep = (maxLng - minLng) / (cols + 1);
    const result: { lat: number; lng: number }[] = [];
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        result.push({ lat: minLat + latStep * r, lng: minLng + lngStep * c });
      }
    }
    return result;
  }

  const spots: any[] = [];
  const zoneLayouts = [
    { zoneIdx: 0, rows: 3, cols: 3 }, // A: 9 spots
    { zoneIdx: 1, rows: 3, cols: 3 }, // B: 9 spots
    { zoneIdx: 2, rows: 2, cols: 3 }, // C: 6 spots
    { zoneIdx: 3, rows: 2, cols: 3 }, // D: 6 spots
  ];
  let spotNum = 1;

  for (const layout of zoneLayouts) {
    const zone = zoneRecords[layout.zoneIdx];
    const zoneConfig = zoneConfigs[layout.zoneIdx];
    const positions = spotsInZone(zoneConfig.polygon, layout.rows, layout.cols);

    for (let i = 0; i < positions.length && spotNum <= 30; i++) {
      const r = Math.floor(i / layout.cols);
      const c = i % layout.cols;
      const spot = await prisma.parkingSpot.create({
        data: {
          number: `${zone.name}${spotNum.toString().padStart(2, '0')}`,
          zone: zone.name,
          row: r,
          col: c,
          status: 'available',
          width: 3.0 + Math.random() * 1.5,
          length: 8.0 + Math.random() * 4.0,
          lat: positions[i].lat,
          lng: positions[i].lng,
          zoneId: zone.id,
        },
      });
      spots.push(spot);
      spotNum++;
    }
  }
  console.log(`Created ${spots.length} parking spots (all available)`);

  // ─── Vessels (20 vessels, NO spot assignments — all unparked) ───
  const vesselData = [
    { name: 'אריאל', reg: 'IL-001', length: 8.5, type: 'sailboat', owner: customer1.id, status: 'parked' },
    { name: 'נפטון', reg: 'IL-002', length: 12.0, type: 'motorboat', owner: customer1.id, status: 'parked' },
    { name: 'כוכב הים', reg: 'IL-003', length: 6.5, type: 'jetski', owner: customer2.id, status: 'in_water' },
    { name: 'סירנה', reg: 'IL-004', length: 15.0, type: 'yacht', owner: customer2.id, status: 'parked' },
    { name: 'דולפין', reg: 'IL-005', length: 7.0, type: 'motorboat', owner: customer1.id, status: 'parked' },
    { name: 'אודיסאה', reg: 'IL-006', length: 10.0, type: 'sailboat', owner: customer2.id, status: 'in_water' },
    { name: 'פוסידון', reg: 'IL-007', length: 9.0, type: 'motorboat', owner: admin1.id, status: 'parked' },
    { name: 'מרקורי', reg: 'IL-008', length: 11.5, type: 'yacht', owner: admin1.id, status: 'parked' },
    { name: 'אקווה', reg: 'IL-009', length: 5.5, type: 'jetski', owner: customer1.id, status: 'maintenance' },
    { name: 'סאנרייז', reg: 'IL-010', length: 13.0, type: 'motorboat', owner: customer3.id, status: 'parked' },
    { name: 'אטלנטיס', reg: 'IL-011', length: 8.0, type: 'sailboat', owner: customer3.id, status: 'parked' },
    { name: 'זיוס', reg: 'IL-012', length: 14.0, type: 'yacht', owner: admin2.id, status: 'in_water' },
    { name: 'אנקור', reg: 'IL-013', length: 7.5, type: 'motorboat', owner: customer4.id, status: 'parked' },
    { name: 'ברייז', reg: 'IL-014', length: 6.0, type: 'sailboat', owner: customer4.id, status: 'parked' },
    { name: 'קפטן נמו', reg: 'IL-015', length: 16.0, type: 'yacht', owner: customer3.id, status: 'parked' },
    { name: 'וייב', reg: 'IL-016', length: 9.5, type: 'motorboat', owner: customer4.id, status: 'parked' },
    { name: 'הורייזן', reg: 'IL-017', length: 11.0, type: 'sailboat', owner: customer3.id, status: 'parked' },
    { name: 'מרינה', reg: 'IL-018', length: 7.2, type: 'motorboat', owner: customer4.id, status: 'in_water' },
    { name: 'אקספלורר', reg: 'IL-019', length: 18.0, type: 'yacht', owner: admin2.id, status: 'parked' },
    { name: 'ספריי', reg: 'IL-020', length: 5.0, type: 'jetski', owner: customer2.id, status: 'maintenance' },
  ];

  const vessels: any[] = [];
  for (const v of vesselData) {
    const vessel = await prisma.vessel.create({
      data: {
        name: v.name,
        registrationNumber: v.reg,
        length: v.length,
        type: v.type,
        ownerId: v.owner,
        spotId: null,
        status: v.status,
        lastLaunch: v.status === 'in_water' ? new Date(Date.now() - Math.random() * 3600000 * 3) : null,
      },
    });
    vessels.push(vessel);
  }
  console.log(`Created ${vessels.length} vessels (no spot assignments)`);

  // ─── Tractor Requests (5 pending + 3 completed for dashboard stats) ───
  const pendingRequests = [
    { vesselId: vessels[0].id, requesterId: customer1.id, type: 'launch', priority: 2, notes: 'השקה דחופה — טיול מתוכנן' },
    { vesselId: vessels[3].id, requesterId: customer2.id, type: 'launch', priority: 1, notes: 'השקה לטיול שבת' },
    { vesselId: vessels[4].id, requesterId: customer1.id, type: 'retrieve', priority: 0, notes: 'חזרה מהמים — ביתן 3' },
    { vesselId: vessels[9].id, requesterId: customer3.id, type: 'launch', priority: 1, notes: 'השקה לדייג בוקר' },
    { vesselId: vessels[12].id, requesterId: customer4.id, type: 'launch', priority: 0, notes: 'השקה לשייט אחר הצהריים' },
  ];
  for (const r of pendingRequests) {
    await prisma.tractorRequest.create({
      data: {
        ...r,
        status: 'pending',
        createdAt: new Date(Date.now() - Math.random() * 3600000 * 2),
      },
    });
  }

  // Completed tractor requests (for stats)
  const completedRequests = [
    { vesselId: vessels[2].id, requesterId: customer2.id, operatorId: operator1.id, type: 'launch' },
    { vesselId: vessels[5].id, requesterId: customer2.id, operatorId: operator2.id, type: 'launch' },
    { vesselId: vessels[11].id, requesterId: admin2.id, operatorId: operator1.id, type: 'launch' },
  ];
  for (const r of completedRequests) {
    const created = new Date(Date.now() - Math.random() * 86400000 * 3);
    const completed = new Date(created.getTime() + 15 * 60000 + Math.random() * 30 * 60000);
    await prisma.tractorRequest.create({
      data: {
        vesselId: r.vesselId,
        requesterId: r.requesterId,
        operatorId: r.operatorId,
        type: r.type,
        status: 'completed',
        priority: 0,
        createdAt: created,
        acceptedAt: new Date(created.getTime() + 5 * 60000),
        completedAt: completed,
      },
    });
  }
  console.log('Created 5 pending + 3 completed tractor requests');

  // ─── Reservations (6 active, 2 completed) ───
  const now = new Date();
  const reservationData = [
    { vesselId: vessels[0].id, spotId: spots[0].id, startDays: -2, endDays: 5, status: 'active' },
    { vesselId: vessels[3].id, spotId: spots[3].id, startDays: -1, endDays: 10, status: 'active' },
    { vesselId: vessels[6].id, spotId: spots[6].id, startDays: 0, endDays: 7, status: 'active' },
    { vesselId: vessels[9].id, spotId: spots[9].id, startDays: 1, endDays: 14, status: 'active' },
    { vesselId: vessels[12].id, spotId: spots[12].id, startDays: -3, endDays: 4, status: 'active' },
    { vesselId: vessels[15].id, spotId: spots[15].id, startDays: 2, endDays: 9, status: 'active' },
    { vesselId: vessels[1].id, spotId: spots[1].id, startDays: -14, endDays: -3, status: 'completed' },
    { vesselId: vessels[4].id, spotId: spots[4].id, startDays: -10, endDays: -1, status: 'completed' },
  ];
  for (const r of reservationData) {
    await prisma.reservation.create({
      data: {
        vesselId: r.vesselId,
        spotId: r.spotId,
        startDate: new Date(now.getTime() + r.startDays * 86400000),
        endDate: new Date(now.getTime() + r.endDays * 86400000),
        status: r.status,
      },
    });
  }
  console.log('Created 8 reservations');

  // ─── Activity Log (25 entries over the past 7 days) ───
  const activities = [
    // Today
    { userId: admin1.id, vesselId: vessels[2].id, action: 'vessel_launched', details: '"כוכב הים" הושק למים', hoursAgo: 1 },
    { userId: operator1.id, vesselId: vessels[5].id, action: 'vessel_launched', details: '"אודיסאה" הושק למים', hoursAgo: 2 },
    { userId: admin1.id, vesselId: vessels[11].id, action: 'vessel_launched', details: '"זיוס" הושק למים', hoursAgo: 3 },
    { userId: customer1.id, vesselId: vessels[0].id, action: 'tractor_requested', details: 'בקשת השקה ל"אריאל"', hoursAgo: 0.5 },
    { userId: customer2.id, vesselId: vessels[3].id, action: 'tractor_requested', details: 'בקשת השקה ל"סירנה"', hoursAgo: 1.5 },
    { userId: admin1.id, action: 'user_login', details: 'כניסת מנהל למערכת', hoursAgo: 0.2 },
    { userId: operator1.id, vesselId: vessels[8].id, action: 'vessel_maintenance', details: '"אקווה" הועבר לתחזוקה', hoursAgo: 4 },
    { userId: customer3.id, vesselId: vessels[9].id, action: 'tractor_requested', details: 'בקשת השקה ל"סאנרייז"', hoursAgo: 0.8 },
    { userId: operator2.id, action: 'user_login', details: 'כניסת מפעיל למערכת', hoursAgo: 1 },
    // Yesterday
    { userId: operator1.id, vesselId: vessels[17].id, action: 'vessel_launched', details: '"מרינה" הושק למים', hoursAgo: 26 },
    { userId: admin2.id, vesselId: vessels[19].id, action: 'vessel_maintenance', details: '"ספריי" הועבר לתחזוקה', hoursAgo: 28 },
    { userId: customer4.id, vesselId: vessels[12].id, action: 'tractor_requested', details: 'בקשת השקה ל"אנקור"', hoursAgo: 25 },
    { userId: customer1.id, action: 'user_login', details: 'כניסת לקוח למערכת', hoursAgo: 24 },
    { userId: admin1.id, vesselId: vessels[6].id, action: 'vessel_updated', details: '"פוסידון" עודכן', hoursAgo: 30 },
    // 2 days ago
    { userId: operator2.id, vesselId: vessels[1].id, action: 'vessel_retrieved', details: '"נפטון" הוחזר מהמים', hoursAgo: 50 },
    { userId: admin1.id, vesselId: vessels[16].id, action: 'vessel_created', details: '"הורייזן" נוסף למערכת', hoursAgo: 52 },
    { userId: customer2.id, action: 'user_login', details: 'כניסת לקוח למערכת', hoursAgo: 48 },
    // 3-4 days ago
    { userId: operator1.id, vesselId: vessels[13].id, action: 'vessel_retrieved', details: '"ברייז" הוחזר מהמים', hoursAgo: 75 },
    { userId: admin2.id, vesselId: vessels[18].id, action: 'vessel_created', details: '"אקספלורר" נוסף למערכת', hoursAgo: 80 },
    { userId: customer3.id, vesselId: vessels[10].id, action: 'tractor_requested', details: 'בקשת החזרה ל"אטלנטיס"', hoursAgo: 72 },
    { userId: admin1.id, action: 'user_login', details: 'כניסת מנהל למערכת', hoursAgo: 96 },
    // 5-7 days ago
    { userId: operator2.id, vesselId: vessels[7].id, action: 'vessel_launched', details: '"מרקורי" הושק למים', hoursAgo: 120 },
    { userId: customer4.id, vesselId: vessels[15].id, action: 'tractor_requested', details: 'בקשת השקה ל"וייב"', hoursAgo: 140 },
    { userId: admin2.id, vesselId: vessels[14].id, action: 'vessel_updated', details: '"קפטן נמו" עודכן', hoursAgo: 150 },
    { userId: operator1.id, action: 'user_login', details: 'כניסת מפעיל למערכת', hoursAgo: 160 },
  ];

  for (const a of activities) {
    await prisma.activityLog.create({
      data: {
        userId: a.userId,
        vesselId: a.vesselId || null,
        action: a.action,
        details: a.details,
        createdAt: new Date(Date.now() - a.hoursAgo * 3600000),
      },
    });
  }
  console.log(`Created ${activities.length} activity log entries`);

  console.log('\nSeed completed!');
  console.log('────────────────────────');
  console.log('Users: 9 (3 admin, 2 operator, 4 customer)');
  console.log('Zones: 4 (A, B, C, D)');
  console.log('Spots: 30 (all available)');
  console.log('Vessels: 20 (no spot assignments)');
  console.log('Tractor: 5 pending + 3 completed');
  console.log('Reservations: 8 (6 active, 2 completed)');
  console.log('Activity: 25 entries over 7 days');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
