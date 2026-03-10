/* ============================================================
   PARTICLE NETWORK PLUGIN — particle-bg.js  v9.1
   ============================================================
   CHANGELOG
   v9.1  – Per-network WAN timer (every network guaranteed to
           communicate independently of scene size)
         – CFG fully annotated with ranges, sweet spots, and
           dependency warnings (⚠) for safe manual editing
         – Complexity presets decoupled from MAX_NETWORKS
         – Network count increase spawns delta immediately;
           decrease drains naturally without hard reset
         – Canvas injected into document.body to avoid
           contain:layout paint clipping on background-layer
   v9.0  – 7 new device shapes: miner (hex), validator (tri),
           IoT (cross) added alongside original 4
         – 8 topology variants: hex grid, double ring, radial
           arms, fat tree, organic mesh, star, ring, tree
         – WAN backbone lines visible + active route highlight
         – Bottom-right easter egg control (networks + complexity)
         – Complexity presets 1–5 (structural params only)
         – CRT colour mode observer
   v8.0  – Initial LAN/WAN network diagram animation
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
var _r=122, _g=143, _b=168;

function setColour(hex) {
    var c=(hex||'').trim();
    if(/^#[0-9a-fA-F]{6}$/i.test(c)){
        _r=parseInt(c.slice(1,3),16);
        _g=parseInt(c.slice(3,5),16);
        _b=parseInt(c.slice(5,7),16);
    } else if(/^#[0-9a-fA-F]{3}$/i.test(c)){
        _r=parseInt(c[1]+c[1],16);
        _g=parseInt(c[2]+c[2],16);
        _b=parseInt(c[3]+c[3],16);
    } else {
        try {
            var t=document.createElement('canvas');
            t.width=t.height=1;
            var x=t.getContext('2d');
            x.fillStyle=c; x.fillRect(0,0,1,1);
            var d=x.getImageData(0,0,1,1).data;
            _r=d[0];_g=d[1];_b=d[2];
        } catch(e){}
    }
}
function col(a){ return 'rgba('+_r+','+_g+','+_b+','+a+')'; }
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
    _networks.forEach(function(n){
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
function Network(cx, cy) {
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
    this.wanTimer  = 9999; /* start high — fires on first eligible check  */

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

/* ── SMALL — star topology ───────────────────────────────── */
Network.prototype._buildSmall = function() {
    var sp=CFG.SIZE_SMALL;
    var swIdx=this._add(this.cx,this.cy,DT.SWITCH);
    var ra=Math.random()*Math.PI*2;
    var rIdx=this._add(
        this.cx+Math.cos(ra)*sp*0.72,
        this.cy+Math.sin(ra)*sp*0.72, DT.ROUTER);
    this.routerIdx=rIdx;
    this._edge(rIdx,swIdx,'uplink');
    var n=CFG.PC_SMALL_MIN+Math.floor(Math.random()*(CFG.PC_SMALL_MAX-CFG.PC_SMALL_MIN+1));
    /* Mix of computers and IoT devices */
    for (var i=0;i<n;i++) {
        var a=ra+Math.PI+(i-(n-1)/2)*(Math.PI*0.75/Math.max(n-1,1));
        var d=sp*(0.48+Math.random()*0.38);
        var type = (Math.random()<0.4) ? DT.IOT : DT.COMPUTER;
        this._edge(swIdx,this._add(
            this.cx+Math.cos(a)*d,this.cy+Math.sin(a)*d, type),'access');
    }
};

/* ── MEDIUM A — ring topology ────────────────────────────── */
Network.prototype._buildMediumRing = function() {
    var sp=CFG.SIZE_MEDIUM;
    var ra=Math.random()*Math.PI*2;
    var rIdx=this._add(
        this.cx+Math.cos(ra)*sp*0.72,
        this.cy+Math.sin(ra)*sp*0.72, DT.ROUTER);
    this.routerIdx=rIdx;
    var n=CFG.PC_MED_MIN+Math.floor(Math.random()*(CFG.PC_MED_MAX-CFG.PC_MED_MIN+1));
    var ringIdxs=[];
    var gapAngle=ra;
    var arcSpan =Math.PI*1.5;
    for (var i=0;i<n;i++) {
        var frac=n>1?i/(n-1):0.5;
        var a=gapAngle+Math.PI-arcSpan/2+frac*arcSpan;
        var jitter=sp*(0.08+Math.random()*0.12);
        var dist=sp*(0.62+Math.random()*0.22);
        /* Mix of validators, miners, and computers on a ring */
        var type;
        if (i===Math.floor(n/2))        type=DT.SERVER;
        else if (i%3===0)               type=DT.VALIDATOR;
        else                            type=DT.COMPUTER;
        var idx=this._add(
            this.cx+Math.cos(a)*dist+Math.cos(a+Math.PI/2)*jitter,
            this.cy+Math.sin(a)*dist+Math.sin(a+Math.PI/2)*jitter,
            type);
        ringIdxs.push(idx);
    }
    for (var i=0;i<ringIdxs.length;i++) {
        this._edge(ringIdxs[i],ringIdxs[(i+1)%ringIdxs.length],'access');
    }
    var rp=this.devices[rIdx];
    var dists=ringIdxs.map(function(ri){
        var nd=this.devices[ri];
        var dx=nd.x-rp.x,dy=nd.y-rp.y;
        return {ri:ri,d:Math.sqrt(dx*dx+dy*dy)};
    },this);
    dists.sort(function(a,b){return a.d-b.d;});
    this._edge(rIdx,dists[0].ri,'uplink');
    if(dists.length>1) this._edge(rIdx,dists[1].ri,'uplink');
};

