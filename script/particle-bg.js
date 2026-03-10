/* ============================================================
   PARTICLE NETWORK PLUGIN — particle-bg.js  v9.2
   ============================================================
   CHANGELOG
   v9.2  – 7-rule communication system (see RULES below)
         – WAN and LAN fully modular (engineTickWAN / engineTickLAN)
         – Complexity presets removed — each network spawns with
           its own random structural parameters
         – Type-diversity spawn system (_pickTopoType) ensures
           all 8 topology types appear before any repeats
         – Minimum 4 networks enforced (rule 6)
         – Network monitor table (bottom-left, rule 7)
         – Rule 1 guaranteed: wanTimer retries until a target
           exists rather than silently consuming first fire
   v9.1  – Per-network WAN timer (every network guaranteed to
           communicate independently of scene size)
         – CFG fully annotated with ranges, sweet spots, and
           dependency warnings (⚠) for safe manual editing
         – Network count increase spawns delta immediately;
           decrease drains naturally without hard reset
         – Canvas injected into document.body to avoid
           contain:layout paint clipping on background-layer
   v9.0  – 7 device shapes, 8 topology variants, WAN backbone
           lines, easter egg control, CRT colour observer
   v8.0  – Initial LAN/WAN network diagram animation
   ============================================================ */

/* ============================================================
   COMMUNICATION RULES
   ─────────────────────────────────────────────────────────
   These 7 rules govern all network behaviour. Each rule is
   annotated at its implementation site with "Rule N".

   WAN (inter-network) rules — implemented in:
     _wanSendFrom()       core send logic
     engineTickWAN()      periodic firing (rules 1 & 2)
     WanPulse.update()    arrival handling (rules 3, 4, 5)

   Rule 1 — On spawn, a network immediately sends a WAN packet
            to another network. wanTimer starts at 9999 so the
            first engineTickWAN check fires instantly. Timer
            only resets on successful send — retries every frame
            until a reachable target exists.

   Rule 2 — Larger networks send more frequently. Effective
            interval scales down with edge count:
            effInterval = WAN_INTERVAL * 10 / edges
            clamped to 240 frames minimum (~4s).
            Small star (5 edges) → full WAN_INTERVAL.
            Hex grid (91 edges)  → ~240f (~4s).

   Rule 3 — On receiving a WAN packet, the destination network
            forwards a new packet onward to a different network
            (40% of arrivals — see rule 4). Implemented in
            WanPulse.update() on t >= 1.

   Rule 4 — 60% of arriving packets terminate at destination.
            40% trigger rule 3 (forward onward). This is a
            convergent geometric series (avg 0.4 children per
            packet) — chains die out naturally in 2–3 hops.

   Rule 5 — The network that sent the original packet is
            excluded from rule 3's target lottery. Prevents
            immediate ping-pong. The pair-cooldown (600 frames)
            further prevents exclusive back-and-forth loops.

   LAN (intra-network) rules — implemented in engineTickLAN():

   Rule 6 — At least 4 different topology types must be visible
            at all times. _pickTopoType() fills missing types
            before allowing repeats. Toggle minimum is also 4.
            Enforced at spawn time — no runtime checks needed.

   Rule 7 — Network monitor table (bottom-left) provides a live
            window into rule 6: shows each network's type, a
            draining life bar, and seconds remaining. Makes the
            diversity logic observable without affecting it.
   ─────────────────────────────────────────────────────────
   LAN activity is independent of all WAN rules. Tweaking any
   WAN parameter (WAN_INTERVAL, BACKBONE_DIST, forward rate)
   has zero effect on internal LAN packet behaviour and vice
   versa. See engineTickWAN() and engineTickLAN().
   ============================================================ */

/* ============================================================
   DEVICE SHAPES (all solid/filled):
     Computer   — small filled square
     Server     — larger filled square
     Router     — filled circle      (WAN gateway)
     Switch     — filled diamond     (LAN hub)
     Miner      — filled hexagon     (mining node)
     Validator  — filled triangle    (full validation node)
     IoT        — filled cross/plus  (micropayment device)

   TOPOLOGY TYPES:
     Small    — star       : router → switch → endpoints
     Medium A — ring       : router + nodes in a ring
     Medium B — tree       : router → servers → computers (binary tree)
     Large A  — hex grid   : hexagonal lattice, up to 6 links per node
     Large B  — dbl ring   : inner + outer ring with spoke bridges
     Large C  — radial     : hub + N arms with cross-links at tips
     Large D  — fat tree   : 2-tier core/aggregate/edge mesh
     Large E  — organic    : proximity MST + extra cross-links

   PACKETS:
     WAN  — large glowing dot, travels router → router
            along dashed backbone lines (brightens on active route)
     LAN  — small dot, travels node → node within a LAN
            along LAN edges; destination node flashes
   ============================================================ */


