#!/bin/bash
set -e

BASE="http://localhost:3001/api"
PP='node -pe "JSON.stringify(JSON.parse(require(\"fs\").readFileSync(\"/dev/stdin\",\"utf8\")),null,2)"'

pretty() {
  node -pe "JSON.stringify(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')),null,2)"
}

echo "============================================"
echo "  MARINA API + WORKERS — FULL CURL TEST"
echo "============================================"

# ─────────────────────────────────────
echo ""
echo "━━ 1. HEALTH CHECK ━━"
curl -s $BASE/health | pretty

# ─────────────────────────────────────
echo ""
echo "━━ 2. AUTH: Login (Admin / Operator / Customer) ━━"

ADMIN_TOKEN=$(curl -s $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"0501234567","password":"marina123"}' | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).token")
echo "Admin token:    ${ADMIN_TOKEN:0:30}..."

OP_TOKEN=$(curl -s $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"0521234567","password":"marina123"}' | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).token")
echo "Operator token: ${OP_TOKEN:0:30}..."

CUST_TOKEN=$(curl -s $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"0541234567","password":"marina123"}' | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).token")
echo "Customer token: ${CUST_TOKEN:0:30}..."

# ─────────────────────────────────────
echo ""
echo "━━ 3. AUTH: Get current user (/me) ━━"
curl -s $BASE/auth/me -H "Authorization: Bearer $ADMIN_TOKEN" | pretty

# ─────────────────────────────────────
echo ""
echo "━━ 4. VESSELS: List all vessels (admin) ━━"
curl -s $BASE/vessels -H "Authorization: Bearer $ADMIN_TOKEN" | node -pe "
  const v = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Total vessels: ' + v.length);
  v.forEach(x => console.log('  ' + x.name + ' | ' + x.status + ' | spot: ' + (x.spot?.number || 'none') + ' | owner: ' + x.owner.name));
  ''
"

# ─────────────────────────────────────
echo ""
echo "━━ 5. SPOTS: List parking spots ━━"
curl -s $BASE/spots -H "Authorization: Bearer $ADMIN_TOKEN" | node -pe "
  const s = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const byStatus = {};
  s.forEach(x => { byStatus[x.status] = (byStatus[x.status]||0)+1 });
  console.log('Total spots: ' + s.length);
  Object.entries(byStatus).forEach(([k,v]) => console.log('  ' + k + ': ' + v));
  ''
"

# ─────────────────────────────────────
echo ""
echo "━━ 6. TRACTOR QUEUE: Check current queue ━━"
echo "(Queue assignment worker already auto-assigned pending requests)"
curl -s $BASE/tractor/queue -H "Authorization: Bearer $ADMIN_TOKEN" | node -pe "
  const q = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Queue length: ' + q.length);
  q.forEach(r => console.log('  ' + r.vessel.name + ' | type: ' + r.type + ' | status: ' + r.status + ' | operator: ' + (r.operator?.name || 'none')));
  ''
"

# ─────────────────────────────────────
echo ""
echo "━━ 7. TRACTOR: Complete a request (operator) ━━"
REQ_ID=$(curl -s $BASE/tractor/queue -H "Authorization: Bearer $ADMIN_TOKEN" | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))[0]?.id || ''")
if [ -n "$REQ_ID" ]; then
  echo "Completing request: $REQ_ID"
  curl -s -X PUT "$BASE/tractor/$REQ_ID/complete" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H 'Content-Type: application/json' | node -pe "
    const r = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    console.log('  Vessel: ' + r.vessel?.name + ' | Status: ' + r.status + ' | Vessel now: ' + r.vessel?.status);
    ''
  "
else
  echo "  No requests in queue to complete"
fi