/* ── MEDIUM B — hierarchical tree topology ───────────────── */
Network.prototype._buildMediumTree = function() {
    var sp=CFG.SIZE_MEDIUM;
    var ra=Math.random()*Math.PI*2;
    /* Router at edge */
    var rIdx=this._add(
        this.cx+Math.cos(ra)*sp*0.78,
        this.cy+Math.sin(ra)*sp*0.78, DT.ROUTER);
    this.routerIdx=rIdx;
    /* Two aggregate servers equidistant from router */
    var aggIdxs=[];
    for (var i=0;i<2;i++) {
        var a=ra+Math.PI+(-0.45+i*0.90);
        var aIdx=this._add(
            this.cx+Math.cos(a)*sp*0.40,
            this.cy+Math.sin(a)*sp*0.40, DT.SERVER);
        aggIdxs.push(aIdx);
        this._edge(rIdx,aIdx,'uplink');
    }
    /* 2-3 leaf nodes per aggregate */
    var leafTypes=[DT.COMPUTER, DT.IOT, DT.COMPUTER, DT.IOT, DT.COMPUTER];
    for (var ai=0;ai<aggIdxs.length;ai++) {
        var aNode=this.devices[aggIdxs[ai]];
        var nLeaves=2+Math.floor(Math.random()*2);
        for (var li=0;li<nLeaves;li++) {
            var spread=(nLeaves-1)*0.28;
            var baseA=ra+Math.PI;
            var la=baseA+(ai===0?-1:1)*0.55+(li-(nLeaves-1)/2)*(spread/Math.max(nLeaves-1,1));
            var ld=sp*(0.55+Math.random()*0.25);
            var lIdx=this._add(
                this.cx+Math.cos(la)*ld,
                this.cy+Math.sin(la)*ld,
                leafTypes[li%leafTypes.length]);
            this._edge(aggIdxs[ai],lIdx,'access');
        }
    }
    /* Cross-link between the two aggregates */
    this._edge(aggIdxs[0],aggIdxs[1],'trunk');
};

/* ── LARGE A — hexagonal grid ────────────────────────────── */
Network.prototype._buildHexGrid = function() {
    var sp=CFG.SIZE_LARGE;
    var rings=CFG.HEX_RINGS;
    /* Flat-top hex: spacing between centres = sz*sqrt(3) horiz, sz*1.5 vert */
    var hexSz = Math.floor(sp / (rings + 0.5)) * 0.95;
    var nodeMap={};  /* "q,r" → device index */

    /* Generate axial hex coords within rings steps of origin */
    var coords=[];
    for (var q=-rings;q<=rings;q++) {
        for (var r=-rings;r<=rings;r++) {
            var s=-q-r;
            if (Math.abs(q)<=rings && Math.abs(r)<=rings && Math.abs(s)<=rings) {
                coords.push({q:q,r:r});
            }
        }
    }

    /* Place nodes — mix of miners and validators; center is a switch */
    var typePool=[DT.MINER,DT.MINER,DT.VALIDATOR,DT.MINER,DT.MINER,DT.VALIDATOR,DT.IOT];
    for (var i=0;i<coords.length;i++) {
        var q=coords[i].q, r=coords[i].r;
        /* Flat-top axial to pixel */
        var px = this.cx + hexSz*(1.732*q + 0.866*r);
        var py = this.cy + hexSz*(1.5*r);
        var type = (q===0&&r===0) ? DT.SWITCH : typePool[i%typePool.length];
        nodeMap[q+','+r] = this._add(px, py, type);
    }

    /* Connect each node to its 6 axial neighbours if both exist */
    var hexDirs=[{q:1,r:0},{q:1,r:-1},{q:0,r:-1},{q:-1,r:0},{q:-1,r:1},{q:0,r:1}];
    for (var i=0;i<coords.length;i++) {
        var q=coords[i].q, r=coords[i].r;
        var aIdx=nodeMap[q+','+r];
        for (var d=0;d<3;d++) { /* only 3 of 6 dirs to avoid duplicates */
            var nq=q+hexDirs[d].q, nr=r+hexDirs[d].r;
            var key=nq+','+nr;
            if (nodeMap[key]!==undefined) {
                var t=(q===0&&r===0)?'uplink':'access';
                this._edge(aIdx, nodeMap[key], t);
            }
        }
    }

    /* Router sits just outside the grid, connects to nearest perimeter node */
    var ra=Math.random()*Math.PI*2;
    var rIdx=this._add(
        this.cx+Math.cos(ra)*(sp+hexSz*1.8),
        this.cy+Math.sin(ra)*(sp+hexSz*1.8), DT.ROUTER);
    this.routerIdx=rIdx;
    /* Find the device closest to the router */
    var rDev=this.devices[rIdx];
    var bestD=Infinity, bestI=-1;
    for (var i=0;i<this.devices.length-1;i++) {
        var dx=this.devices[i].x-rDev.x, dy=this.devices[i].y-rDev.y;
        var d=Math.sqrt(dx*dx+dy*dy);
        if(d<bestD){bestD=d;bestI=i;}
    }
    if(bestI>=0) this._edge(rIdx,bestI,'uplink');
};