(function(global){
'use strict';

/* ============================================================
   COLOUR MAP  (ids match crt-modes.js swatch ids)
   ============================================================ */
var PARTICLE_CRT_COLOURS = {
    'default': '#7a8fa8',
    'amber':   '#FFB000',
    'green':   '#00CC44',
    'white':   '#C8D8EE',
    'blue':    '#5599FF',
    'cyan':    '#00CCDD',
};


/* ============================================================
   ██████████████████████████████████████████████████████████
   CONFIG — ALL TUNABLE VALUES, LAYERED BY IMPORTANCE
   ██████████████████████████████████████████████████████████

   TIME NOTE: at 60fps —   60 frames =  1s
                           300 frames =  5s
                          1200 frames = 20s
                          3600 frames = 60s

   RANGE NOTATION:  min → max   (safe sweet spot in brackets)
   ============================================================ */
var CFG = {

    /* ════════════════════════════════════════════════════════
       LAYER 1 — SCENE  (biggest visual impact)
       ════════════════════════════════════════════════════════ */

    MAX_NETWORKS:     6,    /* total simultaneous networks on screen
                               range : 4 → 16  [4–10]
                               ⚠ minimum is 4 (rule 6 — type diversity)
                               ⚠ also set via bottom-right easter egg  */

    OPACITY:         0.8,   /* master canvas opacity
                               range : 0.0 → 1.0  [0.4–0.9]
                               0.0 = invisible,  1.0 = full brightness */

    BACKBONE_DIST:   540,   /* max px between routers for a WAN link
                               range : 150 → 900  [400–650]
                               lower = islands,  higher = everything connected
                               ⚠ affects WAN packet frequency visibly  */

    /* ════════════════════════════════════════════════════════
       LAYER 2 — ANIMATION  (timing & motion feel)
       ════════════════════════════════════════════════════════ */

    /* WAN packets — large glowing dot, router → router */
    WAN_INTERVAL:    400,   /* frames between each network's WAN spawn
                               range : 40 → 600  [80–200]
                               40 = constant stream,  600 = rare events  */
    WAN_SPEED:       300,   /* frames to travel full router→router distance
                               range : 60 → 800  [150–400]
                               60 = very fast,  800 = slow crawl          */
    WAN_TRAIL:        16,   /* trail length behind WAN dot (frames)
                               range : 0 → 40  [8–24]
                               0 = no trail,  40 = long comet tail        */

    /* LAN packets — small dot, node → node within a network */
    LAN_INTERVAL:    240,   /* frames between LAN spawns per network
                               range : 60 → 800  [120–360]
                               60 = very busy,  800 = quiet networks      */
    LAN_SPEED:       400,   /* frames to travel one LAN edge
                               range : 80 → 1000  [200–500]
                               80 = snappy,  1000 = sluggish              */
    LAN_TRAIL:        10,   /* trail length behind LAN dot (frames)
                               range : 0 → 24  [6–16]                     */

    /* Node flash when a packet arrives */
    FLASH_DECAY:     0.030, /* alpha subtracted from flash per frame
                               range : 0.005 → 0.10  [0.015–0.05]
                               0.005 = very long glow,  0.10 = instant    */

    /* Network lifecycle */
    FADE_FRAMES:     240,   /* frames to fade a network in OR out
                               range : 60 → 600  [120–360]
                               60 = abrupt,  600 = very slow dissolve     */
    ALIVE_MIN:      1800,   /* minimum frames a network stays alive
                               range : 600 → 7200  [1200–3600]
                               ⚠ must be less than ALIVE_MAX              */
    ALIVE_MAX:      3200,   /* maximum frames a network stays alive
                               range : 1200 → 10800  [2400–6000]
                               ⚠ must be greater than ALIVE_MIN           */

    /* ════════════════════════════════════════════════════════
       LAYER 3 — TOPOLOGY SIZES  (structural complexity)
       ════════════════════════════════════════════════════════ */

    /* Physical radius of each topology class (px)
       ⚠ keep SIZE_SMALL < SIZE_MEDIUM < SIZE_LARGE
         too large = networks overlap on small screens                    */
    SIZE_SMALL:       85,   /* range : 50 → 150  [70–110]                 */
    SIZE_MEDIUM:     125,   /* range : 80 → 200  [100–160]                */
    SIZE_LARGE:      180,   /* range : 120 → 280  [150–220]               */

    /* Placement budget */
    MARGIN:          160,   /* px kept clear from screen edges
                               range : 60 → 300  [100–200]
                               lower = networks spawn closer to edges     */
    SPAWN_CANDS:      80,   /* candidate positions tried when placing a new
                               network — higher = better spacing but tiny
                               CPU cost at spawn time only
                               range : 20 → 200  [40–100]                 */

    /* ════════════════════════════════════════════════════════
       LAYER 4 — NODE COUNTS PER TOPOLOGY
       ⚠ always keep _MIN ≤ _MAX within each pair
       ════════════════════════════════════════════════════════ */

    /* Small star topology */
    PC_SMALL_MIN:     2,    /* range : 1 → 8    ⚠ ≤ PC_SMALL_MAX          */
    PC_SMALL_MAX:     5,    /* range : 2 → 12   ⚠ ≥ PC_SMALL_MIN          */

    /* Medium ring topology */
    PC_MED_MIN:       5,    /* range : 3 → 12   ⚠ ≤ PC_MED_MAX            */
    PC_MED_MAX:       9,    /* range : 4 → 18   ⚠ ≥ PC_MED_MIN            */

    /* Large E — organic proximity mesh */
    MESH_NODES_MIN:  10,    /* range : 4 → 24   ⚠ ≤ MESH_NODES_MAX        */
    MESH_NODES_MAX:  18,    /* range : 6 → 32   ⚠ ≥ MESH_NODES_MIN        */
    MESH_SRV_MIN:     1,    /* server nodes in mesh
                               range : 0 → 4    ⚠ ≤ MESH_SRV_MAX          */
    MESH_SRV_MAX:     3,    /* range : 1 → 6    ⚠ ≥ MESH_SRV_MIN          */
    MESH_LINKS:       2,    /* extra cross-links per node beyond the MST
                               range : 0 → 4  [1–3]
                               0 = sparse tree,  4 = very dense mesh      */

    /* Large A — hex grid */
    HEX_RINGS:        3,    /* rings of hexagons around the centre node
                               range : 1 → 5  [2–3]
                               1 = 7 nodes,  2 = 19,  3 = 37,  4 = 61
                               ⚠ 4+ is CPU-heavy, keep ≤ 4               */

    /* Large B — double ring */
    DRING_INNER:      6,    /* nodes on inner ring
                               range : 3 → 12  [4–8]
                               ⚠ ≤ DRING_OUTER                            */
    DRING_OUTER:     10,    /* nodes on outer ring
                               range : 4 → 20  [6–14]
                               ⚠ ≥ DRING_INNER                            */

    /* Large C — radial arms */
    RADIAL_ARMS:      6,    /* number of arms radiating from hub
                               range : 3 → 10  [4–8]                      */
    RADIAL_LEN:       3,    /* nodes per arm (not counting hub)
                               range : 1 → 6  [2–4]                       */

    /* Large D — fat tree */
    FATTREE_CORE:     3,    /* fully-connected core servers
                               range : 2 → 6  [2–4]
                               ⚠ core is fully connected: 4 nodes = 6 edges,
                                 6 nodes = 15 edges — keep ≤ 5            */
    FATTREE_AGG:      5,    /* aggregate (validator) nodes around core
                               range : 2 → 10  [3–7]                      */
    FATTREE_EDGE:     3,    /* miner edge nodes hanging off each aggregate
                               range : 1 → 6  [2–4]
                               ⚠ total nodes = CORE + AGG + (AGG×EDGE)
                                 e.g. 3+5+(5×3) = 23 nodes               */

    /* ════════════════════════════════════════════════════════
       LAYER 5 — DEVICE SHAPE SIZES (px)
       all values are the key geometric radius/half-span
       ════════════════════════════════════════════════════════ */

    SZ_COMPUTER:      2.0,  /* small square half-width
                               range : 1.0 → 5.0  [1.5–3.0]              */
    SZ_SERVER:        3.0,  /* large square half-width
                               range : 1.5 → 6.0  [2.0–4.0]
                               ⚠ keep > SZ_COMPUTER for visual hierarchy  */
    SZ_ROUTER:        4.0,  /* circle radius
                               range : 2.0 → 8.0  [3.0–6.0]              */
    SZ_SWITCH:        3.5,  /* diamond half-span
                               range : 2.0 → 7.0  [2.5–5.0]              */
    SZ_MINER:         4.0,  /* hexagon circumradius
                               range : 2.0 → 8.0  [3.0–6.0]              */
    SZ_VALIDATOR:     3.8,  /* triangle circumradius
                               range : 2.0 → 8.0  [3.0–6.0]              */
    SZ_IOT:           2.5,  /* cross arm half-length
                               range : 1.0 → 5.0  [1.5–3.5]              */
};


/* Internal constants — do not edit */
var ST = { FADE_IN:0, ALIVE:1, FADE_OUT:2, DEAD:3 };
var DT = { COMPUTER:0, SERVER:1, ROUTER:2, SWITCH:3, MINER:4, VALIDATOR:5, IOT:6 };


/* ============================================================
   COLOUR HELPERS
   ============================================================ */
var colour = { r:122, g:143, b:168 };

function setColour(hex) {
    var c=(hex||'').trim();
    if(/^#[0-9a-fA-F]{6}$/i.test(c)){
        colour.r=parseInt(c.slice(1,3),16);
        colour.g=parseInt(c.slice(3,5),16);
        colour.b=parseInt(c.slice(5,7),16);
    } else if(/^#[0-9a-fA-F]{3}$/i.test(c)){
        colour.r=parseInt(c[1]+c[1],16);
        colour.g=parseInt(c[2]+c[2],16);
        colour.b=parseInt(c[3]+c[3],16);
    } else {
        try {
            var t=document.createElement('canvas');
            t.width=t.height=1;
            var x=t.getContext('2d');
            x.fillStyle=c; x.fillRect(0,0,1,1);
            var d=x.getImageData(0,0,1,1).data;
            colour.r=d[0];colour.g=d[1];colour.b=d[2];
        } catch(e){}
    }
}
function col(a){ return 'rgba('+colour.r+','+colour.g+','+colour.b+','+a+')'; }
function smooth(t){ t=t<0?0:t>1?1:t; return t*t*(3-2*t); }


/* ============================================================
   DEVICE DRAWING
   flash (0-1) adds a glow — used by both WAN and LAN packets
   ============================================================ */
function drawDevice(ctx, dev, alpha) {
    var a = alpha;
    if (a < 0.005) return;
    var fl = (dev.flash||0) * a;

    /* ── Router — filled circle + arrival glow ─────────── */
    if (dev.type === DT.ROUTER) {
        if (fl > 0.02) {
            var gr = ctx.createRadialGradient(dev.x,dev.y,0,dev.x,dev.y,20+fl*18);
            gr.addColorStop(0, col(fl*0.65));
            gr.addColorStop(1, col(0));
            ctx.beginPath(); ctx.arc(dev.x,dev.y,20+fl*18,0,Math.PI*2);
            ctx.fillStyle=gr; ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(dev.x,dev.y,CFG.SZ_ROUTER,0,Math.PI*2);
        ctx.fillStyle=col(Math.min(1,a+fl*0.55));
        ctx.fill();
        return;
    }

    /* ── Switch — filled diamond + soft glow ───────────── */
    if (dev.type === DT.SWITCH) {
        if (fl > 0.02) {
            var gr = ctx.createRadialGradient(dev.x,dev.y,0,dev.x,dev.y,14+fl*10);
            gr.addColorStop(0, col(fl*0.50));
            gr.addColorStop(1, col(0));
            ctx.beginPath(); ctx.arc(dev.x,dev.y,14+fl*10,0,Math.PI*2);
            ctx.fillStyle=gr; ctx.fill();
        }
        var s=CFG.SZ_SWITCH;
        ctx.beginPath();
        ctx.moveTo(dev.x,    dev.y-s);
        ctx.lineTo(dev.x+s,  dev.y  );
        ctx.lineTo(dev.x,    dev.y+s);
        ctx.lineTo(dev.x-s,  dev.y  );
        ctx.closePath();
        ctx.fillStyle=col(Math.min(1,a*0.85+fl*0.4));
        ctx.fill();
        return;
    }

    /* ── Computer — small filled square + soft glow ────── */
    if (dev.type === DT.COMPUTER) {
        if (fl > 0.02) {
            var gr = ctx.createRadialGradient(dev.x,dev.y,0,dev.x,dev.y,12+fl*8);
            gr.addColorStop(0, col(fl*0.45));
            gr.addColorStop(1, col(0));
            ctx.beginPath(); ctx.arc(dev.x,dev.y,12+fl*8,0,Math.PI*2);
            ctx.fillStyle=gr; ctx.fill();
        }
        var s=CFG.SZ_COMPUTER;
        ctx.fillStyle=col(Math.min(1,a*0.80+fl*0.35));
        ctx.fillRect(dev.x-s,dev.y-s,s*2,s*2);
        return;
    }

    /* ── Server — larger filled square + soft glow ─────── */
    if (dev.type === DT.SERVER) {
        if (fl > 0.02) {
            var gr = ctx.createRadialGradient(dev.x,dev.y,0,dev.x,dev.y,14+fl*10);
            gr.addColorStop(0, col(fl*0.48));
            gr.addColorStop(1, col(0));
            ctx.beginPath(); ctx.arc(dev.x,dev.y,14+fl*10,0,Math.PI*2);
            ctx.fillStyle=gr; ctx.fill();
        }
        var s=CFG.SZ_SERVER;
        ctx.fillStyle=col(Math.min(1,a*0.85+fl*0.35));
        ctx.fillRect(dev.x-s,dev.y-s,s*2,s*2);
        return;
    }

    /* ── Miner — filled hexagon + strong glow ──────────── */
    if (dev.type === DT.MINER) {
        if (fl > 0.02) {
            var gr = ctx.createRadialGradient(dev.x,dev.y,0,dev.x,dev.y,18+fl*14);
            gr.addColorStop(0, col(fl*0.60));
            gr.addColorStop(1, col(0));
            ctx.beginPath(); ctx.arc(dev.x,dev.y,18+fl*14,0,Math.PI*2);
            ctx.fillStyle=gr; ctx.fill();
        }
        var r=CFG.SZ_MINER;
        ctx.beginPath();
        for (var i=0;i<6;i++) {
            var ang = Math.PI/6 + i*Math.PI/3;   /* flat-top orientation */
            var px = dev.x + Math.cos(ang)*r;
            var py = dev.y + Math.sin(ang)*r;
            if (i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath();
        ctx.fillStyle=col(Math.min(1,a*0.88+fl*0.45));
        ctx.fill();
        return;
    }

    /* ── Validator — filled equilateral triangle ────────── */
    if (dev.type === DT.VALIDATOR) {
        if (fl > 0.02) {
            var gr = ctx.createRadialGradient(dev.x,dev.y,0,dev.x,dev.y,16+fl*12);
            gr.addColorStop(0, col(fl*0.55));
            gr.addColorStop(1, col(0));
            ctx.beginPath(); ctx.arc(dev.x,dev.y,16+fl*12,0,Math.PI*2);
            ctx.fillStyle=gr; ctx.fill();
        }
        var r=CFG.SZ_VALIDATOR;
        ctx.beginPath();
        ctx.moveTo(dev.x,              dev.y - r);          /* apex up */
        ctx.lineTo(dev.x + r*0.866,    dev.y + r*0.5);
        ctx.lineTo(dev.x - r*0.866,    dev.y + r*0.5);
        ctx.closePath();
        ctx.fillStyle=col(Math.min(1,a*0.85+fl*0.40));
        ctx.fill();
        return;
    }

    /* ── IoT — filled cross/plus ────────────────────────── */
    if (dev.type === DT.IOT) {
        if (fl > 0.02) {
            var gr = ctx.createRadialGradient(dev.x,dev.y,0,dev.x,dev.y,10+fl*8);
            gr.addColorStop(0, col(fl*0.40));
            gr.addColorStop(1, col(0));
            ctx.beginPath(); ctx.arc(dev.x,dev.y,10+fl*8,0,Math.PI*2);
            ctx.fillStyle=gr; ctx.fill();
        }
        var arm=CFG.SZ_IOT, thick=0.9;
        ctx.fillStyle=col(Math.min(1,a*0.75+fl*0.30));
        ctx.fillRect(dev.x-arm,  dev.y-thick, arm*2, thick*2); /* horizontal */
        ctx.fillRect(dev.x-thick,dev.y-arm,   thick*2, arm*2); /* vertical   */
        return;
    }
}


/* ============================================================
   _pickTopoType — type-diversity topology selector
   ─────────────────────────────────────────────────────────
   8 topology types (0–7). On each spawn:
   1. Find which types are NOT currently alive on screen.
   2. If any missing types exist, pick randomly from those
      (guarantees all types appear before any repeats).
   3. If all 8 types are already present, pick the least
      represented type (fewest live instances), breaking
      ties randomly — prevents any one type dominating.

   This replaces the old PROB_SMALL / PROB_MEDIUM system.
   ============================================================ */
var TOPO_COUNT = 8;
function _pickTopoType() {
    var counts = [];
    var i;
    for(i=0; i<TOPO_COUNT; i++) counts[i]=0;
    sim.networks.forEach(function(n){
        if(n.state !== ST.DEAD && n.topoType !== undefined)
            counts[n.topoType]++;
    });
    /* Types with zero instances — fill gaps first */
    var missing = [];
    for(i=0; i<TOPO_COUNT; i++){ if(counts[i]===0) missing.push(i); }
    if(missing.length > 0)
        return missing[Math.floor(Math.random()*missing.length)];
    /* All types present — pick least-used, random tiebreak */
    var minCount = Math.min.apply(null, counts);
    var leastUsed = [];
    for(i=0; i<TOPO_COUNT; i++){ if(counts[i]===minCount) leastUsed.push(i); }
    return leastUsed[Math.floor(Math.random()*leastUsed.length)];
}


/* ============================================================
   NETWORK CLASS
   ============================================================ */
var sim = { netIdCounter:0, networks:[], pulses:[], frame:0 };

function Network(cx, cy) {
    this.id     = ++sim.netIdCounter;  /* unique identity — used by cooldown map  */
    this.cx    = cx;
    this.cy    = cy;
    this.alpha = 0;
    this.state = ST.FADE_IN;
    this.stf   = 0;
    this.aliveDuration = CFG.ALIVE_MIN +
        Math.floor(Math.random()*(CFG.ALIVE_MAX-CFG.ALIVE_MIN));
    this.devices   = [];
    this.edges     = [];   /* { a, b, t } — precomputed, never changes */
    this.routerIdx = 0;
    this.lanTimer  = Math.floor(Math.random()*CFG.LAN_INTERVAL); /* stagger */
    this.wanTimer         = 0;
    this.wanPendingFirst  = true;  /* rule 1 — fire as soon as a target exists */

    /* Topology type assigned by _pickTopoType() — ensures all 8
       types are represented before any type repeats.
       0=star  1=ring  2=tree  3=hex  4=dring  5=radial  6=fattree  7=mesh */
    this.topoType = _pickTopoType();
    var builders = [
        '_buildSmall', '_buildMediumRing', '_buildMediumTree',
        '_buildHexGrid', '_buildDoubleRing', '_buildRadialArms',
        '_buildFatTree', '_buildMesh'
    ];
    this[builders[this.topoType]]();
}

/* ── Helpers ─────────────────────────────────────────────── */
Network.prototype._add = function(x,y,type) {
    this.devices.push({x:x,y:y,type:type,flash:0});
    return this.devices.length-1;
};
Network.prototype._edge = function(a,b,t) {
    for (var i=0;i<this.edges.length;i++) {
        var e=this.edges[i];
        if((e.a===a&&e.b===b)||(e.a===b&&e.b===a)) return;
    }
    this.edges.push({a:a,b:b,t:t||'access'});
};

/* ── Shared geometry primitives ──────────────────────────────
   Five patterns repeated across all 8 builders, extracted once.
   ──────────────────────────────────────────────────────────── */

/* Return copy of pool sorted ascending by distance from devices[fromIdx] */
Network.prototype._sortByDist = function(fromIdx, pool) {
    var ref = this.devices[fromIdx];
    return pool.slice().sort(function(a, b) {
        var da=this.devices[a], db=this.devices[b];
        return (da.x-ref.x)*(da.x-ref.x)+(da.y-ref.y)*(da.y-ref.y) -
               ((db.x-ref.x)*(db.x-ref.x)+(db.y-ref.y)*(db.y-ref.y));
    }.bind(this));
};

/* Connect fromIdx to its n nearest neighbours in pool */
Network.prototype._connectNearest = function(fromIdx, pool, n, edgeType) {
    var sorted = this._sortByDist(fromIdx, pool);
    for (var i=0; i<Math.min(n, sorted.length); i++)
        this._edge(fromIdx, sorted[i], edgeType||'uplink');
};

/* Place n nodes evenly on a circle; return their device indices */
Network.prototype._placeRing = function(n, radius, rot, type) {
    var idxs = [];
    for (var i=0; i<n; i++) {
        var a = rot + i*(Math.PI*2/n);
        idxs.push(this._add(this.cx+Math.cos(a)*radius, this.cy+Math.sin(a)*radius, type));
    }
    return idxs;
};

/* Connect a ring sequentially, wrapping last node back to first */
Network.prototype._connectRing = function(idxs, edgeType) {
    for (var i=0; i<idxs.length; i++)
        this._edge(idxs[i], idxs[(i+1)%idxs.length], edgeType||'access');
};

/* Place router at network edge (random angle), set routerIdx, return index */
Network.prototype._routerAtEdge = function(size, factor) {
    var ra  = Math.random()*Math.PI*2;
    var idx = this._add(this.cx+Math.cos(ra)*size*factor, this.cy+Math.sin(ra)*size*factor, DT.ROUTER);
    this.routerIdx = idx;
    return idx;
};


/* ── SMALL — star topology ───────────────────────────────── */
Network.prototype._buildSmall = function() {
    var sp = CFG.SIZE_SMALL;
    var sw = this._add(this.cx, this.cy, DT.SWITCH);
    var r  = this._routerAtEdge(sp, 0.72);
    this._edge(r, sw, 'uplink');
    var n  = CFG.PC_SMALL_MIN + Math.floor(Math.random()*(CFG.PC_SMALL_MAX-CFG.PC_SMALL_MIN+1));
    var ra = Math.atan2(this.devices[r].y-this.cy, this.devices[r].x-this.cx);
    for (var i=0; i<n; i++) {
        var a    = ra+Math.PI + (i-(n-1)/2)*(Math.PI*0.75/Math.max(n-1,1));
        var d    = sp*(0.48+Math.random()*0.38);
        var type = Math.random()<0.4 ? DT.IOT : DT.COMPUTER;
        this._edge(sw, this._add(this.cx+Math.cos(a)*d, this.cy+Math.sin(a)*d, type), 'access');
    }
};

/* ── MEDIUM A — ring topology ────────────────────────────── */
Network.prototype._buildMediumRing = function() {
    var sp  = CFG.SIZE_MEDIUM;
    var r   = this._routerAtEdge(sp, 0.72);
    var ra  = Math.atan2(this.devices[r].y-this.cy, this.devices[r].x-this.cx);
    var n   = CFG.PC_MED_MIN + Math.floor(Math.random()*(CFG.PC_MED_MAX-CFG.PC_MED_MIN+1));
    var arc = Math.PI*1.5;
    var ringIdxs = [];
    for (var i=0; i<n; i++) {
        var frac = n>1 ? i/(n-1) : 0.5;
        var a    = ra+Math.PI - arc/2 + frac*arc;
        var jit  = sp*(0.08+Math.random()*0.12);
        var dist = sp*(0.62+Math.random()*0.22);
        var type = i===Math.floor(n/2) ? DT.SERVER : i%3===0 ? DT.VALIDATOR : DT.COMPUTER;
        ringIdxs.push(this._add(
            this.cx+Math.cos(a)*dist + Math.cos(a+Math.PI/2)*jit,
            this.cy+Math.sin(a)*dist + Math.sin(a+Math.PI/2)*jit, type));
    }
    this._connectRing(ringIdxs, 'access');
    this._connectNearest(r, ringIdxs, 2, 'uplink');
};

/* ── MEDIUM B — hierarchical tree topology ───────────────── */
Network.prototype._buildMediumTree = function() {
    var sp  = CFG.SIZE_MEDIUM;
    var r   = this._routerAtEdge(sp, 0.78);
    var ra  = Math.atan2(this.devices[r].y-this.cy, this.devices[r].x-this.cx);
    var agg = [];
    for (var i=0; i<2; i++) {
        var a  = ra+Math.PI + (-0.45+i*0.90);
        var ai = this._add(this.cx+Math.cos(a)*sp*0.40, this.cy+Math.sin(a)*sp*0.40, DT.SERVER);
        agg.push(ai);
        this._edge(r, ai, 'uplink');
    }
    var leafTypes = [DT.COMPUTER, DT.IOT, DT.COMPUTER, DT.IOT, DT.COMPUTER];
    for (var ai=0; ai<agg.length; ai++) {
        var nL = 2+Math.floor(Math.random()*2);
        for (var li=0; li<nL; li++) {
            var spread = (nL-1)*0.28;
            var la = ra+Math.PI + (ai===0?-1:1)*0.55 + (li-(nL-1)/2)*(spread/Math.max(nL-1,1));
            var ld = sp*(0.55+Math.random()*0.25);
            this._edge(agg[ai], this._add(
                this.cx+Math.cos(la)*ld, this.cy+Math.sin(la)*ld,
                leafTypes[li%leafTypes.length]), 'access');
        }
    }
    this._edge(agg[0], agg[1], 'trunk');
};

/* ── LARGE A — hexagonal grid ────────────────────────────── */
Network.prototype._buildHexGrid = function() {
    var sp    = CFG.SIZE_LARGE;
    var rings = CFG.HEX_RINGS;
    var hexSz = Math.floor(sp/(rings+0.5))*0.95;
    var nodeMap = {}, coords = [];
    for (var q=-rings; q<=rings; q++)
        for (var rv=-rings; rv<=rings; rv++)
            if (Math.abs(q)<=rings && Math.abs(rv)<=rings && Math.abs(-q-rv)<=rings)
                coords.push({q:q, r:rv});
    var typePool = [DT.MINER,DT.MINER,DT.VALIDATOR,DT.MINER,DT.MINER,DT.VALIDATOR,DT.IOT];
    for (var i=0; i<coords.length; i++) {
        var q=coords[i].q, r=coords[i].r;
        nodeMap[q+','+r] = this._add(
            this.cx + hexSz*(1.732*q + 0.866*r),
            this.cy + hexSz*1.5*r,
            (q===0&&r===0) ? DT.SWITCH : typePool[i%typePool.length]);
    }
    var hexDirs = [{q:1,r:0},{q:1,r:-1},{q:0,r:-1}]; /* 3 of 6 avoids duplicate edges */
    for (var i=0; i<coords.length; i++) {
        var q=coords[i].q, r=coords[i].r, aIdx=nodeMap[q+','+r];
        for (var d=0; d<hexDirs.length; d++) {
            var key=(q+hexDirs[d].q)+','+(r+hexDirs[d].r);
            if (nodeMap[key]!==undefined)
                this._edge(aIdx, nodeMap[key], (q===0&&r===0)?'uplink':'access');
        }
    }
    var allIdxs = coords.map(function(c){ return nodeMap[c.q+','+c.r]; });
    var r = this._routerAtEdge(sp+hexSz*1.8, 1.0);
    this._connectNearest(r, allIdxs, 1, 'uplink');
};

/* ── LARGE B — double ring ───────────────────────────────── */
Network.prototype._buildDoubleRing = function() {
    var sp  = CFG.SIZE_LARGE;
    var rot = Math.random()*Math.PI*2;
    var inner = this._placeRing(CFG.DRING_INNER, sp*0.38, rot, DT.VALIDATOR);
    this._connectRing(inner, 'trunk');
    var outer = this._placeRing(CFG.DRING_OUTER, sp*0.78, rot, DT.MINER);
    this._connectRing(outer, 'access');
    for (var i=0; i<inner.length; i++) this._connectNearest(inner[i], outer, 2, 'uplink');
    var hub = this._add(this.cx, this.cy, DT.SWITCH);
    for (var i=0; i<inner.length; i++) this._edge(hub, inner[i], 'trunk');
    var r = this._routerAtEdge(sp, 1.18);
    this._connectNearest(r, outer, 2, 'uplink');
};

/* ── LARGE C — radial arms ───────────────────────────────── */
Network.prototype._buildRadialArms = function() {
    var sp    = CFG.SIZE_LARGE;
    var nArms = CFG.RADIAL_ARMS, armLen = CFG.RADIAL_LEN;
    var rot   = Math.random()*Math.PI*2;
    var hub   = this._add(this.cx, this.cy, DT.SWITCH);
    var tipIdxs = [];
    for (var ai=0; ai<nArms; ai++) {
        var armAngle = rot + ai*(Math.PI*2/nArms);
        var prev = hub;
        for (var li=0; li<armLen; li++) {
            var frac = (li+1)/armLen;
            var dist = sp*0.25 + frac*sp*0.68;
            var jit  = (Math.random()-0.5)*sp*0.10;
            var type = li===armLen-1 ? DT.MINER : li===0 ? DT.VALIDATOR : DT.COMPUTER;
            var nIdx = this._add(
                this.cx + Math.cos(armAngle)*dist + Math.cos(armAngle+Math.PI/2)*jit,
                this.cy + Math.sin(armAngle)*dist + Math.sin(armAngle+Math.PI/2)*jit, type);
            this._edge(prev, nIdx, prev===hub ? 'uplink' : 'access');
            prev = nIdx;
        }
        tipIdxs.push(prev);
    }
    this._connectRing(tipIdxs, 'access');   /* cross-link arm tips */
    var raArm    = Math.floor(Math.random()*nArms);
    var tipDev   = this.devices[tipIdxs[raArm]];
    var armAngle = rot + raArm*(Math.PI*2/nArms);
    var rIdx     = this._add(
        tipDev.x + Math.cos(armAngle)*sp*0.22,
        tipDev.y + Math.sin(armAngle)*sp*0.22, DT.ROUTER);
    this.routerIdx = rIdx;
    this._edge(rIdx, tipIdxs[raArm], 'uplink');
};

/* ── LARGE D — fat tree (core/aggregate/edge) ────────────── */
Network.prototype._buildFatTree = function() {
    var sp  = CFG.SIZE_LARGE;
    var rot = Math.random()*Math.PI*2;
    /* Core — fully-connected small cluster */
    var core = this._placeRing(CFG.FATTREE_CORE, sp*0.18, rot, DT.SERVER);
    for (var i=0; i<core.length; i++)
        for (var j=i+1; j<core.length; j++)
            this._edge(core[i], core[j], 'trunk');
    /* Aggregate ring — each connects to 2 nearest core nodes */
    var agg = this._placeRing(CFG.FATTREE_AGG, sp*0.48, rot, DT.VALIDATOR);
    this._connectRing(agg, 'trunk');
    for (var i=0; i<agg.length; i++) this._connectNearest(agg[i], core, 2, 'trunk');
    /* Edge miners hanging off each aggregate */
    var edgeIdxs = [];
    for (var i=0; i<agg.length; i++) {
        var ad       = this.devices[agg[i]];
        var outAngle = Math.atan2(ad.y-this.cy, ad.x-this.cx);
        for (var ei=0; ei<CFG.FATTREE_EDGE; ei++) {
            var spread = (CFG.FATTREE_EDGE-1)*0.30;
            var ea     = outAngle + (ei-(CFG.FATTREE_EDGE-1)/2)*(spread/Math.max(CFG.FATTREE_EDGE-1,1));
            var eIdx   = this._add(ad.x+Math.cos(ea)*sp*0.32, ad.y+Math.sin(ea)*sp*0.32, DT.MINER);
            this._edge(agg[i], eIdx, 'access');
            edgeIdxs.push(eIdx);
        }
    }
    var r = this._routerAtEdge(sp, 0.95);
    this._connectNearest(r, edgeIdxs, 2, 'uplink');
};

/* ── LARGE E — organic proximity mesh ───────────────────── */
Network.prototype._buildMesh = function() {
    var sp       = CFG.SIZE_LARGE;
    var r        = this._routerAtEdge(sp, 0.80);
    var n        = CFG.MESH_NODES_MIN + Math.floor(Math.random()*(CFG.MESH_NODES_MAX-CFG.MESH_NODES_MIN+1));
    var ns       = CFG.MESH_SRV_MIN  + Math.floor(Math.random()*(CFG.MESH_SRV_MAX-CFG.MESH_SRV_MIN+1));
    var typePool = [DT.MINER,DT.VALIDATOR,DT.COMPUTER,DT.MINER,DT.IOT,DT.VALIDATOR,DT.COMPUTER];
    var nodeIdxs = [];
    for (var i=0; i<n; i++) {
        var angle = Math.random()*Math.PI*2;
        var dist  = Math.sqrt(Math.random())*sp*0.88;
        nodeIdxs.push(this._add(
            this.cx+Math.cos(angle)*dist, this.cy+Math.sin(angle)*dist,
            i<ns ? DT.SERVER : typePool[i%typePool.length]));
    }
    /* Prim's MST from router outward */
    var inMST=[r], notIn=nodeIdxs.slice();
    while (notIn.length>0) {
        var bestD=Infinity, bestA=-1, bestB=-1;
        for (var i=0; i<inMST.length; i++) {
            for (var j=0; j<notIn.length; j++) {
                var da=this.devices[inMST[i]], db=this.devices[notIn[j]];
                var dx=da.x-db.x, dy=da.y-db.y, d=dx*dx+dy*dy;
                if (d<bestD){ bestD=d; bestA=inMST[i]; bestB=notIn[j]; }
            }
        }
        if (bestA===-1) break;
        this._edge(bestA, bestB, (bestA===r||bestB===r)?'uplink':'access');
        inMST.push(bestB);
        notIn.splice(notIn.indexOf(bestB),1);
    }
    /* Extra cross-links — use _sortByDist to find nearest neighbours */
    var allIdxs = [r].concat(nodeIdxs);
    for (var i=0; i<nodeIdxs.length; i++) {
        var pool    = allIdxs.filter(function(x){ return x!==nodeIdxs[i]; });
        var nearest = this._sortByDist(nodeIdxs[i], pool);
        for (var k=0; k<Math.min(CFG.MESH_LINKS, nearest.length); k++)
            this._edge(nodeIdxs[i], nearest[k], (nearest[k]===r||nodeIdxs[i]===r)?'uplink':'access');
    }
};

/* ── Lifecycle update ─────────────────────────────────────── */
Network.prototype.update = function() {
    this.stf++;
    if(this.state===ST.FADE_IN){
        this.alpha=smooth(this.stf/CFG.FADE_FRAMES);
        if(this.stf>=CFG.FADE_FRAMES){this.alpha=1;this.state=ST.ALIVE;this.stf=0;}
    } else if(this.state===ST.ALIVE){
        this.alpha=1;
        if(this.stf>=this.aliveDuration){this.state=ST.FADE_OUT;this.stf=0;}
    } else if(this.state===ST.FADE_OUT){
        this.alpha=1-smooth(this.stf/CFG.FADE_FRAMES);
        if(this.stf>=CFG.FADE_FRAMES){this.alpha=0;this.state=ST.DEAD;}
    }
    /* Decay all device flashes */
    for(var i=0;i<this.devices.length;i++){
        this.devices[i].flash=Math.max(0,(this.devices[i].flash||0)-CFG.FLASH_DECAY);
    }
};

Network.prototype.canReceive=function(){return this.state===ST.FADE_IN||this.state===ST.ALIVE;};
Network.prototype.canSend   =function(){return this.state===ST.FADE_IN||this.state===ST.ALIVE;};
Network.prototype.routerPos =function(){
    var r=this.devices[this.routerIdx];
    return r?{x:r.x,y:r.y}:{x:this.cx,y:this.cy};
};


/* ============================================================
   WAN PULSE — large glowing dot, router → router
   forwards=true  → arrival triggers rule 3 (send onward)
   forwards=false → terminates at destination (rule 4)
   ============================================================ */
function WanPulse(fromNet, toNet, forwards) {
    var fp=fromNet.routerPos(), tp=toNet.routerPos();
    this.fromNet=fromNet; this.toNet=toNet;
    this.fx=fp.x; this.fy=fp.y; this.tx=tp.x; this.ty=tp.y;
    this.t=0; this.speed=1/CFG.WAN_SPEED;
    this.alive=true; this.cx=this.fx; this.cy=this.fy;
    this.trail=[]; this.isWan=true;
    this.forwards=(forwards===true);
}
WanPulse.prototype.update=function(){
    if(this.t>0){
        this.trail.push({x:this.cx,y:this.cy});
        if(this.trail.length>CFG.WAN_TRAIL) this.trail.shift();
    }
    this.t+=this.speed;
    if(this.t>=1){
        this.alive=false;
        /* Flash destination router */
        var r=this.toNet.devices[this.toNet.routerIdx];
        if(r) r.flash=1.0;
        /* Rule 3 — receiver forwards onward, excluding original sender
           Rule 5 — fromNet is passed as exclude so it can't be chosen */
        if(this.forwards && this.toNet.canSend()){
            _wanSendFrom(this.toNet, this.fromNet);
        }
        return;
    }
    this.cx=this.fx+(this.tx-this.fx)*this.t;
    this.cy=this.fy+(this.ty-this.fy)*this.t;
};


/* ============================================================
   LAN PULSE — small dot, node → node within one network
   ============================================================ */
function LanPulse(net, edgeIdx, forward) {
    var e   = net.edges[edgeIdx];
    var src = forward ? net.devices[e.a] : net.devices[e.b];
    var dst = forward ? net.devices[e.b] : net.devices[e.a];
    this.net    = net;
    this.dstDev = forward ? e.b : e.a;
    this.fx=src.x; this.fy=src.y; this.tx=dst.x; this.ty=dst.y;
    this.t=0; this.speed=1/CFG.LAN_SPEED;
    this.alive=true; this.cx=this.fx; this.cy=this.fy;
    this.trail=[]; this.isWan=false;
}
LanPulse.prototype.update=function(){
    if(this.t>0){
        this.trail.push({x:this.cx,y:this.cy});
        if(this.trail.length>CFG.LAN_TRAIL) this.trail.shift();
    }
    this.t+=this.speed;
    if(this.t>=1){
        this.alive=false;
        /* Flash destination node */
        var dev=this.net.devices[this.dstDev];
        if(dev) dev.flash=0.85;
        return;
    }
    this.cx=this.fx+(this.tx-this.fx)*this.t;
    this.cy=this.fy+(this.ty-this.fy)*this.t;
};


/* ============================================================
   ENGINE
   ============================================================ */
var scene = { canvas:null, ctx:null, animId:null, layer:null, W:0, H:0 };

function bestSpawn(){
    var M=CFG.MARGIN;
    var live=sim.networks.filter(function(n){return n.state!==ST.DEAD;});
    var best={x:M+Math.random()*(scene.W-M*2),y:M+Math.random()*(scene.H-M*2)};
    var bestD=-1;
    for(var i=0;i<CFG.SPAWN_CANDS;i++){
        var px=M+Math.random()*(scene.W-M*2), py=M+Math.random()*(scene.H-M*2);
        var minD=Infinity;
        for(var j=0;j<live.length;j++){
            var dx=live[j].cx-px,dy=live[j].cy-py;
            minD=Math.min(minD,Math.sqrt(dx*dx+dy*dy));
        }
        if(live.length===0) minD=999999;
        if(minD>bestD){bestD=minD;best={x:px,y:py};}
    }
    return best;
}

function engineInit(){
    scene.W=window.innerWidth; scene.H=window.innerHeight;
    if(!scene.canvas){
        scene.canvas=document.createElement('canvas');
        scene.canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;';
        scene.layer.appendChild(scene.canvas);
        window.addEventListener('resize',function(){
            scene.W=scene.canvas.width=window.innerWidth;
            scene.H=scene.canvas.height=window.innerHeight;
        });
    }
    scene.canvas.width=scene.W; scene.canvas.height=scene.H;
    scene.ctx=scene.canvas.getContext('2d');
    sim.networks=[]; sim.pulses=[]; sim.frame=0; sim.netIdCounter=0;

    var cycle=CFG.FADE_FRAMES*2+CFG.ALIVE_MIN;
    for(var i=0;i<CFG.MAX_NETWORKS;i++){
        var pt=bestSpawn();
        var net=new Network(pt.x,pt.y);
        var off=Math.floor((i/CFG.MAX_NETWORKS)*cycle);
        if(off<=CFG.FADE_FRAMES){
            net.state=ST.FADE_IN; net.stf=off;
            net.alpha=smooth(off/CFG.FADE_FRAMES);
        } else if(off<=CFG.FADE_FRAMES+CFG.ALIVE_MIN){
            net.state=ST.ALIVE; net.stf=off-CFG.FADE_FRAMES; net.alpha=1;
        } else {
            net.state=ST.FADE_OUT;
            net.stf=off-CFG.FADE_FRAMES-CFG.ALIVE_MIN;
            net.alpha=1-smooth(net.stf/CFG.FADE_FRAMES);
        }
        sim.networks.push(net);
    }
}

/* ============================================================
   _wanSendFrom  — core WAN send logic  (rules 1, 2, 3, 5)
   ─────────────────────────────────────────────────────────
   Called by engineTickWAN (rules 1 & 2) and WanPulse.update
   (rule 3). Returns true if a packet was sent, false if no
   reachable target existed this frame.

   net     : the network sending the packet
   exclude : network removed from target lottery (rule 5)
             null for periodic sends (rules 1 & 2)
   ============================================================ */
function _wanSendFrom(net, exclude) {
    if(!net._wanCooldown) net._wanCooldown={};

    /* WAN_PAIR_COOLDOWN — frames before the same pair can
       exchange again.  Prevents two close networks locking
       onto each other exclusively.
       range : 300 → 1200  [500–800]                        */
    var PAIR_COOLDOWN = 600;

    var rp = net.routerPos();

    /* Build candidate list — reachable, eligible, not on cooldown */
    var candidates = sim.networks.filter(function(r){
        if(r===net)            return false;  /* not self          */
        if(r===exclude)        return false;  /* rule 5            */
        if(!r.canReceive())    return false;  /* must be alive     */
        var tp=r.routerPos();
        var dx=rp.x-tp.x, dy=rp.y-tp.y;
        if(Math.sqrt(dx*dx+dy*dy) >= CFG.BACKBONE_DIST) return false;
        var lastSent = net._wanCooldown[r.id] || 0;
        return (sim.frame - lastSent) >= PAIR_COOLDOWN;
    });

    /* Cooldown fallback — if every candidate is on cooldown,
       relax it so the network never goes permanently silent  */
    if(candidates.length === 0){
        candidates = sim.networks.filter(function(r){
            if(r===net||r===exclude||!r.canReceive()) return false;
            var tp=r.routerPos();
            var dx=rp.x-tp.x, dy=rp.y-tp.y;
            return Math.sqrt(dx*dx+dy*dy) < CFG.BACKBONE_DIST;
        });
    }
    if(candidates.length === 0) return;

    /* Weighted random pick — larger networks attract more traffic */
    var total=0;
    candidates.forEach(function(c){ total += c.edges.length||1; });
    var rv=Math.random()*total, cum=0, target=candidates[candidates.length-1];
    for(var i=0;i<candidates.length;i++){
        cum += candidates[i].edges.length||1;
        if(cum >= rv){ target=candidates[i]; break; }
    }

    /* Record send time for cooldown */
    net._wanCooldown[target.id] = sim.frame;

    /* Rule 4 — 40% chance this pulse forwards on arrival (rule 3)
                60% chance it terminates at destination             */
    var forwards = (Math.random() < 0.40);
    sim.pulses.push(new WanPulse(net, target, forwards));
    return true;   /* packet was sent */
}


/* ============================================================
   engineTickWAN  — inter-network communication  (rules 1 & 2)
   ─────────────────────────────────────────────────────────
   Self-contained. No knowledge of LAN internals.
   Called once per frame from engineUpdate().
   ============================================================ */
function engineTickWAN(){
    sim.networks.forEach(function(net){
        if(!net.canSend()) return;

        /* Rule 1 — fire immediately on first eligible frame */
        if(net.wanPendingFirst){
            var sent = _wanSendFrom(net, null);
            if(sent) net.wanPendingFirst = false;
            return;
        }

        /* Rule 2 — periodic send scaled by network size */
        var edges       = net.edges.length || 5;
        var effInterval = Math.max(240, Math.floor(CFG.WAN_INTERVAL * 10 / Math.max(edges, 10)));
        net.wanTimer++;
        if(net.wanTimer < effInterval) return;
        /* Only reset timer on successful send — retries if no target */
        var sent = _wanSendFrom(net, null);
        if(sent) net.wanTimer = 0;
    });
}


/* ============================================================
   engineTickLAN  — intra-network communication
   ─────────────────────────────────────────────────────────
   Self-contained. No knowledge of WAN internals.
   Called once per frame from engineUpdate().
   Activity scales with edge count: 1 packet per ~8 edges
   per interval, min 1, max 6.
   ============================================================ */
function engineTickLAN(){
    sim.networks.forEach(function(net){
        if(net.state!==ST.ALIVE && net.state!==ST.FADE_IN) return;
        if(net.edges.length===0) return;
        net.lanTimer = (net.lanTimer||0) + 1;
        if(net.lanTimer < CFG.LAN_INTERVAL) return;
        net.lanTimer = 0;
        var count = Math.min(6, Math.max(1, Math.round(net.edges.length/8)));
        for(var c=0; c<count; c++){
            var eIdx = Math.floor(Math.random()*net.edges.length);
            var fwd  = Math.random()<0.5;
            sim.pulses.push(new LanPulse(net, eIdx, fwd));
        }
    });
}


function engineUpdate(){
    sim.frame++;
    sim.networks.forEach(function(n){n.update();});

    /* ── Remove dead, spawn replacements ─────────────────── */
    var before  = sim.networks.length;
    sim.networks   = sim.networks.filter(function(n){ return n.state !== ST.DEAD; });
    var deficit = CFG.MAX_NETWORKS - sim.networks.length;
    var toSpawn = Math.max(0, deficit);
    for(var s=0; s<toSpawn; s++){
        var pt = bestSpawn();
        sim.networks.push(new Network(pt.x, pt.y));
    }

    sim.pulses.forEach(function(p){p.update();});
    sim.pulses = sim.pulses.filter(function(p){return p.alive;});

    engineTickWAN();   /* ── inter-network communication ──── */
    engineTickLAN();   /* ── intra-network communication ──── */
}

function engineDraw(){
    scene.ctx.clearRect(0,0,scene.W,scene.H);
    var live=sim.networks.filter(function(n){return n.state!==ST.DEAD;});

    /* 1 — WAN dashed backbone lines */
    /* Build a set of active routes (router pairs with a WAN packet in flight) */
    var activeRoutes=[];
    sim.pulses.filter(function(p){return p.isWan;}).forEach(function(p){
        activeRoutes.push({
            fx:p.fx,fy:p.fy,tx:p.tx,ty:p.ty,
            /* brightness peaks at mid-journey, fades at start/end */
            boost: Math.sin(p.t*Math.PI)*0.55
        });
    });

    scene.ctx.setLineDash([4,7]);
    for(var i=0;i<live.length;i++){
        for(var j=i+1;j<live.length;j++){
            var rp1=live[i].routerPos(), rp2=live[j].routerPos();
            var dx=rp1.x-rp2.x, dy=rp1.y-rp2.y;
            var d=Math.sqrt(dx*dx+dy*dy);
            if(d>=CFG.BACKBONE_DIST) continue;
            var baseA=Math.pow(1-d/CFG.BACKBONE_DIST,2.5)*0.38*live[i].alpha*live[j].alpha;

            /* Check if a WAN packet is currently travelling this exact route */
            var routeBoost=0;
            for(var k=0;k<activeRoutes.length;k++){
                var ar=activeRoutes[k];
                /* match in either direction */
                var fwd=(Math.abs(ar.fx-rp1.x)<2&&Math.abs(ar.fy-rp1.y)<2&&
                         Math.abs(ar.tx-rp2.x)<2&&Math.abs(ar.ty-rp2.y)<2);
                var rev=(Math.abs(ar.fx-rp2.x)<2&&Math.abs(ar.fy-rp2.y)<2&&
                         Math.abs(ar.tx-rp1.x)<2&&Math.abs(ar.ty-rp1.y)<2);
                if(fwd||rev){ routeBoost=Math.max(routeBoost,ar.boost); break; }
            }

            var a=Math.min(0.85, baseA+routeBoost);
            if(a<0.004) continue;
            var lw = routeBoost>0 ? 1.1 : 0.7;
            scene.ctx.beginPath();
            scene.ctx.strokeStyle=col(a); scene.ctx.lineWidth=lw;
            scene.ctx.moveTo(rp1.x,rp1.y); scene.ctx.lineTo(rp2.x,rp2.y);
            scene.ctx.stroke();
        }
    }
    scene.ctx.setLineDash([]);

    /* 2 — LAN edges */
    live.forEach(function(net){
        if(net.alpha<0.004) return;
        net.edges.forEach(function(e){
            var da=net.devices[e.a], db=net.devices[e.b];
            if(!da||!db) return;
            var lw=e.t==='uplink'?1.1:e.t==='trunk'?0.85:0.55;
            var am=e.t==='uplink'?0.70:e.t==='trunk'?0.52:0.36;
            var a=net.alpha*am;
            if(a<0.004) return;
            scene.ctx.beginPath();
            scene.ctx.strokeStyle=col(a); scene.ctx.lineWidth=lw;
            scene.ctx.moveTo(da.x,da.y); scene.ctx.lineTo(db.x,db.y);
            scene.ctx.stroke();
        });
    });

    /* 3 — Devices */
    live.forEach(function(net){
        if(net.alpha<0.004) return;
        net.devices.forEach(function(dev){drawDevice(scene.ctx,dev,net.alpha);});
    });

    /* 4 — WAN packets (large glowing dot) */
    sim.pulses.filter(function(p){return p.isWan;}).forEach(function(p){
        for(var k=0;k<p.trail.length;k++){
            var frac=k/p.trail.length;
            scene.ctx.beginPath();
            scene.ctx.arc(p.trail[k].x,p.trail[k].y,frac*2.2,0,Math.PI*2);
            scene.ctx.fillStyle=col(frac*0.55); scene.ctx.fill();
        }
        var env=Math.sin(p.t*Math.PI);
        var grad=scene.ctx.createRadialGradient(p.cx,p.cy,0,p.cx,p.cy,13);
        grad.addColorStop(0,col(env*0.65));
        grad.addColorStop(1,col(0));
        scene.ctx.beginPath(); scene.ctx.arc(p.cx,p.cy,13,0,Math.PI*2);
        scene.ctx.fillStyle=grad; scene.ctx.fill();
        scene.ctx.beginPath(); scene.ctx.arc(p.cx,p.cy,2.6,0,Math.PI*2);
        scene.ctx.fillStyle=col(env*0.95); scene.ctx.fill();
    });

    /* 5 — LAN packets (small dot, no large halo) */
    sim.pulses.filter(function(p){return !p.isWan;}).forEach(function(p){
        var na=p.net.alpha;
        if(na<0.01) return;
        for(var k=0;k<p.trail.length;k++){
            var frac=k/p.trail.length;
            scene.ctx.beginPath();
            scene.ctx.arc(p.trail[k].x,p.trail[k].y,frac*1.2,0,Math.PI*2);
            scene.ctx.fillStyle=col(frac*0.45*na); scene.ctx.fill();
        }
        var env=Math.sin(p.t*Math.PI);
        /* small soft halo */
        var grad=scene.ctx.createRadialGradient(p.cx,p.cy,0,p.cx,p.cy,6);
        grad.addColorStop(0,col(env*0.55*na));
        grad.addColorStop(1,col(0));
        scene.ctx.beginPath(); scene.ctx.arc(p.cx,p.cy,6,0,Math.PI*2);
        scene.ctx.fillStyle=grad; scene.ctx.fill();
        /* core dot */
        scene.ctx.beginPath(); scene.ctx.arc(p.cx,p.cy,1.6,0,Math.PI*2);
        scene.ctx.fillStyle=col(env*0.90*na); scene.ctx.fill();
    });

    /* 6 — Easter egg control pulse */
    _ctrlAnimatePulse();

    /* 7 — Network monitor table */
    _monitorUpdate();
}

function engineStop(){if(scene.animId){cancelAnimationFrame(scene.animId);scene.animId=null;}}
function engineLoop(){engineUpdate();engineDraw();scene.animId=requestAnimationFrame(engineLoop);}

/* ============================================================
   PUBLIC API
   ============================================================ */
/* particleBgSetOpacity(0.4) — change visibility at any time   */
function particleBgSetOpacity(v){
    CFG.OPACITY=Math.max(0,Math.min(1,+v||0));
    if(scene.layer) scene.layer.style.opacity=CFG.OPACITY;
}


/* ============================================================
   EASTER EGG CONTROL — bottom-right corner
   ─────────────────────────────────────────────────────────
   A self-contained overlay div injected by this plugin.
   Styled entirely with the animation's own colour so it
   barely reads as UI — intentionally subtle.

   ARCHITECTURE:
     • A fixed-position <div> sits above the canvas layer
       (z-index 9999) but uses pointer-events:none on the
       wrapper; only the inner button strip gets pointer-
       events:auto, so it never steals clicks from the page.
     • Two rows:
         [◀]  Networks: N  [▶]
         [◀]  Complexity: L  [▶]
       Clicking either arrow immediately updates CFG and
       calls a soft-reinit (existing networks fade out
       naturally; new ones spawn with fresh params).
     • Colours driven by col() so they update with CRT mode.
   ============================================================ */
var ui = { ctrl:null, ctrlPulse:0, monitor:null, monitorRows:[] };

function _ctrlCell(text, onClick) {
    var el = document.createElement('span');
    el.textContent = text;
    el.style.cssText = [
        'display:inline-block',
        'cursor:pointer',
        'padding:2px 5px',
        'font:11px/1 monospace',
        'letter-spacing:0.05em',
        'user-select:none',
        '-webkit-user-select:none',
        'pointer-events:auto',
    ].join(';');
    el.addEventListener('click', onClick);
    /* Hover brightens the glyph */
    el.addEventListener('mouseenter', function(){ el.style.opacity='0.85'; });
    el.addEventListener('mouseleave', function(){ el.style.opacity=''; });
    return el;
}

function _ctrlRow(labelFn, onDec, onInc) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:4px;justify-content:flex-end;';
    var lbl = document.createElement('span');
    lbl.style.cssText = 'font:10px/1 monospace;letter-spacing:0.04em;opacity:0.7;';
    lbl.dataset.lbl = '1';  /* mark for colour updates */
    function refresh(){ lbl.textContent = labelFn(); }
    refresh();
    var dec = _ctrlCell('◀', function(){ onDec(); refresh(); });
    var inc = _ctrlCell('▶', function(){ onInc(); refresh(); });
    dec.dataset.arrow='1'; inc.dataset.arrow='1';
    row.appendChild(lbl); row.appendChild(dec); row.appendChild(inc);
    row._refresh = refresh;
    return row;
}

/* ── Network count change ─────────────────────────────────
   Increase: immediately spawn the delta so new networks
             fade in right away; MAX_NETWORKS raised.
   Decrease: just lower MAX_NETWORKS; no reinit, no forced
             fade-out. Existing networks expire naturally
             and engineUpdate won't replace them until the
             live count has drifted back down to the new
             target.
   ⚠ minimum is 4 — rule 6 requires at least 4 network
     types visible at all times.                           */
function _ctrlChangeNetworks(delta) {
    var prev = CFG.MAX_NETWORKS;
    CFG.MAX_NETWORKS = Math.max(4, Math.min(16, CFG.MAX_NETWORKS + delta));
    if (delta > 0) {
        var toAdd = CFG.MAX_NETWORKS - prev;
        for (var i = 0; i < toAdd; i++) {
            var pt = bestSpawn();
            sim.networks.push(new Network(pt.x, pt.y));
        }
    }
}

/* ============================================================
   NETWORK MONITOR — bottom-left overlay
   ─────────────────────────────────────────────────────────
   A live table showing every active network, its topology
   type, a draining life bar, and seconds remaining.

   Mirrors the easter egg control in style (monospace, dim,
   same colour as animation) — barely reads as UI.

   Layout per row:
     type-name  ████████░░  42s
     type-name  ██░░░░░░░░   8s ↓   (↓ = fading out)
     type-name  ░░░░░░░░░░  --s     (fading in, not yet timed)

   Life bar is 10 chars wide, drains left-to-right.
   Uses block chars: █ (filled) ░ (empty).
   ============================================================ */

/* Topology display names — index matches topoType 0–7 */
var TOPO_NAMES = ['star','ring','tree','hex','dbl-ring','radial','fat-tree','mesh'];

function injectMonitor() {
    if (ui.monitor) { ui.monitor.remove(); ui.monitor = null; }
    ui.monitorRows = [];

    ui.monitor = document.createElement('div');
    ui.monitor.id = 'pbg-monitor';
    ui.monitor.style.cssText = [
        'position:fixed',
        'bottom:14px',
        'left:16px',
        'z-index:9999',
        'pointer-events:none',
        'display:flex',
        'flex-direction:column',
        'gap:2px',
        'align-items:flex-start',
    ].join(';');

    if (scene.layer) scene.layer.insertAdjacentElement('afterend', ui.monitor);
    else document.body.appendChild(ui.monitor);
}

function _monitorMakeRow() {
    var row = document.createElement('div');
    row.style.cssText = [
        'font:10px/1 monospace',
        'letter-spacing:0.04em',
        'white-space:pre',
    ].join(';');
    ui.monitor.appendChild(row);
    ui.monitorRows.push(row);
    return row;
}

function _monitorUpdate() {
    if (!ui.monitor) return;
    var c = 'rgba('+colour.r+','+colour.g+','+colour.b+',';

    var live = sim.networks.filter(function(n){ return n.state !== ST.DEAD; });
    live.sort(function(a, b){ return _netRemaining(b) - _netRemaining(a); });

    /* Grow row pool on demand */
    while (ui.monitorRows.length < live.length) _monitorMakeRow();

    /* Remove excess rows if network count shrank */
    while (ui.monitorRows.length > live.length) {
        var removed = ui.monitorRows.pop();
        if (removed.parentNode) removed.parentNode.removeChild(removed);
    }

    for (var i = 0; i < live.length; i++) {
        var net = live[i];
        var rem  = _netRemaining(net);
        var prog = _netProgress(net);

        var filled = Math.round((1 - prog) * 10);
        var bar = '';
        for (var b = 0; b < 10; b++) bar += (b < filled ? '█' : '░');

        var glyph = net.state === ST.FADE_IN  ? ' ↑' :
                    net.state === ST.FADE_OUT ? ' ↓' : '  ';

        var name = (TOPO_NAMES[net.topoType] || '???');
        while (name.length < 8) name += ' ';

        var timeStr = net.state === ST.FADE_IN
            ? '  --s'
            : (rem < 10 ? '   ' : rem < 100 ? '  ' : ' ') + Math.ceil(rem) + 's';

        ui.monitorRows[i].textContent = name + '  ' + bar + '  ' + timeStr + glyph;

        var alpha = net.state === ST.ALIVE    ? 0.40 :
                    net.state === ST.FADE_IN  ? 0.22 : 0.18;
        ui.monitorRows[i].style.color = c + alpha + ')';
    }
}

/* Total life span in frames for a network */
function _netTotalSpan(net) {
    return CFG.FADE_FRAMES + net.aliveDuration + CFG.FADE_FRAMES;
}

/* Elapsed frames into total lifespan */
function _netElapsed(net) {
    if (net.state === ST.FADE_IN)   return net.stf;
    if (net.state === ST.ALIVE)     return CFG.FADE_FRAMES + net.stf;
    if (net.state === ST.FADE_OUT)  return CFG.FADE_FRAMES + net.aliveDuration + net.stf;
    return _netTotalSpan(net);
}

/* Progress 0 → 1 across full lifespan */
function _netProgress(net) {
    return Math.min(1, _netElapsed(net) / _netTotalSpan(net));
}

/* Seconds remaining in lifespan */
function _netRemaining(net) {
    return Math.max(0, (_netTotalSpan(net) - _netElapsed(net)) / 60);
}


function injectControls() {
    if (ui.ctrl) { ui.ctrl.remove(); ui.ctrl = null; }

    ui.ctrl = document.createElement('div');
    ui.ctrl.id = 'pbg-ctrl';
    ui.ctrl.style.cssText = [
        'position:fixed',
        'bottom:14px',
        'right:16px',
        'z-index:9999',
        'pointer-events:none',
        'display:flex',
        'flex-direction:column',
        'gap:3px',
        'align-items:flex-end',
    ].join(';');

    /* Networks row — only control remaining */
    var rowNets = _ctrlRow(
        function(){ return 'networks: ' + CFG.MAX_NETWORKS; },
        function(){ _ctrlChangeNetworks(-1); },
        function(){ _ctrlChangeNetworks(+1); }
    );

    ui.ctrl.appendChild(rowNets);
    ui.ctrl._rows = [rowNets];

    if (scene.layer) scene.layer.insertAdjacentElement('afterend', ui.ctrl);
    else document.body.appendChild(ui.ctrl);

    _ctrlUpdateColour();
}

function _ctrlUpdateColour() {
    if (!ui.ctrl) return;
    var c = 'rgba('+colour.r+','+colour.g+','+colour.b+',';
    ui.ctrl.querySelectorAll('[data-lbl]').forEach(function(el){
        el.style.color = c + '0.45)';
    });
    ui.ctrl.querySelectorAll('[data-arrow]').forEach(function(el){
        el.style.color  = c + '0.35)';
        el.style.border = '1px solid ' + c + '0.18)';
    });
}

/* Called each draw frame to make the arrows breathe subtly */
function _ctrlAnimatePulse() {
    if (!ui.ctrl) return;
    ui.ctrlPulse++;
    var breathe = 0.28 + Math.sin(ui.ctrlPulse * 0.018) * 0.10;
    var c = 'rgba('+colour.r+','+colour.g+','+colour.b+',';
    ui.ctrl.querySelectorAll('[data-arrow]').forEach(function(el){
        if (!el.matches(':hover')) el.style.color = c + breathe + ')';
    });
}

function startPlugin(){
    try {
        if(!scene.layer){
            scene.layer=document.createElement('div');
            scene.layer.id='particle-layer';
            scene.layer.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;overflow:hidden;';
            /* Append to body — avoids being affected by contain:layout paint
               on #background-layer and any stacking context on #page-wrapper */
            document.body.appendChild(scene.layer);
        }
        scene.layer.style.opacity=CFG.OPACITY;
        engineStop();
        var mode=document.documentElement.getAttribute('data-crt-mode')||'default';
        setColour(PARTICLE_CRT_COLOURS[mode]||PARTICLE_CRT_COLOURS['default']);
        engineInit();
        engineLoop();
        injectControls();
        injectMonitor();
    } catch(e){ /* silent fail */ }
}

/* PUBLIC START / STOP — called externally (e.g. from about-section show/hide) */
function particleBgStart(){
    if(scene.animId) return;  /* already running */
    startPlugin();
}
function particleBgStop(){
    engineStop();
    if(scene.layer)   scene.layer.style.opacity=0;
    if(ui.ctrl)    ui.ctrl.style.opacity=0;
    if(ui.monitor) ui.monitor.style.opacity=0;
}

/* Auto-start is intentionally disabled — started on demand via particleBgStart() */


/* ============================================================
   CRT MODE OBSERVER
   ============================================================ */
(function(){
    function attach(){
        if(typeof MutationObserver==='undefined') return;
        var last=document.documentElement.getAttribute('data-crt-mode')||'default';
        new MutationObserver(function(){
            var now=document.documentElement.getAttribute('data-crt-mode')||'default';
            if(now===last) return; last=now;
            setColour(PARTICLE_CRT_COLOURS[now]||PARTICLE_CRT_COLOURS['default']);
            _ctrlUpdateColour();
        }).observe(document.documentElement,{attributes:true,attributeFilter:['data-crt-mode']});
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',attach);
    else attach();
})();

/* ── Public API — only these symbols reach the global scope ── */
global.CFG                = CFG;
global.particleBgStart    = particleBgStart;
global.particleBgStop     = particleBgStop;
global.particleBgSetOpacity = particleBgSetOpacity;

}(window));
