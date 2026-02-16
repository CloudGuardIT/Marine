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
  await prisma.user.deleteMany();

  const password = await bcrypt.hash('marina123', 10);

  // Create users
  const admin = await prisma.user.create({
    data: { name: 'יוסי כהן', phone: '0501234567', password, role: 'admin' },
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

  console.log('Created 5 users');

  // Create 30 parking spots across 4 zones
  const spots: any[] = [];
  const zones = ['A', 'B', 'C', 'D'];
  let spotNum = 1;
  for (const zone of zones) {
    const rows = zone === 'A' ? 3 : zone === 'B' ? 3 : zone === 'C' ? 2 : 2;
    const cols = zone === 'A' ? 3 : zone === 'B' ? 3 : zone === 'C' ? 3 : 3;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (spotNum > 30) break;
        const spot = await prisma.parkingSpot.create({
          data: {
            number: `${zone}${spotNum.toString().padStart(2, '0')}`,
            zone,
            row: r,
            col: c,
            status: 'available',
            width: 3.0 + Math.random() * 1.5,
            length: 8.0 + Math.random() * 4.0,
          },
        });
        spots.push(spot);
        spotNum++;
      }
    }
  }
  console.log(`Created ${spots.length} parking spots`);

  // Create 16 vessels with various statuses
  const vesselData = [
    { name: 'אריאל', reg: 'IL-001', length: 8.5, type: 'sailboat', owner: customer1.id, status: 'parked', spotIdx: 0 },
    { name: 'נפטון', reg: 'IL-002', length: 12.0, type: 'motorboat', owner: customer1.id, status: 'parked', spotIdx: 1 },
    { name: 'כוכב הים', reg: 'IL-003', length: 6.5, type: 'jetski', owner: customer2.id, status: 'in_water', spotIdx: null },
    { name: 'סירנה', reg: 'IL-004', length: 15.0, type: 'yacht', owner: customer2.id, status: 'parked', spotIdx: 3 },
    { name: 'דולפין', reg: 'IL-005', length: 7.0, type: 'motorboat', owner: customer1.id, status: 'parked', spotIdx: 4 },
    { name: 'אודיסאה', reg: 'IL-006', length: 10.0, type: 'sailboat', owner: customer2.id, status: 'in_water', spotIdx: null },
    { name: 'פוסידון', reg: 'IL-007', length: 9.0, type: 'motorboat', owner: admin.id, status: 'parked', spotIdx: 6 },
    { name: 'מרקורי', reg: 'IL-008', length: 11.5, type: 'yacht', owner: admin.id, status: 'parked', spotIdx: 7 },
    { name: 'אקווה', reg: 'IL-009', length: 5.5, type: 'jetski', owner: customer1.id, status: 'maintenance', spotIdx: 8 },
    { name: 'סאנרייז', reg: 'IL-010', length: 13.0, type: 'motorboat', owner: customer2.id, status: 'parked', spotIdx: 9 },
    { name: 'אטלנטיס', reg: 'IL-011', length: 8.0, type: 'sailboat', owner: customer1.id, status: 'parked', spotIdx: 10 },
    { name: 'זיוס', reg: 'IL-012', length: 14.0, type: 'yacht', owner: admin.id, status: 'in_water', spotIdx: null },
    { name: 'אנקור', reg: 'IL-013', length: 7.5, type: 'motorboat', owner: customer2.id, status: 'parked', spotIdx: 12 },
    { name: 'ברייז', reg: 'IL-014', length: 6.0, type: 'sailboat', owner: customer1.id, status: 'parked', spotIdx: 13 },
    { name: 'קפטן נמו', reg: 'IL-015', length: 16.0, type: 'yacht', owner: customer2.id, status: 'parked', spotIdx: 14 },
    { name: 'וייב', reg: 'IL-016', length: 9.5, type: 'motorboat', owner: admin.id, status: 'parked', spotIdx: 15 },
  ];

  const vessels: any[] = [];
  for (const v of vesselData) {
    const spotId = v.spotIdx !== null ? spots[v.spotIdx].id : null;
    const vessel = await prisma.vessel.create({
      data: {
        name: v.name,
        registrationNumber: v.reg,
        length: v.length,
        type: v.type,
        ownerId: v.owner,
        spotId: spotId,
        status: v.status,
        lastLaunch: v.status === 'in_water' ? new Date(Date.now() - Math.random() * 3600000 * 3) : null,
      },
    });
    vessels.push(vessel);

    // Update spot status
    if (spotId) {
      await prisma.parkingSpot.update({
        where: { id: spotId },
        data: { status: v.status === 'maintenance' ? 'maintenance' : 'occupied' },
      });
    }
  }
  console.log(`Created ${vessels.length} vessels`);

  // Create 2 pending tractor requests
  await prisma.tractorRequest.create({
    data: {
      vesselId: vessels[0].id, // אריאל - parked, wants launch
      requesterId: customer1.id,
      type: 'launch',
      priority: 1,
      notes: 'מבקש השקה לשעות הצהריים',
    },
  });

  await prisma.tractorRequest.create({
    data: {
      vesselId: vessels[3].id, // סירנה - parked, wants launch
      requesterId: customer2.id,
      type: 'launch',
      priority: 0,
      notes: 'השקה לטיול שבת',
    },
  });

  console.log('Created 2 pending tractor requests');

  // Create activity log entries
  const activities = [
    { userId: admin.id, vesselId: vessels[2].id, action: 'vessel_launched', details: '"כוכב הים" הושק למים' },
    { userId: operator1.id, vesselId: vessels[5].id, action: 'vessel_launched', details: '"אודיסאה" הושק למים' },
    { userId: admin.id, vesselId: vessels[11].id, action: 'vessel_launched', details: '"זיוס" הושק למים' },
    { userId: customer1.id, vesselId: vessels[0].id, action: 'tractor_requested', details: 'בקשת השקה ל"אריאל"' },
    { userId: customer2.id, vesselId: vessels[3].id, action: 'tractor_requested', details: 'בקשת השקה ל"סירנה"' },
    { userId: admin.id, action: 'user_login', details: 'כניסת מנהל למערכת' },
    { userId: operator1.id, vesselId: vessels[8].id, action: 'vessel_maintenance', details: '"אקווה" הועבר לתחזוקה' },
  ];

  for (const a of activities) {
    await prisma.activityLog.create({
      data: {
        userId: a.userId,
        vesselId: a.vesselId || null,
        action: a.action,
        details: a.details,
        createdAt: new Date(Date.now() - Math.random() * 86400000),
      },
    });
  }
  console.log('Created activity log entries');

  console.log('\nSeed completed!');
  console.log('Admin login: 0501234567 / marina123');
  console.log('Operator login: 0521234567 / marina123');
  console.log('Customer login: 0541234567 / marina123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