/* ── LARGE B — double ring ───────────────────────────────── */
Network.prototype._buildDoubleRing = function() {
    var sp=CFG.SIZE_LARGE;
    var nInner=CFG.DRING_INNER, nOuter=CFG.DRING_OUTER;
    var rInner=sp*0.38, rOuter=sp*0.78;
    var rot=Math.random()*Math.PI*2;

    /* Inner ring — validators */
    var innerIdxs=[];
    for (var i=0;i<nInner;i++) {
        var a=rot+i*(Math.PI*2/nInner);
        innerIdxs.push(this._add(
            this.cx+Math.cos(a)*rInner,
            this.cy+Math.sin(a)*rInner, DT.VALIDATOR));
    }
    /* Inner ring connections */
    for (var i=0;i<nInner;i++) {
        this._edge(innerIdxs[i], innerIdxs[(i+1)%nInner], 'trunk');
    }

    /* Outer ring — miners */
    var outerIdxs=[];
    for (var i=0;i<nOuter;i++) {
        var a=rot+i*(Math.PI*2/nOuter);
        outerIdxs.push(this._add(
            this.cx+Math.cos(a)*rOuter,
            this.cy+Math.sin(a)*rOuter, DT.MINER));
    }
    /* Outer ring connections */
    for (var i=0;i<nOuter;i++) {
        this._edge(outerIdxs[i], outerIdxs[(i+1)%nOuter], 'access');
    }

    /* Spokes: each inner node connects to its 2 nearest outer nodes */
    for (var i=0;i<nInner;i++) {
        var id=this.devices[innerIdxs[i]];
        var sorted=outerIdxs.slice().sort(function(a,b){
            var da=this.devices[a], db=this.devices[b];
            var dxa=da.x-id.x, dya=da.y-id.y;
            var dxb=db.x-id.x, dyb=db.y-id.y;
            return (dxa*dxa+dya*dya)-(dxb*dxb+dyb*dyb);
        }.bind(this));
        this._edge(innerIdxs[i], sorted[0], 'uplink');
        this._edge(innerIdxs[i], sorted[1], 'uplink');
    }

    /* Center switch hub */
    var hubIdx=this._add(this.cx, this.cy, DT.SWITCH);
    for (var i=0;i<nInner;i++) this._edge(hubIdx, innerIdxs[i], 'trunk');

    /* Router just outside outer ring */
    var ra=Math.random()*Math.PI*2;
    var rIdx=this._add(
        this.cx+Math.cos(ra)*(rOuter+sp*0.22),
        this.cy+Math.sin(ra)*(rOuter+sp*0.22), DT.ROUTER);
    this.routerIdx=rIdx;
    /* Connect router to nearest two outer nodes */
    var rDev=this.devices[rIdx];
    var sorted2=outerIdxs.slice().sort(function(a,b){
        var da=this.devices[a], db=this.devices[b];
        var dxa=da.x-rDev.x,dya=da.y-rDev.y;
        var dxb=db.x-rDev.x,dyb=db.y-rDev.y;
        return (dxa*dxa+dya*dya)-(dxb*dxb+dyb*dyb);
    }.bind(this));
    this._edge(rIdx, sorted2[0], 'uplink');
    this._edge(rIdx, sorted2[1], 'uplink');
};