# ─────────────────────────────────────
echo ""
echo "━━ 8. TRACTOR: Create a new request (customer) ━━"
# Find a parked vessel owned by customer with no active request
VESSEL_ID=$(curl -s $BASE/vessels -H "Authorization: Bearer $CUST_TOKEN" | node -pe "
  const v = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const parked = v.find(x => x.status === 'parked');
  console.log(parked?.id || '');
  ''
" | head -1)

if [ -n "$VESSEL_ID" ]; then
  echo "Requesting launch for vessel: $VESSEL_ID"
  curl -s -X POST $BASE/tractor \
    -H "Authorization: Bearer $CUST_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"vesselId\":\"$VESSEL_ID\",\"type\":\"launch\",\"priority\":2,\"notes\":\"בדיקת מערכת\"}" | node -pe "
    const r = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    if (r.error) { console.log('  Error: ' + r.error); } else {
      console.log('  Created request: ' + r.id);
      console.log('  Vessel: ' + r.vessel?.name + ' | Type: ' + r.type + ' | Status: ' + r.status);
    }
    ''
  "

  echo ""
  echo "Waiting 35 seconds for queue-assignment worker to auto-assign..."
  sleep 35

  echo "Checking queue after worker runs:"
  curl -s $BASE/tractor/queue -H "Authorization: Bearer $ADMIN_TOKEN" | node -pe "
    const q = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    q.forEach(r => console.log('  ' + r.vessel.name + ' | status: ' + r.status + ' | operator: ' + (r.operator?.name || 'UNASSIGNED')));
    ''
  "
else
  echo "  No parked vessel available for customer"
fi

# ─────────────────────────────────────
echo ""
echo "━━ 9. REPORTS: Dashboard stats (admin) ━━"
curl -s $BASE/reports/dashboard -H "Authorization: Bearer $ADMIN_TOKEN" | pretty

# ─────────────────────────────────────
echo ""
echo "━━ 10. REPORTS: Vessels by status ━━"
curl -s $BASE/reports/vessels-by-status -H "Authorization: Bearer $ADMIN_TOKEN" | pretty

# ─────────────────────────────────────
echo ""
echo "━━ 11. REPORTS: Spots by zone ━━"
curl -s $BASE/reports/spots-by-zone -H "Authorization: Bearer $ADMIN_TOKEN" | pretty

# ─────────────────────────────────────
echo ""
echo "━━ 12. REPORTS: Tractor stats ━━"
curl -s $BASE/reports/tractor-stats -H "Authorization: Bearer $ADMIN_TOKEN" | pretty

# ─────────────────────────────────────
echo ""
echo "━━ 13. ACTIVITY: Recent activity log ━━"
curl -s "$BASE/activity?limit=10" -H "Authorization: Bearer $ADMIN_TOKEN" | node -pe "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Total entries: ' + d.total);
  d.activities.slice(0,10).forEach(a => console.log('  [' + a.action + '] ' + (a.details || '') + ' — ' + (a.user?.name || 'system')));
  ''
"

# ─────────────────────────────────────
echo ""
echo "━━ 14. SPOT SYNC WORKER TEST ━━"
echo "Corrupting a spot via direct DB update..."
SPOT_TO_CORRUPT=$(curl -s $BASE/spots -H "Authorization: Bearer $ADMIN_TOKEN" | node -pe "
  const s = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const avail = s.find(x => x.status === 'available');
  console.log(avail?.id || '');
  ''
" | head -1)

if [ -n "$SPOT_TO_CORRUPT" ]; then
  sudo -u postgres psql -d marina -q -c "UPDATE parking_spots SET status = 'occupied' WHERE id = '$SPOT_TO_CORRUPT';"
  SPOT_NUM=$(sudo -u postgres psql -d marina -t -A -c "SELECT number FROM parking_spots WHERE id = '$SPOT_TO_CORRUPT';")
  echo "Set spot $SPOT_NUM to 'occupied' (but no vessel there)"
  echo "Before sync: $(sudo -u postgres psql -d marina -t -A -c "SELECT status FROM parking_spots WHERE id = '$SPOT_TO_CORRUPT';")"

  echo "Waiting for spot-sync worker (runs every 3 min)..."
  sleep 185

  echo "After sync: $(sudo -u postgres psql -d marina -t -A -c "SELECT status FROM parking_spots WHERE id = '$SPOT_TO_CORRUPT';")"
fi

# ─────────────────────────────────────
echo ""
echo "━━ 15. FINAL HEALTH CHECK ━━"
curl -s $BASE/health | node -pe "
  const h = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Status: ' + h.status);
  h.workers.forEach(w => console.log('  ' + w.name + ': runs=' + w.runCount + ' errors=' + w.errorCount + ' lastError=' + (w.lastError || 'none')));
  ''
"

echo ""
echo "============================================"
echo "  ALL TESTS COMPLETE"
echo "============================================"