/* ── LARGE C — radial arms ───────────────────────────────── */
Network.prototype._buildRadialArms = function() {
    var sp=CFG.SIZE_LARGE;
    var nArms=CFG.RADIAL_ARMS, armLen=CFG.RADIAL_LEN;
    var rot=Math.random()*Math.PI*2;

    /* Central hub */
    var hubIdx=this._add(this.cx, this.cy, DT.SWITCH);

    /* Build each arm */
    var tipIdxs=[];
    var armNodeIdxs=[];
    for (var ai=0;ai<nArms;ai++) {
        var armAngle=rot+ai*(Math.PI*2/nArms);
        var prevIdx=hubIdx;
        var armIdxs=[];
        for (var li=0;li<armLen;li++) {
            var frac=(li+1)/armLen;
            var dist=sp*0.25 + frac*sp*0.68;
            var jitter=(Math.random()-0.5)*sp*0.10;
            var perp=armAngle+Math.PI/2;
            var type = (li===armLen-1) ? DT.MINER :
                       (li===0)        ? DT.VALIDATOR : DT.COMPUTER;
            var nIdx=this._add(
                this.cx + Math.cos(armAngle)*dist + Math.cos(perp)*jitter,
                this.cy + Math.sin(armAngle)*dist + Math.sin(perp)*jitter,
                type);
            var t=(prevIdx===hubIdx)?'uplink':'access';
            this._edge(prevIdx, nIdx, t);
            prevIdx=nIdx;
            armIdxs.push(nIdx);
        }
        tipIdxs.push(prevIdx);
        armNodeIdxs.push(armIdxs);
    }

    /* Cross-link adjacent arm tips for redundancy */
    for (var ai=0;ai<nArms;ai++) {
        var nextAi=(ai+1)%nArms;
        this._edge(tipIdxs[ai], tipIdxs[nextAi], 'access');
    }

    /* Router sits off one arm tip */
    var raArm=Math.floor(Math.random()*nArms);
    var tipDev=this.devices[tipIdxs[raArm]];
    var armAngle=rot+raArm*(Math.PI*2/nArms);
    var rIdx=this._add(
        tipDev.x + Math.cos(armAngle)*sp*0.22,
        tipDev.y + Math.sin(armAngle)*sp*0.22, DT.ROUTER);
    this.routerIdx=rIdx;
    this._edge(rIdx, tipIdxs[raArm], 'uplink');
};

/* ── LARGE D — fat tree (core/aggregate/edge) ────────────── */
Network.prototype._buildFatTree = function() {
    var sp=CFG.SIZE_LARGE;
    var nCore=CFG.FATTREE_CORE, nAgg=CFG.FATTREE_AGG, nEdge=CFG.FATTREE_EDGE;
    var rot=Math.random()*Math.PI*2;

    /* Core layer — small fully-connected cluster at centre */
    var coreIdxs=[];
    for (var i=0;i<nCore;i++) {
        var a=rot+i*(Math.PI*2/nCore);
        coreIdxs.push(this._add(
            this.cx+Math.cos(a)*sp*0.18,
            this.cy+Math.sin(a)*sp*0.18, DT.SERVER));
    }
    /* Fully connect core */
    for (var i=0;i<nCore;i++) {
        for (var j=i+1;j<nCore;j++) {
            this._edge(coreIdxs[i], coreIdxs[j], 'trunk');
        }
    }

    /* Aggregate layer — ring around core, each connects to 2 core nodes */
    var aggIdxs=[];
    for (var i=0;i<nAgg;i++) {
        var a=rot+i*(Math.PI*2/nAgg);
        aggIdxs.push(this._add(
            this.cx+Math.cos(a)*sp*0.48,
            this.cy+Math.sin(a)*sp*0.48, DT.VALIDATOR));
    }
    for (var i=0;i<nAgg;i++) {
        /* Connect each aggregate to 2 nearest core nodes */
        var ad=this.devices[aggIdxs[i]];
        var sorted=coreIdxs.slice().sort(function(a,b){
            var da=this.devices[a],db=this.devices[b];
            var dxa=da.x-ad.x,dya=da.y-ad.y;
            var dxb=db.x-ad.x,dyb=db.y-ad.y;
            return (dxa*dxa+dya*dya)-(dxb*dxb+dyb*dyb);
        }.bind(this));
        this._edge(aggIdxs[i], sorted[0], 'trunk');
        this._edge(aggIdxs[i], sorted[1], 'trunk');
        /* Also ring-connect aggregates */
        this._edge(aggIdxs[i], aggIdxs[(i+1)%nAgg], 'trunk');
    }

    /* Edge layer — miners hanging off each aggregate */
    var edgeIdxs=[];
    for (var i=0;i<nAgg;i++) {
        var ad=this.devices[aggIdxs[i]];
        var outAngle=Math.atan2(ad.y-this.cy, ad.x-this.cx);
        for (var ei=0;ei<nEdge;ei++) {
            var spread=(nEdge-1)*0.30;
            var ea=outAngle+(ei-(nEdge-1)/2)*(spread/Math.max(nEdge-1,1));
            var eIdx=this._add(
                ad.x+Math.cos(ea)*sp*0.32,
                ad.y+Math.sin(ea)*sp*0.32, DT.MINER);
            this._edge(aggIdxs[i], eIdx, 'access');
            edgeIdxs.push(eIdx);
        }
    }

    /* Router off the outermost edge — connects to 2 nearest edge nodes */
    var ra=rot+Math.random()*Math.PI*2;
    var rIdx=this._add(
        this.cx+Math.cos(ra)*(sp*0.95),
        this.cy+Math.sin(ra)*(sp*0.95), DT.ROUTER);
    this.routerIdx=rIdx;
    var rDev=this.devices[rIdx];
    var sortedEdge=edgeIdxs.slice().sort(function(a,b){
        var da=this.devices[a],db=this.devices[b];
        var dxa=da.x-rDev.x,dya=da.y-rDev.y;
        var dxb=db.x-rDev.x,dyb=db.y-rDev.y;
        return (dxa*dxa+dya*dya)-(dxb*dxb+dyb*dyb);
    }.bind(this));
    this._edge(rIdx, sortedEdge[0], 'uplink');
    if(sortedEdge.length>1) this._edge(rIdx, sortedEdge[1], 'uplink');
};

/* ── LARGE E — organic proximity mesh ───────────────────── */
Network.prototype._buildMesh = function() {
    var sp=CFG.SIZE_LARGE;
    var ra=Math.random()*Math.PI*2;
    var rIdx=this._add(
        this.cx+Math.cos(ra)*sp*0.80,
        this.cy+Math.sin(ra)*sp*0.80, DT.ROUTER);
    this.routerIdx=rIdx;

    var n=CFG.MESH_NODES_MIN+Math.floor(Math.random()*(CFG.MESH_NODES_MAX-CFG.MESH_NODES_MIN+1));
    var ns=CFG.MESH_SRV_MIN+Math.floor(Math.random()*(CFG.MESH_SRV_MAX-CFG.MESH_SRV_MIN+1));
    var nodeIdxs=[];
    var typePool=[DT.MINER,DT.VALIDATOR,DT.COMPUTER,DT.MINER,DT.IOT,DT.VALIDATOR,DT.COMPUTER];
    for (var i=0;i<n;i++) {
        var angle=Math.random()*Math.PI*2;
        var dist =Math.sqrt(Math.random())*sp*0.88;
        var type =(i<ns)?DT.SERVER:typePool[i%typePool.length];
        nodeIdxs.push(this._add(
            this.cx+Math.cos(angle)*dist,
            this.cy+Math.sin(angle)*dist, type));
    }

    /* Build MST (Prim's) */
    var allIdxs=[rIdx].concat(nodeIdxs);
    var inMST=[rIdx];
    var notIn=nodeIdxs.slice();
    while(notIn.length>0) {
        var bestD=Infinity,bestA=-1,bestB=-1;
        for(var i=0;i<inMST.length;i++){
            for(var j=0;j<notIn.length;j++){
                var da=this.devices[inMST[i]];
                var db=this.devices[notIn[j]];
                var dx=da.x-db.x,dy=da.y-db.y;
                var d=Math.sqrt(dx*dx+dy*dy);
                if(d<bestD){bestD=d;bestA=inMST[i];bestB=notIn[j];}
            }
        }
        if(bestA===-1) break;
        var t=(bestA===rIdx||bestB===rIdx)?'uplink':'access';
        this._edge(bestA,bestB,t);
        inMST.push(bestB);
        notIn.splice(notIn.indexOf(bestB),1);
    }

    /* Extra cross-links */
    for(var i=0;i<nodeIdxs.length;i++){
        var da=this.devices[nodeIdxs[i]];
        var neighbours=allIdxs.filter(function(idx){return idx!==nodeIdxs[i];});
        neighbours.sort(function(a,b){
            var dxa=this.devices[a].x-da.x,dya=this.devices[a].y-da.y;
            var dxb=this.devices[b].x-da.x,dyb=this.devices[b].y-da.y;
            return (dxa*dxa+dya*dya)-(dxb*dxb+dyb*dyb);
        }.bind(this));
        var added=0;
        for(var k=0;k<neighbours.length&&added<CFG.MESH_LINKS;k++){
            var ni=neighbours[k];
            var t=(ni===rIdx||nodeIdxs[i]===rIdx)?'uplink':'access';
            this._edge(nodeIdxs[i],ni,t);
            added++;
        }
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
var _canvas=null,_ctx=null,_animId=null,_layer=null;
var _W=0,_H=0,_networks=[],_pulses=[],_frame=0;

function bestSpawn(){
    var M=CFG.MARGIN;
    var live=_networks.filter(function(n){return n.state!==ST.DEAD;});
    var best={x:M+Math.random()*(_W-M*2),y:M+Math.random()*(_H-M*2)};
    var bestD=-1;
    for(var i=0;i<CFG.SPAWN_CANDS;i++){
        var px=M+Math.random()*(_W-M*2), py=M+Math.random()*(_H-M*2);
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
    _W=window.innerWidth; _H=window.innerHeight;
    if(!_canvas){
        _canvas=document.createElement('canvas');
        _canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;';
        _layer.appendChild(_canvas);
        window.addEventListener('resize',function(){
            _W=_canvas.width=window.innerWidth;
            _H=_canvas.height=window.innerHeight;
        });
    }
    _canvas.width=_W; _canvas.height=_H;
    _ctx=_canvas.getContext('2d');
    _networks=[]; _pulses=[]; _frame=0;

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
        _networks.push(net);
    }
}

/* ============================================================
   _wanSendFrom  — core of the 5-rule WAN system
   ─────────────────────────────────────────────────────────
   Called by:
     • engineTickWAN  (rules 1 & 2 — periodic/spawn send)
     • WanPulse.update (rule 3 — forwarded arrival)

   net     : the network that is sending
   exclude : network to remove from the lottery (rule 5)
             pass null for rules 1 & 2 (no exclusion)
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
    var candidates = _networks.filter(function(r){
        if(r===net)            return false;  /* not self          */
        if(r===exclude)        return false;  /* rule 5            */
        if(!r.canReceive())    return false;  /* must be alive     */
        var tp=r.routerPos();
        var dx=rp.x-tp.x, dy=rp.y-tp.y;
        if(Math.sqrt(dx*dx+dy*dy) >= CFG.BACKBONE_DIST) return false;
        var lastSent = net._wanCooldown[r.cx+'_'+r.cy] || 0;
        return (_frame - lastSent) >= PAIR_COOLDOWN;
    });

    /* Cooldown fallback — if every candidate is on cooldown,
       relax it so the network never goes permanently silent  */
    if(candidates.length === 0){
        candidates = _networks.filter(function(r){
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
    net._wanCooldown[target.cx+'_'+target.cy] = _frame;

    /* Rule 4 — 40% chance this pulse forwards on arrival (rule 3)
                60% chance it terminates at destination             */
    var forwards = (Math.random() < 0.40);
    _pulses.push(new WanPulse(net, target, forwards));
}


/* ============================================================
   engineTickWAN  — WAN communication (rules 1 & 2)
   ─────────────────────────────────────────────────────────
   Completely self-contained. Reads CFG.WAN_INTERVAL only.
   No knowledge of LAN internals.

   Rule 1: network fires immediately on first tick
           (wanTimer initialised to 9999 in constructor)
   Rule 2: larger networks fire more frequently
           effInterval = WAN_INTERVAL * 10 / edges
           clamped to 240f minimum (~4s fastest)
           Small (5 edges)  → full WAN_INTERVAL
           Large (91 edges) → ~240f
   ============================================================ */
function engineTickWAN(){
    _networks.forEach(function(net){
        if(!net.canSend()) return;
        var edges       = net.edges.length || 5;
        var effInterval = Math.max(240, Math.floor(CFG.WAN_INTERVAL * 10 / Math.max(edges, 10)));
        net.wanTimer    = (net.wanTimer||0) + 1;
        if(net.wanTimer < effInterval) return;
        net.wanTimer = 0;
        _wanSendFrom(net, null);   /* null = no exclusion for periodic sends */
    });
}


/* ============================================================
   engineTickLAN  — internal LAN communication
   ─────────────────────────────────────────────────────────
   Completely self-contained. Reads CFG.LAN_INTERVAL only.
   No knowledge of WAN internals.

   Size-proportional activity:
     1 packet per ~8 edges per interval, min 1, max 6.
     Small star (5 edges)  → 1 packet
     Hex grid  (91 edges)  → 6 packets
   ============================================================ */
function engineTickLAN(){
    _networks.forEach(function(net){
        if(net.state!==ST.ALIVE && net.state!==ST.FADE_IN) return;
        if(net.edges.length===0) return;
        net.lanTimer = (net.lanTimer||0) + 1;
        if(net.lanTimer < CFG.LAN_INTERVAL) return;
        net.lanTimer = 0;
        var count = Math.min(6, Math.max(1, Math.round(net.edges.length/8)));
        for(var c=0; c<count; c++){
            var eIdx = Math.floor(Math.random()*net.edges.length);
            var fwd  = Math.random()<0.5;
            _pulses.push(new LanPulse(net, eIdx, fwd));
        }
    });
}


function engineUpdate(){
    _frame++;
    _networks.forEach(function(n){n.update();});

    /* ── Remove dead, spawn replacements ─────────────────── */
    var before  = _networks.length;
    _networks   = _networks.filter(function(n){ return n.state !== ST.DEAD; });
    var deficit = CFG.MAX_NETWORKS - _networks.length;
    var toSpawn = Math.max(0, deficit);
    for(var s=0; s<toSpawn; s++){
        var pt = bestSpawn();
        _networks.push(new Network(pt.x, pt.y));
    }

    _pulses.forEach(function(p){p.update();});
    _pulses = _pulses.filter(function(p){return p.alive;});

    engineTickWAN();   /* ── inter-network communication ──── */
    engineTickLAN();   /* ── intra-network communication ──── */
}

function engineDraw(){
    _ctx.clearRect(0,0,_W,_H);
    var live=_networks.filter(function(n){return n.state!==ST.DEAD;});

    /* 1 — WAN dashed backbone lines */
    /* Build a set of active routes (router pairs with a WAN packet in flight) */
    var activeRoutes=[];
    _pulses.filter(function(p){return p.isWan;}).forEach(function(p){
        activeRoutes.push({
            fx:p.fx,fy:p.fy,tx:p.tx,ty:p.ty,
            /* brightness peaks at mid-journey, fades at start/end */
            boost: Math.sin(p.t*Math.PI)*0.55
        });
    });

    _ctx.setLineDash([4,7]);
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
            _ctx.beginPath();
            _ctx.strokeStyle=col(a); _ctx.lineWidth=lw;
            _ctx.moveTo(rp1.x,rp1.y); _ctx.lineTo(rp2.x,rp2.y);
            _ctx.stroke();
        }
    }
    _ctx.setLineDash([]);

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
            _ctx.beginPath();
            _ctx.strokeStyle=col(a); _ctx.lineWidth=lw;
            _ctx.moveTo(da.x,da.y); _ctx.lineTo(db.x,db.y);
            _ctx.stroke();
        });
    });

    /* 3 — Devices */
    live.forEach(function(net){
        if(net.alpha<0.004) return;
        net.devices.forEach(function(dev){drawDevice(_ctx,dev,net.alpha);});
    });

    /* 4 — WAN packets (large glowing dot) */
    _pulses.filter(function(p){return p.isWan;}).forEach(function(p){
        for(var k=0;k<p.trail.length;k++){
            var frac=k/p.trail.length;
            _ctx.beginPath();
            _ctx.arc(p.trail[k].x,p.trail[k].y,frac*2.2,0,Math.PI*2);
            _ctx.fillStyle=col(frac*0.55); _ctx.fill();
        }
        var env=Math.sin(p.t*Math.PI);
        var grad=_ctx.createRadialGradient(p.cx,p.cy,0,p.cx,p.cy,13);
        grad.addColorStop(0,col(env*0.65));
        grad.addColorStop(1,col(0));
        _ctx.beginPath(); _ctx.arc(p.cx,p.cy,13,0,Math.PI*2);
        _ctx.fillStyle=grad; _ctx.fill();
        _ctx.beginPath(); _ctx.arc(p.cx,p.cy,2.6,0,Math.PI*2);
        _ctx.fillStyle=col(env*0.95); _ctx.fill();
    });

    /* 5 — LAN packets (small dot, no large halo) */
    _pulses.filter(function(p){return !p.isWan;}).forEach(function(p){
        var na=p.net.alpha;
        if(na<0.01) return;
        for(var k=0;k<p.trail.length;k++){
            var frac=k/p.trail.length;
            _ctx.beginPath();
            _ctx.arc(p.trail[k].x,p.trail[k].y,frac*1.2,0,Math.PI*2);
            _ctx.fillStyle=col(frac*0.45*na); _ctx.fill();
        }
        var env=Math.sin(p.t*Math.PI);
        /* small soft halo */
        var grad=_ctx.createRadialGradient(p.cx,p.cy,0,p.cx,p.cy,6);
        grad.addColorStop(0,col(env*0.55*na));
        grad.addColorStop(1,col(0));
        _ctx.beginPath(); _ctx.arc(p.cx,p.cy,6,0,Math.PI*2);
        _ctx.fillStyle=grad; _ctx.fill();
        /* core dot */
        _ctx.beginPath(); _ctx.arc(p.cx,p.cy,1.6,0,Math.PI*2);
        _ctx.fillStyle=col(env*0.90*na); _ctx.fill();
    });

    /* 6 — Easter egg control pulse */
    _ctrlAnimatePulse();

    /* 7 — Network monitor table */
    _monitorUpdate();
}

function engineStop(){if(_animId){cancelAnimationFrame(_animId);_animId=null;}}
function engineLoop(){engineUpdate();engineDraw();_animId=requestAnimationFrame(engineLoop);}

/* ============================================================
   PUBLIC API
   ============================================================ */
/* particleBgSetOpacity(0.4) — change visibility at any time   */
function particleBgSetOpacity(v){
    CFG.OPACITY=Math.max(0,Math.min(1,+v||0));
    if(_layer) _layer.style.opacity=CFG.OPACITY;
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
var _ctrl = null;   /* the injected control div */
var _ctrlPulse = 0; /* frame counter for button breathing */

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
            _networks.push(new Network(pt.x, pt.y));
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
var _monitor     = null;   /* outer div                        */
var _monitorRows = [];     /* pool of row divs                 */

/* Topology display names — index matches topoType 0–7 */
var TOPO_NAMES = ['star','ring','tree','hex','dbl-ring','radial','fat-tree','mesh'];

function injectMonitor() {
    if (_monitor) { _monitor.remove(); _monitor = null; }
    _monitorRows = [];

    _monitor = document.createElement('div');
    _monitor.id = 'pbg-monitor';
    _monitor.style.cssText = [
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

    /* Pre-create 16 row slots — show/hide as needed */
    for (var i = 0; i < 16; i++) {
        var row = document.createElement('div');
        row.style.cssText = [
            'font:10px/1 monospace',
            'letter-spacing:0.04em',
            'white-space:pre',
            'display:none',
        ].join(';');
        _monitor.appendChild(row);
        _monitorRows.push(row);
    }

    if (_layer) _layer.insertAdjacentElement('afterend', _monitor);
    else document.body.appendChild(_monitor);
}

function _monitorUpdate() {
    if (!_monitor) return;
    var c = 'rgba('+_r+','+_g+','+_b+',';

    /* Collect live networks sorted by remaining life descending */
    var live = _networks.filter(function(n){ return n.state !== ST.DEAD; });
    live.sort(function(a, b){
        return _netRemaining(b) - _netRemaining(a);
    });

    for (var i = 0; i < _monitorRows.length; i++) {
        var row = _monitorRows[i];
        if (i >= live.length) {
            row.style.display = 'none';
            continue;
        }
        var net = live[i];
        var rem = _netRemaining(net);       /* seconds remaining    */
        var prog = _netProgress(net);       /* 0 (new) → 1 (dying) */

        /* Life bar — 10 chars, drains as prog increases */
        var filled = Math.round((1 - prog) * 10);
        var bar = '';
        for (var b = 0; b < 10; b++) bar += (b < filled ? '█' : '░');

        /* Status glyph */
        var glyph = net.state === ST.FADE_IN  ? ' ↑' :
                    net.state === ST.FADE_OUT ? ' ↓' : '  ';

        /* Type name padded to 8 chars */
        var name = (TOPO_NAMES[net.topoType] || '???');
        while (name.length < 8) name += ' ';

        /* Time — blank during fade-in (not yet fully alive) */
        var timeStr = net.state === ST.FADE_IN
            ? '  --s'
            : (rem < 10 ? '   ' : rem < 100 ? '  ' : ' ') + Math.ceil(rem) + 's';

        row.textContent = name + '  ' + bar + '  ' + timeStr + glyph;

        /* Opacity: fade-in/out rows are dimmer */
        var alpha = net.state === ST.ALIVE ? 0.40 :
                    net.state === ST.FADE_IN ? 0.22 : 0.18;
        row.style.color   = c + alpha + ')';
        row.style.display = 'block';
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
    if (_ctrl) { _ctrl.remove(); _ctrl = null; }

    _ctrl = document.createElement('div');
    _ctrl.id = 'pbg-ctrl';
    _ctrl.style.cssText = [
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

    _ctrl.appendChild(rowNets);
    _ctrl._rows = [rowNets];

    if (_layer) _layer.insertAdjacentElement('afterend', _ctrl);
    else document.body.appendChild(_ctrl);

    _ctrlUpdateColour();
}

function _ctrlUpdateColour() {
    if (!_ctrl) return;
    var c = 'rgba('+_r+','+_g+','+_b+',';
    _ctrl.querySelectorAll('[data-lbl]').forEach(function(el){
        el.style.color = c + '0.45)';
    });
    _ctrl.querySelectorAll('[data-arrow]').forEach(function(el){
        el.style.color  = c + '0.35)';
        el.style.border = '1px solid ' + c + '0.18)';
    });
}

/* Called each draw frame to make the arrows breathe subtly */
function _ctrlAnimatePulse() {
    if (!_ctrl) return;
    _ctrlPulse++;
    var breathe = 0.28 + Math.sin(_ctrlPulse * 0.018) * 0.10;
    var c = 'rgba('+_r+','+_g+','+_b+',';
    _ctrl.querySelectorAll('[data-arrow]').forEach(function(el){
        if (!el.matches(':hover')) el.style.color = c + breathe + ')';
    });
}

function startPlugin(){
    try {
        if(!_layer){
            _layer=document.createElement('div');
            _layer.id='particle-layer';
            _layer.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;overflow:hidden;';
            /* Append to body — avoids being affected by contain:layout paint
               on #background-layer and any stacking context on #page-wrapper */
            document.body.appendChild(_layer);
        }
        _layer.style.opacity=CFG.OPACITY;
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
    if(_animId) return;  /* already running */
    startPlugin();
}
function particleBgStop(){
    engineStop();
    if(_layer)   _layer.style.opacity=0;
    if(_ctrl)    _ctrl.style.opacity=0;
    if(_monitor) _monitor.style.opacity=0;
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



