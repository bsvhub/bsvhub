/* ============================================================
   MANDALA NETWORK ANIMATION — mandala-bg.js  v2.0
   ============================================================
   BSV Node network visualisation.
   Drop-in replacement for particle-bg.js.
   Identical public API:
     particleBgStart()
     particleBgStop()
     particleBgDestroy()
     particleBgSetOpacity(v)
     CFG  (global config object)

   Built on the same 6-rule communication model as
   particle-bg.js v9.2, redesigned around Mandala's
   three-layer network architecture.
   ============================================================ */

/* ============================================================
   MANDALA ARCHITECTURE
   ─────────────────────────────────────────────────────────
   Three layers, always visible simultaneously:

   1. STABLE CORE CLUSTER
      A permanent N-fold symmetric mesh at the scene centre.
      N (6-12) is randomised each load — matching the face
      count of the outer gateway polygon.  A floating BSV
      hexagon at the dead centre is held in place by electric
      arc force-fields (blue) to the inner ring.  Communication
      between the hex and the gateway ring uses orange laser
      pulses.  The core breathes with a soft ambient halo that
      spikes on each BSV block confirmation.

   2. OVERLAY NETWORKS
      7 topology types (star, ring, tree, fat-tree, mesh,
      double-ring, radial) spawning and dying continuously.
      Each is a self-contained network with its own router,
      internal LAN activity, and lifecycle:
        FADE_IN → ALIVE → FADE_OUT → DEAD
      Minimum 3 different types enforced at all times (Rule 6).

   3. CONSENSUS CONFIRMATION SYSTEM
      Core tracks incoming WAN arrivals; every 6th arrival
      confirms a BSV block — the BSV symbol on the hex steps
      through 6 brightness levels in sync, then at block
      confirmation an orange ring expands from the hex centre
      and the block counter increments in the monitor.
   ─────────────────────────────────────────────────────────
   COMMUNICATION RULES  (adapted from particle-bg.js v9.2)

   WAN (inter-network) rules:

   Rule 1 — On spawn an overlay immediately fires a WAN packet
            toward the core. wanPendingFirst retries every
            frame until the core is reachable (it always is).

   Rule 2 — Larger networks send more frequently. Effective
            interval = WAN_INTERVAL × 10 / edgeCount,
            clamped to 240 frames minimum (~4s).

   Rule 3 — Core ALWAYS forwards received packets to a random
            overlay. It is a router, not a sink. Overlay→
            overlay packets forward 40% of the time.

   Rule 4 — Core→overlay packets terminate at the overlay
            (confirmed receipt). Overlay→overlay packets
            terminate 60% of the time. Overlay→core always
            triggers forwarding (Rule 3).

   Rule 5 — The sending network is excluded from the forward
            target lottery. Pair-cooldown (600 frames) further
            prevents exclusive back-and-forth loops.

   LAN (intra-network) rules:

   Rule 6 — At least 3 different overlay topology types must
            be visible at all times. _pickTopoType() fills
            missing types before allowing any repeats.

   Rule 7 — Network monitor (bottom-left): core block count,
            live confirmation indicator, and per-overlay type
            + draining life bar. Makes diversity logic and
            consensus activity observable at a glance.
   ─────────────────────────────────────────────────────────
   WAN gold-accent: any packet whose path touches the core is
   rendered in the accent colour (gold). Backbone dashed lines
   that are currently carrying a core-bound packet also light
   up in gold. Core LAN pulses are gold.

   DEVICE TYPES:
     CORE_NODE   — filled octagon       (core processing node)
     GATEWAY     — double ring          (core perimeter / WAN anchor)
     VALIDATOR   — filled triangle      (validation node; gold in core)
     MINER       — filled hexagon       (mining / edge node)
     SERVER      — large filled square  (aggregate / storage)
     SWITCH      — filled diamond       (LAN hub)
     COMPUTER    — small filled square  (endpoint)
     ROUTER      — filled circle        (overlay WAN gateway)
     IoT         — filled cross         (micropayment device)
     BSV_HEX     — large hexagon        (floating BSV node; centre)

   OVERLAY TOPOLOGY TYPES (0–6):
     0  star       — router → switch → endpoints
     1  ring       — router + nodes in a ring
     2  tree       — router → servers → computers
     3  fat-tree   — core/aggregate/edge mesh
     4  mesh       — proximity MST + extra cross-links
     5  dbl-ring   — inner validator ring + outer miner ring
     6  radial     — hub + N arms with cross-linked tips
   ============================================================ */


(function(global){
'use strict';

/* ============================================================
   COLOUR MAP  (ids match crt-modes.js swatch ids)
   Primary channel drives all normal nodes and LAN/WAN lines.
   Accent channel drives core nodes, gateways, and consensus.
   ============================================================ */
var PARTICLE_CRT_COLOURS = {
    'default': { primary:'#48B9E4', accent:'#F2B734' },
    'amber':   { primary:'#FFB000', accent:'#FFFFFF' },
    'green':   { primary:'#00CC44', accent:'#AAFFAA' },
    'white':   { primary:'#C8D8EE', accent:'#FFE080' },
    'blue':    { primary:'#5599FF', accent:'#FFD060' },
    'cyan':    { primary:'#00CCDD', accent:'#F5C842' },
};


/* ============================================================
   CONFIG — ALL TUNABLE VALUES
   ============================================================
   TIME NOTE: at 60fps —  60f = 1s | 300f = 5s | 1800f = 30s
   ============================================================ */
var CFG = {

    /* ════════════════════════════════════════════════════════
       LAYER 1 — SCENE
       ════════════════════════════════════════════════════════ */

    MAX_OVERLAYS:       5,    /* simultaneous overlay networks
                                 range : 3 → 12  [4–8]
                                 ⚠ minimum 3 (Rule 6 type diversity) */

    OPACITY:           0.88,  /* master canvas opacity
                                 range : 0.0 → 1.0  [0.5–0.95]      */

    /* ════════════════════════════════════════════════════════
       LAYER 2 — ANIMATION TIMING
       ════════════════════════════════════════════════════════ */

    /* WAN packets — large glowing dot, router ↔ core gateway */
    WAN_INTERVAL:      432,   /* frames between each network's WAN spawn
                                 range : 60 → 600  [180–400]          */
    WAN_SPEED:         336,   /* frames to travel full router→gateway
                                 range : 60 → 800  [150–400]          */
    WAN_TRAIL:          18,   /* trail length behind WAN dot (frames)
                                 range : 0 → 40  [10–24]              */

    /* LAN packets — small dot, node → node within a network */
    LAN_INTERVAL:      240,   /* frames between LAN spawns per network
                                 range : 60 → 800  [120–300]          */
    LAN_SPEED:         456,   /* frames to travel one LAN edge
                                 range : 80 → 1000  [200–500]         */
    LAN_TRAIL:          11,   /* trail length behind LAN dot (frames)
                                 range : 0 → 24  [6–16]               */

    /* Node flash when a packet arrives */
    FLASH_DECAY:      0.026,  /* alpha subtracted from flash per frame
                                 range : 0.005 → 0.10  [0.015–0.04]  */

    /* Overlay network lifecycle */
    FADE_FRAMES:       264,   /* frames to fade a network in OR out
                                 range : 60 → 600  [120–360]          */
    ALIVE_MIN:        2160,   /* min frames an overlay stays alive
                                 range : 600 → 7200  [1200–3600]
                                 ⚠ must be < ALIVE_MAX               */
    ALIVE_MAX:        4080,   /* max frames an overlay stays alive
                                 range : 1200 → 10800  [2400–6000]
                                 ⚠ must be > ALIVE_MIN               */

    /* ════════════════════════════════════════════════════════
       LAYER 3 — TOPOLOGY SIZES (px)
       ⚠ keep SIZE_SMALL < SIZE_MEDIUM < SIZE_LARGE
       ════════════════════════════════════════════════════════ */

    SIZE_SMALL:         80,   /* range : 50 → 150  [70–110]           */
    SIZE_MEDIUM:       120,   /* range : 80 → 200  [100–160]          */
    SIZE_LARGE:        168,   /* range : 120 → 280  [140–210]         */

    /* Core cluster */
    SIZE_CORE:         132,   /* physical radius of the core mesh
                                 range : 80 → 220  [100–160]          */
    CORE_INNER_NODES:   12,   /* processing nodes in core interior
                                 range : 6 → 22  [8–16]               */
    CORE_GATEWAYS:       4,   /* NOTE: overridden at runtime — actual count
                                 equals nFaces (6–12) of the core polygon
                                 range : 6 → 12  [8–10]                  */
    CORE_EXTRA_LINKS:    3,   /* extra cross-links per node beyond MST
                                 range : 0 → 5  [2–4]
                                 0 = sparse tree,  5 = very dense     */
    CORE_LAN_FACTOR:  0.55,   /* multiplier on LAN_INTERVAL for core
                                 range : 0.2 → 1.0  [0.4–0.7]
                                 lower = busier core internals        */

    /* Placement budget */
    MARGIN:            160,   /* px kept clear from screen edges
                                 range : 60 → 300  [100–200]          */
    SPAWN_CANDS:        90,   /* candidate positions tried on spawn
                                 range : 20 → 200  [40–100]           */

    /* ════════════════════════════════════════════════════════
       LAYER 4 — NODE COUNTS PER TOPOLOGY
       ⚠ always keep _MIN ≤ _MAX within each pair
       ════════════════════════════════════════════════════════ */

    PC_SMALL_MIN:        2,   /* star: endpoint range   ⚠ ≤ PC_SMALL_MAX */
    PC_SMALL_MAX:        5,
    PC_MED_MIN:          4,   /* ring: node range       ⚠ ≤ PC_MED_MAX   */
    PC_MED_MAX:          9,
    MESH_NODES_MIN:      8,   /* organic mesh           ⚠ ≤ MESH_NODES_MAX*/
    MESH_NODES_MAX:     14,
    MESH_LINKS:          2,   /* extra cross-links per node beyond MST    */
    DRING_INNER:         5,   /* double-ring inner count ⚠ ≤ DRING_OUTER  */
    DRING_OUTER:         9,   /* double-ring outer count ⚠ ≥ DRING_INNER  */
    RADIAL_ARMS:         5,   /* radial arm count                         */
    RADIAL_LEN:          3,   /* nodes per arm                            */
    FATTREE_CORE:        3,   /* fat-tree core servers                    */
    FATTREE_AGG:         4,   /* fat-tree aggregate validators            */
    FATTREE_EDGE:        2,   /* fat-tree edge miners per aggregate       */

    /* ════════════════════════════════════════════════════════
       LAYER 5 — CONSENSUS SYSTEM
       ════════════════════════════════════════════════════════ */

    CONSENSUS_THRESHOLD:  3,      /* core arrivals needed to confirm block
                                     range : 2 → 8  [2–4]               */
    CONSENSUS_WINDOW:    240,     /* rolling frame window for counting
                                     range : 60 → 600  [120–300]         */
    CONSENSUS_RING_SPEED: 0.006,  /* ring expansion per frame (0→1)
                                     range : 0.002 → 0.015  [0.004–0.01] */
    CONSENSUS_RING_SCALE: 2.0,    /* ring expands to SIZE_CORE × this
                                     range : 1.2 → 4.0  [1.5–2.5]        */

    /* ════════════════════════════════════════════════════════
       LAYER 6 — DEVICE SHAPE SIZES (px)
       ════════════════════════════════════════════════════════ */

    SZ_COMPUTER:   2.0,
    SZ_SERVER:     3.0,
    SZ_ROUTER:     3.8,
    SZ_SWITCH:     3.5,
    SZ_MINER:      4.0,
    SZ_VALIDATOR:  3.8,
    SZ_IOT:        2.5,
    SZ_GATEWAY:    5.2,   /* GATEWAY outer ring radius                    */
    SZ_CORE_NODE:  4.2,   /* CORE_NODE octagon circumradius               */
    SZ_BSV_HEX:    15.2, /* Central BSV hexagon circumradius             */
};


/* ── Internal constants ────────────────────────────────────── */
var ST = { FADE_IN:0, ALIVE:1, FADE_OUT:2, DEAD:3, CORE:4 };
var DT = {
    COMPUTER:0, SERVER:1, ROUTER:2, SWITCH:3,
    MINER:4, VALIDATOR:5, IOT:6, GATEWAY:7, CORE_NODE:8,
    BSV_HEX:9,
};


/* ============================================================
   COLOUR HELPERS
   ============================================================ */
var colour = {
    pr:72, pg:185, pb:228,   /* primary  — blue-cyan */
    ar:242,ag:183, ab:52,    /* accent   — gold      */
};

function setColour(pair) {
    var p = pair || {};
    function parse(hex, target) {
        var c = (hex||'').trim();
        if (/^#[0-9a-fA-F]{6}$/i.test(c)) {
            target[0]=parseInt(c.slice(1,3),16);
            target[1]=parseInt(c.slice(3,5),16);
            target[2]=parseInt(c.slice(5,7),16);
        } else if (/^#[0-9a-fA-F]{3}$/i.test(c)) {
            target[0]=parseInt(c[1]+c[1],16);
            target[1]=parseInt(c[2]+c[2],16);
            target[2]=parseInt(c[3]+c[3],16);
        }
    }
    var pv=[colour.pr,colour.pg,colour.pb];
    var av=[colour.ar,colour.ag,colour.ab];
    parse(p.primary, pv);
    parse(p.accent,  av);
    colour.pr=pv[0]; colour.pg=pv[1]; colour.pb=pv[2];
    colour.ar=av[0]; colour.ag=av[1]; colour.ab=av[2];
    _glowCacheInvalidate();
}

function col(a, accent) {
    var r=accent?colour.ar:colour.pr;
    var g=accent?colour.ag:colour.pg;
    var b=accent?colour.ab:colour.pb;
    return 'rgba('+r+','+g+','+b+','+Math.min(1,Math.max(0,a))+')';
}
function smooth(t){ t=t<0?0:t>1?1:t; return t*t*(3-2*t); }


/* ============================================================
   GLOW SPRITE CACHE
   ─────────────────────────────────────────────────────────
   Bakes each unique (outerRadius, peakAlpha, isAccent)
   combination into a small offscreen canvas once and reuses
   it with ctx.drawImage — a cheap bitmap blit vs recreating
   radial gradients every frame.
   Cache key:  "<a|p><qR>:<qA>"
   Invalidated whenever setColour() is called.
   ============================================================ */
var _glowCache    = {};
var _glowColourKey = '';

function _glowCacheInvalidate(){ _glowCache={}; _glowColourKey=''; }

function _glowSprite(outerR, peakAlpha, accent) {
    var ck = colour.pr+','+colour.pg+','+colour.pb+
             '|'+colour.ar+','+colour.ag+','+colour.ab;
    if (ck !== _glowColourKey){ _glowCache={}; _glowColourKey=ck; }

    var qR  = Math.round(outerR);
    var qA  = Math.round(peakAlpha * 20) / 20;
    var key = (accent?'a':'p') + qR + ':' + qA;

    if (!_glowCache[key]) {
        var dim = qR*2+2;
        var oc  = document.createElement('canvas');
        oc.width = oc.height = dim;
        var ox  = oc.getContext('2d');
        var cx  = dim*0.5;
        var r = accent?colour.ar:colour.pr;
        var g = accent?colour.ag:colour.pg;
        var b = accent?colour.ab:colour.pb;
        var gr = ox.createRadialGradient(cx,cx,0,cx,cx,qR);
        gr.addColorStop(0,'rgba('+r+','+g+','+b+','+qA+')');
        gr.addColorStop(1,'rgba('+r+','+g+','+b+',0)');
        ox.beginPath(); ox.arc(cx,cx,qR,0,Math.PI*2);
        ox.fillStyle=gr; ox.fill();
        _glowCache[key]=oc;
    }
    return _glowCache[key];
}

function _drawGlow(ctx,x,y,outerR,peakAlpha,accent){
    if(peakAlpha<0.005) return;
    var s=_glowSprite(outerR,peakAlpha,!!accent);
    var h=s.width*0.5;
    ctx.drawImage(s,x-h,y-h);
}


/* ============================================================
   DEVICE DRAWING
   flash (0-1) adds a glow — used by both WAN and LAN arrivals
   inCore — when true, validators and gateways render in accent
   ============================================================ */
function drawDevice(ctx, dev, alpha, inCore) {
    var a=alpha; if(a<0.005) return;
    var fl=(dev.flash||0)*a;
    var ac=inCore && (dev.type===DT.VALIDATOR||dev.type===DT.GATEWAY);

    /* ── GATEWAY — double ring (core perimeter / WAN anchor) ── */
    if(dev.type===DT.GATEWAY){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,32+fl*24,fl*0.82,true);
        _drawGlow(ctx,dev.x,dev.y,22,0.20*a,true);
        /* outer ring */
        ctx.beginPath(); ctx.arc(dev.x,dev.y,CFG.SZ_GATEWAY,0,Math.PI*2);
        ctx.strokeStyle=col(Math.min(1,a*0.82+fl*0.40),true);
        ctx.lineWidth=1.6; ctx.stroke();
        /* inner solid dot */
        ctx.beginPath(); ctx.arc(dev.x,dev.y,CFG.SZ_GATEWAY*0.42,0,Math.PI*2);
        ctx.fillStyle=col(Math.min(1,a*0.80+fl*0.50),true);
        ctx.fill();
        return;
    }

    /* ── CORE_NODE — filled octagon ──────────────────────────── */
    if(dev.type===DT.CORE_NODE){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,22+fl*16,fl*0.68,false);
        _drawGlow(ctx,dev.x,dev.y,12,0.14*a,false);
        var r=CFG.SZ_CORE_NODE;
        ctx.beginPath();
        for(var i=0;i<8;i++){
            var ang=i*Math.PI/4+Math.PI/8;
            var px=dev.x+Math.cos(ang)*r, py=dev.y+Math.sin(ang)*r;
            if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath();
        ctx.fillStyle=col(Math.min(1,a*0.80+fl*0.40),false);
        ctx.fill();
        return;
    }

    /* ── ROUTER — filled circle ───────────────────────────────── */
    if(dev.type===DT.ROUTER){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,20+fl*18,fl*0.65,false);
        ctx.beginPath(); ctx.arc(dev.x,dev.y,CFG.SZ_ROUTER,0,Math.PI*2);
        ctx.fillStyle=col(Math.min(1,a+fl*0.55),false);
        ctx.fill(); return;
    }

    /* ── SWITCH — filled diamond ──────────────────────────────── */
    if(dev.type===DT.SWITCH){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,14+fl*10,fl*0.50,false);
        var s=CFG.SZ_SWITCH;
        ctx.beginPath();
        ctx.moveTo(dev.x,dev.y-s); ctx.lineTo(dev.x+s,dev.y);
        ctx.lineTo(dev.x,dev.y+s); ctx.lineTo(dev.x-s,dev.y);
        ctx.closePath();
        ctx.fillStyle=col(Math.min(1,a*0.85+fl*0.40),false);
        ctx.fill(); return;
    }

    /* ── COMPUTER — small filled square ──────────────────────── */
    if(dev.type===DT.COMPUTER){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,12+fl*8,fl*0.45,false);
        var s=CFG.SZ_COMPUTER;
        ctx.fillStyle=col(Math.min(1,a*0.80+fl*0.35),false);
        ctx.fillRect(dev.x-s,dev.y-s,s*2,s*2); return;
    }

    /* ── SERVER — large filled square ────────────────────────── */
    if(dev.type===DT.SERVER){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,14+fl*10,fl*0.48,false);
        var s=CFG.SZ_SERVER;
        ctx.fillStyle=col(Math.min(1,a*0.85+fl*0.35),false);
        ctx.fillRect(dev.x-s,dev.y-s,s*2,s*2); return;
    }

    /* ── MINER — filled hexagon ───────────────────────────────── */
    if(dev.type===DT.MINER){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,18+fl*14,fl*0.60,false);
        var r=CFG.SZ_MINER;
        ctx.beginPath();
        for(var i=0;i<6;i++){
            var ang=Math.PI/6+i*Math.PI/3;
            var px=dev.x+Math.cos(ang)*r, py=dev.y+Math.sin(ang)*r;
            if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath();
        ctx.fillStyle=col(Math.min(1,a*0.88+fl*0.45),false);
        ctx.fill(); return;
    }

    /* ── VALIDATOR — equilateral triangle (gold in core) ────── */
    if(dev.type===DT.VALIDATOR){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,16+fl*12,fl*0.55,ac);
        var r=CFG.SZ_VALIDATOR;
        ctx.beginPath();
        ctx.moveTo(dev.x,              dev.y-r);
        ctx.lineTo(dev.x+r*0.866,      dev.y+r*0.5);
        ctx.lineTo(dev.x-r*0.866,      dev.y+r*0.5);
        ctx.closePath();
        ctx.fillStyle=col(Math.min(1,a*0.85+fl*0.40),ac);
        ctx.fill(); return;
    }

    /* ── IoT — filled cross/plus ──────────────────────────────── */
    if(dev.type===DT.IOT){
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,10+fl*8,fl*0.40,false);
        var arm=CFG.SZ_IOT, thick=0.9;
        ctx.fillStyle=col(Math.min(1,a*0.75+fl*0.30),false);
        ctx.fillRect(dev.x-arm,   dev.y-thick, arm*2,   thick*2);
        ctx.fillRect(dev.x-thick, dev.y-arm,   thick*2, arm*2);
        return;
    }

    /* ── BSV_HEX — floating central BSV node ────────────────── */
    if(dev.type===DT.BSV_HEX){
        var step=(sim.consensus?sim.consensus.bsvStep:0)||0;
        var pglow=(sim.consensus?sim.consensus.pendingGlow:0)||0;
        var baseR=CFG.SZ_BSV_HEX;
        var breath=0.05+Math.sin((sim?sim.frame:0)*0.022)*0.025;
        _drawGlow(ctx,dev.x,dev.y,baseR*2.4,(breath+pglow*0.22)*a,false);
        if(fl>0.02) _drawGlow(ctx,dev.x,dev.y,baseR*3.6,fl*0.45,true);
        /* Outer hexagon — solid primary blue */
        ctx.beginPath();
        for(var i=0;i<6;i++){
            var ang=Math.PI/6+i*Math.PI/3;
            var px=dev.x+Math.cos(ang)*baseR, py=dev.y+Math.sin(ang)*baseR;
            if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath();
        ctx.fillStyle=col(Math.min(1,0.88*a),false);
        ctx.fill();
        ctx.strokeStyle=col(Math.min(1,0.96*a),false);
        ctx.lineWidth=1.6; ctx.stroke();
        /* Inner hexagon ring */
        ctx.beginPath();
        for(var i=0;i<6;i++){
            var ang=Math.PI/6+i*Math.PI/3;
            var px=dev.x+Math.cos(ang)*baseR*0.72, py=dev.y+Math.sin(ang)*baseR*0.72;
            if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath();
        ctx.strokeStyle=col(Math.min(1,0.36*a),false);
        ctx.lineWidth=0.8; ctx.stroke();
        /* BSV symbol — 6 brightness steps, ignites to orange at block */
        _drawBSVSymbol(ctx, dev.x, dev.y, baseR*0.66, step, a);
        return;
    }
}

/* ── BSV Symbol — filled solid paths, standard bold ₿ form ────
   sz   = half-height of the total symbol
   step = 0-5  drives alpha: dim ember ignites to full orange
   The symbol is all filled shapes: stem + two D-bumps + 3 bars
   + top and bottom antenna ticks (the two short vertical
   protrusions that make it an authentic Bitcoin ₿).
   Lower bump is slightly wider than upper — canonical B form.
   ─────────────────────────────────────────────────────────── */
function _drawBSVSymbol(ctx, cx, cy, sz, step, alpha){
    var levels=[0.08,0.22,0.40,0.58,0.78,0.97];
    var bA=Math.min(1, levels[Math.min(5,Math.max(0,step))]*alpha);

    ctx.save();

    ctx.fillStyle = col(bA,true);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    /* Use bold font so the ₿ looks strong inside the hex */
    ctx.font = "900 " + (sz*1.9) + "px system-ui, Segoe UI, Arial, sans-serif";

    /* Unicode Bitcoin symbol */
    ctx.fillText("₿", cx, cy);

    ctx.restore();
}


/* ── Electric arc force-field between two points ──────────────
   Two animated jagged passes in primary (blue) colour.
   5-segment polylines displaced sinusoidally along the normal.
   ─────────────────────────────────────────────────────────── */
function _drawElectricArc(ctx, x1, y1, x2, y2, frame, alpha){
    if(alpha<0.005) return;
    var dx=x2-x1, dy=y2-y1;
    var len=Math.sqrt(dx*dx+dy*dy); if(len<1) return;
    var nx=-dy/len, ny=dx/len;
    ctx.save(); ctx.lineCap='round';
    for(var pass=0; pass<2; pass++){
        var ph1=frame*0.13+pass*2.3, ph2=frame*0.09+pass*1.7+0.8, ph3=frame*0.07+pass*3.1+1.6;
        var amp=len*0.13;
        var d1=Math.sin(ph1)*amp, d2=Math.cos(ph2)*amp*0.7, d3=Math.sin(ph3)*amp*0.5;
        ctx.beginPath();
        ctx.moveTo(x1,y1);
        ctx.lineTo(x1+dx*0.20+nx*d1, y1+dy*0.20+ny*d1);
        ctx.lineTo(x1+dx*0.42+nx*d2, y1+dy*0.42+ny*d2);
        ctx.lineTo(x1+dx*0.62+nx*d3, y1+dy*0.62+ny*d3);
        ctx.lineTo(x1+dx*0.82+nx*d1*0.6, y1+dy*0.82+ny*d1*0.6);
        ctx.lineTo(x2,y2);
        ctx.strokeStyle=col(alpha*(pass===0?0.52:0.22),false);
        ctx.lineWidth=pass===0?0.9:0.5;
        ctx.stroke();
    }
    ctx.restore();
}


/* ============================================================
   _pickTopoType  — type-diversity overlay selector  (Rule 6)
   ─────────────────────────────────────────────────────────
   7 overlay topology types (0–6). On each spawn:
   1. Find which types are NOT currently alive on screen.
   2. If any missing types exist, pick randomly from those.
   3. If all 7 types are present, pick the least-represented,
      breaking ties randomly.
   ============================================================ */
var TOPO_COUNT = 7;
var TOPO_NAMES = ['star','ring','tree','fat-tree','mesh','dbl-ring','radial'];

function _pickTopoType(){
    var counts=[], i;
    for(i=0;i<TOPO_COUNT;i++) counts[i]=0;
    sim.networks.forEach(function(n){
        if(!n.isCore && n.state!==ST.DEAD && n.topoType>=0)
            counts[n.topoType]++;
    });
    var missing=[];
    for(i=0;i<TOPO_COUNT;i++) if(counts[i]===0) missing.push(i);
    if(missing.length>0) return missing[Math.floor(Math.random()*missing.length)];
    var minC=Math.min.apply(null,counts), least=[];
    for(i=0;i<TOPO_COUNT;i++) if(counts[i]===minC) least.push(i);
    return least[Math.floor(Math.random()*least.length)];
}


/* ============================================================
   NETWORK CLASS
   ============================================================ */
var sim = {
    netIdCounter: 0, networks:[], coreNet:null, pulses:[], frame:0,
    consensus: { arrivals:[], rings:[], totalConfirmed:0, pendingGlow:0, bsvStep:0 },
};

function Network(cx, cy, isCore) {
    this.id        = ++sim.netIdCounter;
    this.cx        = cx;
    this.cy        = cy;
    this.isCore    = !!isCore;
    this.alpha     = isCore ? 1 : 0;
    this.state     = isCore ? ST.CORE : ST.FADE_IN;
    this.stf       = 0;
    this.aliveDuration = CFG.ALIVE_MIN +
        Math.floor(Math.random()*(CFG.ALIVE_MAX-CFG.ALIVE_MIN));
    this.devices      = [];
    this.edges        = [];
    this.routerIdx    = 0;
    this.gatewayIdxs  = [];
    this.lanTimer     = Math.floor(Math.random()*CFG.LAN_INTERVAL);
    this.wanTimer     = 0;
    this.wanPendingFirst = true;
    this._wanCooldown    = {};

    if(isCore){
        this._buildCore();
        this.topoType = -1;
    } else {
        this.topoType = _pickTopoType();
        var builders=[
            '_buildStar',       /* 0 */
            '_buildRing',       /* 1 */
            '_buildTree',       /* 2 */
            '_buildFatTree',    /* 3 */
            '_buildMesh',       /* 4 */
            '_buildDoubleRing', /* 5 */
            '_buildRadialArms', /* 6 */
        ];
        this[builders[this.topoType]]();
    }
}

/* ── Geometry helpers ─────────────────────────────────────── */
Network.prototype._add = function(x,y,type){
    this.devices.push({x:x,y:y,type:type,flash:0});
    return this.devices.length-1;
};
Network.prototype._edge = function(a,b,t){
    for(var i=0;i<this.edges.length;i++){
        var e=this.edges[i];
        if((e.a===a&&e.b===b)||(e.a===b&&e.b===a)) return;
    }
    this.edges.push({a:a,b:b,t:t||'access'});
};
Network.prototype._sortByDist = function(fromIdx,pool){
    var ref=this.devices[fromIdx];
    return pool.slice().sort(function(a,b){
        var da=this.devices[a],db=this.devices[b];
        return ((da.x-ref.x)*(da.x-ref.x)+(da.y-ref.y)*(da.y-ref.y))-
               ((db.x-ref.x)*(db.x-ref.x)+(db.y-ref.y)*(db.y-ref.y));
    }.bind(this));
};
Network.prototype._connectNearest = function(fromIdx,pool,n,edgeType){
    var sorted=this._sortByDist(fromIdx,pool);
    for(var i=0;i<Math.min(n,sorted.length);i++)
        this._edge(fromIdx,sorted[i],edgeType||'uplink');
};
Network.prototype._placeRing = function(n,radius,rot,type){
    var idxs=[];
    for(var i=0;i<n;i++){
        var a=rot+i*(Math.PI*2/n);
        idxs.push(this._add(this.cx+Math.cos(a)*radius,this.cy+Math.sin(a)*radius,type));
    }
    return idxs;
};
Network.prototype._connectRing = function(idxs,edgeType){
    for(var i=0;i<idxs.length;i++)
        this._edge(idxs[i],idxs[(i+1)%idxs.length],edgeType||'access');
};
Network.prototype._routerAtEdge = function(size,factor){
    var ra=Math.random()*Math.PI*2;
    var idx=this._add(this.cx+Math.cos(ra)*size*factor,
                      this.cy+Math.sin(ra)*size*factor,DT.ROUTER);
    this.routerIdx=idx; return idx;
};

/* routerPos: core picks a random gateway; overlays use their router */
Network.prototype.routerPos = function(){
    var idx=this.routerIdx;
    if(this.isCore && this.gatewayIdxs.length>0)
        idx=this.gatewayIdxs[Math.floor(Math.random()*this.gatewayIdxs.length)];
    var r=this.devices[idx];
    return r?{x:r.x,y:r.y}:{x:this.cx,y:this.cy};
};
/* Stable gateway position for backbone line drawing */
Network.prototype.primaryGatewayPos = function(){
    if(this.isCore && this.gatewayIdxs.length>0){
        var r=this.devices[this.gatewayIdxs[0]];
        return r?{x:r.x,y:r.y}:{x:this.cx,y:this.cy};
    }
    return this.routerPos();
};


/* ── CORE CLUSTER TOPOLOGY ─────────────────────────────────────
   Randomised N-fold symmetric design. N (6–12) is picked fresh
   each load and controls BOTH the inner geometry pattern AND the
   outer gateway count — so every gateway sits cleanly at a
   polygon vertex, no antenna spokes.

   Three structural patterns share the same pipeline:
     0 SNOWFLAKE  — concentric N-fold rings + optional crystal tips
     1 FLOWER     — inner N-ring + outer 2N petal ring + bridge layer
     2 ATOM       — 2–3 nested concentric polygon shells

   All patterns:
     • Centre BSV hex floats — zero graph edges to it
     • arcTargets → innerRing (for electric arc force-fields)
     • gatewayIdxs → nF nodes at polygon vertices (for laser pulses)
   ─────────────────────────────────────────────────────────── */
Network.prototype._buildCore = function(){
    var sp=CFG.SIZE_CORE, cx=this.cx, cy=this.cy;

    /* Floating BSV hex — device 0, no edges ever attached */
    var center=this._add(cx, cy, DT.BSV_HEX);
    var all=[center];

    /* N-fold symmetry: 6–12 faces */
    var nF = 6 + Math.floor(Math.random()*7);
    var rot= Math.random()*(Math.PI*2/nF);
    var pattern = Math.floor(Math.random()*3);

    var innerRing=[], outerRing=[];

    /* ── PATTERN 0: SNOWFLAKE ────────────────────────────────── */
    if(pattern===0){
        innerRing=this._placeRing(nF, sp*0.28, rot, DT.VALIDATOR);
        all=all.concat(innerRing);
        this._connectRing(innerRing,'trunk');

        /* Optional crystal mid-ring — rotated half a step */
        var midRing=[];
        if(Math.random()>0.38){
            midRing=this._placeRing(nF, sp*0.52, rot+Math.PI/nF, DT.CORE_NODE);
            all=all.concat(midRing);
            this._connectRing(midRing,'trunk');
            for(var k=0;k<midRing.length;k++) this._connectNearest(midRing[k],innerRing,2,'trunk');
        }

        /* Optional spoke-tip extensions (fractal arms) */
        if(Math.random()>0.45){
            var tipR=sp*(midRing.length?0.70:0.54);
            var tips=this._placeRing(nF, tipR, rot, DT.MINER);
            all=all.concat(tips);
            var src=midRing.length?midRing:innerRing;
            for(var k=0;k<tips.length;k++) this._connectNearest(tips[k],src,2,'trunk');
            outerRing=tips;
        } else {
            outerRing=midRing.length?midRing:innerRing;
        }

        /* Optional interstitial ring (doubles density, crystal facets) */
        if(Math.random()>0.55){
            var fRing=this._placeRing(nF, sp*0.42, rot+Math.PI/nF, DT.CORE_NODE);
            all=all.concat(fRing);
            this._connectRing(fRing,'trunk');
            for(var k=0;k<fRing.length;k++){
                this._connectNearest(fRing[k],innerRing,2,'trunk');
                if(outerRing.length) this._connectNearest(fRing[k],outerRing,1,'trunk');
            }
        }

    /* ── PATTERN 1: MANDALA FLOWER ───────────────────────────── */
    } else if(pattern===1){
        innerRing=this._placeRing(nF, sp*0.24, rot, DT.VALIDATOR);
        all=all.concat(innerRing);
        this._connectRing(innerRing,'trunk');

        /* 2×nF petal ring at half-step offset — creates flower petals */
        var petalRing=this._placeRing(nF*2, sp*0.50, rot+Math.PI/(nF*2), DT.CORE_NODE);
        all=all.concat(petalRing);
        this._connectRing(petalRing,'trunk');
        for(var k=0;k<innerRing.length;k++) this._connectNearest(innerRing[k],petalRing,2,'trunk');

        /* Optional second petal layer */
        if(Math.random()>0.42){
            var petal2=this._placeRing(nF, sp*0.70, rot+Math.PI/nF, DT.MINER);
            all=all.concat(petal2);
            for(var k=0;k<petal2.length;k++) this._connectNearest(petal2[k],petalRing,2,'trunk');
            outerRing=petal2;
        } else {
            outerRing=petalRing;
        }

    /* ── PATTERN 2: ATOM — nested polygon shells ─────────────── */
    } else {
        var nShells=2+Math.floor(Math.random()*2);
        var shellTypes=[DT.VALIDATOR,DT.CORE_NODE,DT.MINER];
        var prevRing=[];
        for(var ri=0;ri<nShells;ri++){
            var r=sp*(0.22+ri*0.24);
            var nN=nF+(ri%2===1?Math.floor(nF/2):0);
            var rotOff=rot+(ri%2===1?Math.PI/nF:0);
            var ring=this._placeRing(nN, r, rotOff, shellTypes[ri%3]);
            all=all.concat(ring);
            this._connectRing(ring,'trunk');
            if(ri===0){ innerRing=ring; }
            else { for(var k=0;k<ring.length;k++) this._connectNearest(ring[k],prevRing,2,'trunk'); }
            prevRing=ring;
        }
        outerRing=prevRing;
    }

    /* ── Extra cross-links on non-centre nodes ─────────────── */
    var nonCtr=all.filter(function(i){return i!==center;});
    for(var i=0;i<nonCtr.length;i++){
        var pool=nonCtr.filter(function(x){return x!==nonCtr[i];});
        var near=this._sortByDist(nonCtr[i],pool);
        for(var k=0;k<Math.min(CFG.CORE_EXTRA_LINKS,near.length);k++)
            this._edge(nonCtr[i],near[k],'trunk');
    }

    /* ── GATEWAY ring — nF nodes at polygon face vertices ───────
       One gateway per face, all at identical radius, connected
       as a ring and to the outermost pattern layer.
       No free-floating spokes — zero antenna appearance.        */
    var gwConnect=outerRing.length?outerRing:(innerRing.length?innerRing:nonCtr);
    for(var i=0;i<nF;i++){
        var a=rot+i*(Math.PI*2/nF);
        var gIdx=this._add(cx+Math.cos(a)*sp*1.08, cy+Math.sin(a)*sp*1.08, DT.GATEWAY);
        this.gatewayIdxs.push(gIdx);
        this._connectNearest(gIdx, gwConnect, 2, 'uplink');
    }
    this._connectRing(this.gatewayIdxs,'uplink');
    this.routerIdx=this.gatewayIdxs[0];

    /* ── Arc targets — innerRing nodes for electric force-fields */
    var arcPool=innerRing.length?innerRing:nonCtr;
    var sortedArc=this._sortByDist(center,arcPool);
    this.arcTargets=sortedArc.slice(0, Math.min(nF, sortedArc.length));
    this.laserTimer=0;
};


/* ── OVERLAY TOPOLOGY BUILDERS ───────────────────────────── */

/* 0 — Star */
Network.prototype._buildStar = function(){
    var sp=CFG.SIZE_SMALL;
    var sw=this._add(this.cx,this.cy,DT.SWITCH);
    var r=this._routerAtEdge(sp,0.72);
    this._edge(r,sw,'uplink');
    var n=CFG.PC_SMALL_MIN+Math.floor(Math.random()*(CFG.PC_SMALL_MAX-CFG.PC_SMALL_MIN+1));
    var ra=Math.atan2(this.devices[r].y-this.cy,this.devices[r].x-this.cx);
    for(var i=0;i<n;i++){
        var a=ra+Math.PI+(i-(n-1)/2)*(Math.PI*0.75/Math.max(n-1,1));
        var d=sp*(0.48+Math.random()*0.38);
        this._edge(sw,this._add(
            this.cx+Math.cos(a)*d,this.cy+Math.sin(a)*d,
            Math.random()<0.4?DT.IOT:DT.COMPUTER),'access');
    }
};

/* 1 — Ring */
Network.prototype._buildRing = function(){
    var sp=CFG.SIZE_MEDIUM;
    var r=this._routerAtEdge(sp,0.72);
    var ra=Math.atan2(this.devices[r].y-this.cy,this.devices[r].x-this.cx);
    var n=CFG.PC_MED_MIN+Math.floor(Math.random()*(CFG.PC_MED_MAX-CFG.PC_MED_MIN+1));
    var arc=Math.PI*1.5, ring=[];
    for(var i=0;i<n;i++){
        var frac=n>1?i/(n-1):0.5;
        var a=ra+Math.PI-arc/2+frac*arc;
        var jit=sp*(0.08+Math.random()*0.12);
        var dist=sp*(0.62+Math.random()*0.22);
        var type=i===Math.floor(n/2)?DT.SERVER:i%3===0?DT.VALIDATOR:DT.COMPUTER;
        ring.push(this._add(
            this.cx+Math.cos(a)*dist+Math.cos(a+Math.PI/2)*jit,
            this.cy+Math.sin(a)*dist+Math.sin(a+Math.PI/2)*jit,type));
    }
    this._connectRing(ring,'access');
    this._connectNearest(r,ring,2,'uplink');
};

/* 2 — Tree */
Network.prototype._buildTree = function(){
    var sp=CFG.SIZE_MEDIUM;
    var r=this._routerAtEdge(sp,0.78);
    var ra=Math.atan2(this.devices[r].y-this.cy,this.devices[r].x-this.cx);
    var agg=[];
    for(var i=0;i<2;i++){
        var a=ra+Math.PI+(-0.45+i*0.90);
        var ai=this._add(this.cx+Math.cos(a)*sp*0.40,this.cy+Math.sin(a)*sp*0.40,DT.SERVER);
        agg.push(ai); this._edge(r,ai,'uplink');
    }
    var leaf=[DT.COMPUTER,DT.IOT,DT.COMPUTER,DT.MINER,DT.COMPUTER];
    for(var ai=0;ai<agg.length;ai++){
        var nL=2+Math.floor(Math.random()*2);
        for(var li=0;li<nL;li++){
            var spread=(nL-1)*0.28;
            var la=ra+Math.PI+(ai===0?-1:1)*0.55+(li-(nL-1)/2)*(spread/Math.max(nL-1,1));
            var ld=sp*(0.55+Math.random()*0.25);
            this._edge(agg[ai],this._add(
                this.cx+Math.cos(la)*ld,this.cy+Math.sin(la)*ld,
                leaf[li%leaf.length]),'access');
        }
    }
    this._edge(agg[0],agg[1],'trunk');
};

/* 3 — Fat-tree (core/aggregate/edge) */
Network.prototype._buildFatTree = function(){
    var sp=CFG.SIZE_LARGE;
    var rot=Math.random()*Math.PI*2;
    var core=this._placeRing(CFG.FATTREE_CORE,sp*0.18,rot,DT.SERVER);
    for(var i=0;i<core.length;i++)
        for(var j=i+1;j<core.length;j++)
            this._edge(core[i],core[j],'trunk');
    var agg=this._placeRing(CFG.FATTREE_AGG,sp*0.48,rot,DT.VALIDATOR);
    this._connectRing(agg,'trunk');
    for(var i=0;i<agg.length;i++) this._connectNearest(agg[i],core,2,'trunk');
    var edgeIdxs=[];
    for(var i=0;i<agg.length;i++){
        var ad=this.devices[agg[i]];
        var outAngle=Math.atan2(ad.y-this.cy,ad.x-this.cx);
        for(var ei=0;ei<CFG.FATTREE_EDGE;ei++){
            var spread=(CFG.FATTREE_EDGE-1)*0.30;
            var ea=outAngle+(ei-(CFG.FATTREE_EDGE-1)/2)*(spread/Math.max(CFG.FATTREE_EDGE-1,1));
            var eIdx=this._add(ad.x+Math.cos(ea)*sp*0.32,ad.y+Math.sin(ea)*sp*0.32,DT.MINER);
            this._edge(agg[i],eIdx,'access'); edgeIdxs.push(eIdx);
        }
    }
    var r=this._routerAtEdge(sp,0.95);
    this._connectNearest(r,edgeIdxs,2,'uplink');
};

/* 4 — Organic mesh (Prim's MST + cross-links) */
Network.prototype._buildMesh = function(){
    var sp=CFG.SIZE_LARGE;
    var r=this._routerAtEdge(sp,0.80);
    var n=CFG.MESH_NODES_MIN+Math.floor(Math.random()*(CFG.MESH_NODES_MAX-CFG.MESH_NODES_MIN+1));
    var pool=[DT.MINER,DT.VALIDATOR,DT.COMPUTER,DT.MINER,DT.IOT,DT.VALIDATOR,DT.COMPUTER];
    var nodes=[];
    for(var i=0;i<n;i++){
        var angle=Math.random()*Math.PI*2;
        var dist=Math.sqrt(Math.random())*sp*0.88;
        nodes.push(this._add(this.cx+Math.cos(angle)*dist,
                             this.cy+Math.sin(angle)*dist,pool[i%pool.length]));
    }
    var inMST=[r],notIn=nodes.slice();
    while(notIn.length>0){
        var bestD=Infinity,bestA=-1,bestB=-1;
        for(var i=0;i<inMST.length;i++)
            for(var j=0;j<notIn.length;j++){
                var da=this.devices[inMST[i]],db=this.devices[notIn[j]];
                var dx=da.x-db.x,dy=da.y-db.y,d=dx*dx+dy*dy;
                if(d<bestD){bestD=d;bestA=inMST[i];bestB=notIn[j];}
            }
        if(bestA===-1) break;
        this._edge(bestA,bestB,(bestA===r||bestB===r)?'uplink':'access');
        inMST.push(bestB); notIn.splice(notIn.indexOf(bestB),1);
    }
    var all=[r].concat(nodes);
    for(var i=0;i<nodes.length;i++){
        var p2=all.filter(function(x){return x!==nodes[i];});
        var near=this._sortByDist(nodes[i],p2);
        for(var k=0;k<Math.min(CFG.MESH_LINKS,near.length);k++)
            this._edge(nodes[i],near[k],(near[k]===r)?'uplink':'access');
    }
};

/* 5 — Double ring */
Network.prototype._buildDoubleRing = function(){
    var sp=CFG.SIZE_LARGE;
    var rot=Math.random()*Math.PI*2;
    var inner=this._placeRing(CFG.DRING_INNER,sp*0.38,rot,DT.VALIDATOR);
    this._connectRing(inner,'trunk');
    var outer=this._placeRing(CFG.DRING_OUTER,sp*0.78,rot,DT.MINER);
    this._connectRing(outer,'access');
    for(var i=0;i<inner.length;i++) this._connectNearest(inner[i],outer,2,'uplink');
    var hub=this._add(this.cx,this.cy,DT.SWITCH);
    for(var i=0;i<inner.length;i++) this._edge(hub,inner[i],'trunk');
    var r=this._routerAtEdge(sp,1.18);
    this._connectNearest(r,outer,2,'uplink');
};

/* 6 — Radial arms */
Network.prototype._buildRadialArms = function(){
    var sp=CFG.SIZE_LARGE, nArms=CFG.RADIAL_ARMS, armLen=CFG.RADIAL_LEN;
    var rot=Math.random()*Math.PI*2;
    var hub=this._add(this.cx,this.cy,DT.SWITCH);
    var tips=[];
    for(var ai=0;ai<nArms;ai++){
        var armAngle=rot+ai*(Math.PI*2/nArms);
        var prev=hub;
        for(var li=0;li<armLen;li++){
            var frac=(li+1)/armLen;
            var dist=sp*0.25+frac*sp*0.68;
            var jit=(Math.random()-0.5)*sp*0.10;
            var type=li===armLen-1?DT.MINER:li===0?DT.VALIDATOR:DT.COMPUTER;
            var nIdx=this._add(
                this.cx+Math.cos(armAngle)*dist+Math.cos(armAngle+Math.PI/2)*jit,
                this.cy+Math.sin(armAngle)*dist+Math.sin(armAngle+Math.PI/2)*jit,type);
            this._edge(prev,nIdx,prev===hub?'uplink':'access');
            prev=nIdx;
        }
        tips.push(prev);
    }
    this._connectRing(tips,'access');
    var raArm=Math.floor(Math.random()*nArms);
    var tipDev=this.devices[tips[raArm]];
    var armAngle=rot+raArm*(Math.PI*2/nArms);
    var rIdx=this._add(
        tipDev.x+Math.cos(armAngle)*sp*0.22,
        tipDev.y+Math.sin(armAngle)*sp*0.22,DT.ROUTER);
    this.routerIdx=rIdx;
    this._edge(rIdx,tips[raArm],'uplink');
};


/* ── Lifecycle update ─────────────────────────────────────── */
Network.prototype.update = function(){
    if(this.state===ST.CORE){
        this.alpha=1;
    } else {
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
    }
    for(var i=0;i<this.devices.length;i++)
        this.devices[i].flash=Math.max(0,(this.devices[i].flash||0)-CFG.FLASH_DECAY);
};

Network.prototype.canReceive=function(){
    return this.state===ST.FADE_IN||this.state===ST.ALIVE||this.state===ST.CORE;
};
Network.prototype.canSend=function(){
    return this.state===ST.FADE_IN||this.state===ST.ALIVE||this.state===ST.CORE;
};


/* ============================================================
   WAN PULSE — large glowing dot, router ↔ core gateway
   Gold accent when either endpoint is the core.
   ============================================================ */
function WanPulse(fromNet,toNet,forwards){
    var fp=fromNet.routerPos(), tp=toNet.routerPos();
    this.fromNet=fromNet; this.toNet=toNet;
    this.fx=fp.x; this.fy=fp.y; this.tx=tp.x; this.ty=tp.y;
    this.t=0; this.speed=1/CFG.WAN_SPEED;
    this.alive=true; this.cx=this.fx; this.cy=this.fy;
    this.trail=[]; this.isWan=true;
    this.forwards=!!forwards;
    this.toCore  =toNet.isCore;
    this.fromCore=fromNet.isCore;
}
WanPulse.prototype.update=function(){
    if(this.t>0){
        this.trail.push({x:this.cx,y:this.cy});
        if(this.trail.length>CFG.WAN_TRAIL) this.trail.shift();
    }
    this.t+=this.speed;
    if(this.t>=1){
        this.alive=false;
        /* Flash destination router / gateway */
        var r=this.toNet.devices[this.toNet.routerIdx];
        if(r) r.flash=1.0;
        if(this.toCore && this.toNet.gatewayIdxs.length>0){
            var gIdx=this.toNet.gatewayIdxs[
                Math.floor(Math.random()*this.toNet.gatewayIdxs.length)];
            var gd=this.toNet.devices[gIdx];
            if(gd) gd.flash=1.0;
            /* Advance bsvStep — 6 arrivals = 1 block, perfectly synced */
            sim.consensus.arrivals.push({frame:sim.frame});
            var step=(sim.consensus.bsvStep||0)+1;
            if(step>=6 && sim.coreNet){
                sim.consensus.totalConfirmed++;
                sim.consensus.pendingGlow=1.0;
                sim.consensus.rings.push({
                    cx:sim.coreNet.cx, cy:sim.coreNet.cy,
                    t:0, maxR:CFG.SIZE_CORE*CFG.CONSENSUS_RING_SCALE,
                });
                sim.consensus.bsvStep=0;
                sim.consensus.arrivals=[];
            } else {
                sim.consensus.bsvStep=step;
            }
        }
        /* Rule 3 / Rule 4 — forwarding */
        if(this.forwards && this.toNet.canSend())
            _wanSendFrom(this.toNet,this.fromNet);
        return;
    }
    this.cx=this.fx+(this.tx-this.fx)*this.t;
    this.cy=this.fy+(this.ty-this.fy)*this.t;
};


/* ============================================================
   LAN PULSE — small dot, node → node within one network
   Gold accent when the network is the core.
   ============================================================ */
function LanPulse(net,edgeIdx,forward){
    var e  =net.edges[edgeIdx];
    var src=forward?net.devices[e.a]:net.devices[e.b];
    var dst=forward?net.devices[e.b]:net.devices[e.a];
    this.net=net; this.dstDev=forward?e.b:e.a;
    this.fx=src.x;this.fy=src.y;this.tx=dst.x;this.ty=dst.y;
    this.t=0; this.speed=1/CFG.LAN_SPEED;
    this.alive=true;this.cx=this.fx;this.cy=this.fy;
    this.trail=[];this.isWan=false;
}
LanPulse.prototype.update=function(){
    if(this.t>0){
        this.trail.push({x:this.cx,y:this.cy});
        if(this.trail.length>CFG.LAN_TRAIL) this.trail.shift();
    }
    this.t+=this.speed;
    if(this.t>=1){
        this.alive=false;
        var dev=this.net.devices[this.dstDev];
        if(dev) dev.flash=0.85;
        return;
    }
    this.cx=this.fx+(this.tx-this.fx)*this.t;
    this.cy=this.fy+(this.ty-this.fy)*this.t;
};


/* ============================================================
   LASER PULSE — fast orange beam, hex ↔ arc-target node
   No edges needed — fires directly between device positions.
   ============================================================ */
function LaserPulse(net, fromIdx, toIdx){
    var src=net.devices[fromIdx], dst=net.devices[toIdx];
    if(!src||!dst){this.alive=false;return;}
    this.net=net; this.dstDev=toIdx;
    this.fx=src.x; this.fy=src.y;
    this.tx=dst.x; this.ty=dst.y;
    this.t=0;
    this.speed=1/Math.max(30, CFG.LAN_SPEED*0.20); /* ~4-5× faster than LAN */
    this.alive=true; this.cx=this.fx; this.cy=this.fy;
    this.trail=[]; this.isWan=false; this.isLaser=true;
}
LaserPulse.prototype.update=function(){
    var LASER_TRAIL=6;
    if(this.t>0){
        this.trail.push({x:this.cx,y:this.cy});
        if(this.trail.length>LASER_TRAIL) this.trail.shift();
    }
    this.t+=this.speed;
    if(this.t>=1){
        this.alive=false;
        var dev=this.net.devices[this.dstDev];
        if(dev) dev.flash=0.90;
        return;
    }
    this.cx=this.fx+(this.tx-this.fx)*this.t;
    this.cy=this.fy+(this.ty-this.fy)*this.t;
};


/* ============================================================
   CONSENSUS SYSTEM
   ─────────────────────────────────────────────────────────
   Rolling window counts core arrivals. When THRESHOLD is met
   within WINDOW frames, a block confirmation fires:
     - golden ring expands outward from core centre
     - core ambient glow spikes
     - block counter increments in the monitor
   ============================================================ */
function _checkConsensus(){
    var now=sim.frame;
    sim.consensus.arrivals=sim.consensus.arrivals.filter(function(a){
        return (now-a.frame)<=CFG.CONSENSUS_WINDOW;
    });
    if(sim.consensus.arrivals.length>=CFG.CONSENSUS_THRESHOLD && sim.coreNet){
        sim.consensus.totalConfirmed++;
        sim.consensus.pendingGlow=1.0;
        sim.consensus.rings.push({
            cx: sim.coreNet.cx,
            cy: sim.coreNet.cy,
            t:  0,
            maxR: CFG.SIZE_CORE*CFG.CONSENSUS_RING_SCALE,
        });
        sim.consensus.arrivals=[];
    }
}


/* ============================================================
   _wanSendFrom  — core WAN routing logic  (Rules 1–5)
   ─────────────────────────────────────────────────────────
   Traffic direction model:
     overlay → core   : 70% preference; always triggers forward
     core → overlay   : weighted by edge count; terminates
     overlay → overlay: 40% forward, 60% terminate
   ============================================================ */
function _wanSendFrom(net,exclude){
    var PAIR_COOLDOWN=600;

    /* Build candidate list — alive, not self, not exclude,
       not on cooldown.  Rule 5: exclude = last sender.      */
    var candidates=sim.networks.filter(function(r){
        if(r===net||r===exclude||!r.canReceive()) return false;
        var last=net._wanCooldown[r.id]||0;
        return (sim.frame-last)>=PAIR_COOLDOWN;
    });
    /* Cooldown fallback — never go permanently silent */
    if(candidates.length===0){
        candidates=sim.networks.filter(function(r){
            return r!==net&&r!==exclude&&r.canReceive();
        });
    }
    if(candidates.length===0) return false;

    var target=null;

    if(net.isCore){
        /* Core always routes to overlays only */
        var ovls=candidates.filter(function(c){return !c.isCore;});
        if(ovls.length===0) ovls=candidates;
        var total=0;
        ovls.forEach(function(c){total+=c.edges.length||1;});
        var rv=Math.random()*total,cum=0;
        target=ovls[ovls.length-1];
        for(var i=0;i<ovls.length;i++){
            cum+=ovls[i].edges.length||1;
            if(cum>=rv){target=ovls[i];break;}
        }
    } else {
        /* Overlay: 70% chance to target core when available */
        var core=sim.coreNet;
        if(core&&core.canReceive()&&core!==exclude){
            var cdOk=(sim.frame-(net._wanCooldown[core.id]||0))>=PAIR_COOLDOWN;
            if(cdOk&&Math.random()<0.70) target=core;
        }
        /* Fallback: weighted random from remaining candidates */
        if(!target){
            var total=0;
            candidates.forEach(function(c){total+=c.edges.length||1;});
            var rv=Math.random()*total,cum=0;
            target=candidates[candidates.length-1];
            for(var i=0;i<candidates.length;i++){
                cum+=candidates[i].edges.length||1;
                if(cum>=rv){target=candidates[i];break;}
            }
        }
    }

    net._wanCooldown[target.id]=sim.frame;

    /* Forwarding flag (Rules 3 & 4) */
    var forwards;
    if(!net.isCore && target.isCore)   forwards=true;   /* overlay→core always routes */
    else if(net.isCore&&!target.isCore) forwards=false;  /* core→overlay terminates */
    else forwards=(Math.random()<0.40);                  /* overlay→overlay 40% forward */

    sim.pulses.push(new WanPulse(net,target,forwards));
    return true;
}


/* ============================================================
   engineTickWAN  — inter-network communication  (Rules 1 & 2)
   ============================================================ */
function engineTickWAN(){
    sim.networks.forEach(function(net){
        if(!net.canSend()) return;

        /* Rule 1 — fire immediately on first eligible frame */
        if(net.wanPendingFirst){
            var sent=_wanSendFrom(net,null);
            if(sent) net.wanPendingFirst=false;
            return;
        }

        /* Rule 2 — rate scales with edge count */
        var edges=net.edges.length||5;
        var effInterval=Math.max(240,Math.floor(CFG.WAN_INTERVAL*10/Math.max(edges,10)));
        net.wanTimer++;
        if(net.wanTimer<effInterval) return;
        var sent=_wanSendFrom(net,null);
        if(sent) net.wanTimer=0;
    });
}


/* ============================================================
   engineTickLAN  — intra-network communication
   Core runs at CORE_LAN_FACTOR × interval (busier).
   Activity scales with edge count (1 packet per ~8 edges).
   ============================================================ */
function engineTickLAN(){
    sim.networks.forEach(function(net){
        if(net.state===ST.DEAD) return;

        /* Core laser pulses — BSV hex centre ↔ GATEWAY nodes (orange laser comm) */
        if(net.isCore && net.gatewayIdxs && net.gatewayIdxs.length>0){
            net.laserTimer=(net.laserTimer||0)+1;
            var laserInt=Math.floor(CFG.LAN_INTERVAL*0.45);
            if(net.laserTimer>=laserInt){
                net.laserTimer=0;
                /* Pick a random gateway node as the laser target */
                var gIdxs=net.gatewayIdxs;
                var tIdx=gIdxs[Math.floor(Math.random()*gIdxs.length)];
                var fromCentre=Math.random()<0.55;
                var p=new LaserPulse(net, fromCentre?0:tIdx, fromCentre?tIdx:0);
                if(p.alive) sim.pulses.push(p);
            }
        }

        /* Regular LAN pulses on all edges (skip edges touching centre idx 0 in core) */
        if(net.edges.length===0) return;
        net.lanTimer=(net.lanTimer||0)+1;
        var interval=net.isCore
            ? Math.floor(CFG.LAN_INTERVAL*CFG.CORE_LAN_FACTOR)
            : CFG.LAN_INTERVAL;
        if(net.lanTimer<interval) return;
        net.lanTimer=0;
        var count=Math.min(6,Math.max(1,Math.round(net.edges.length/8)));
        for(var c=0;c<count;c++){
            var eIdx=Math.floor(Math.random()*net.edges.length);
            /* Skip any edge that touches the floating centre node (idx 0 in core) */
            if(net.isCore){
                var e=net.edges[eIdx];
                if(e.a===0||e.b===0) continue;
            }
            sim.pulses.push(new LanPulse(net,eIdx,Math.random()<0.5));
        }
    });
}


/* ============================================================
   ENGINE — canvas, resize, init, update, draw
   ============================================================ */
var scene = {canvas:null,ctx:null,animId:null,layer:null,W:0,H:0};

function _resizeCanvas(){
    var dpr=Math.max(1,window.devicePixelRatio||1);
    scene.W=window.innerWidth;
    scene.H=window.innerHeight;
    scene.canvas.width =Math.floor(scene.W*dpr);
    scene.canvas.height=Math.floor(scene.H*dpr);
    scene.canvas.style.width =scene.W+'px';
    scene.canvas.style.height=scene.H+'px';
    scene.ctx=scene.canvas.getContext('2d');
    scene.ctx.setTransform(dpr,0,0,dpr,0,0);
    _glowCacheInvalidate();
}

function bestSpawn(){
    var M=CFG.MARGIN;
    var live=sim.networks.filter(function(n){return n.state!==ST.DEAD;});
    var best={x:M+Math.random()*(scene.W-M*2),y:M+Math.random()*(scene.H-M*2)};
    var bestD=-1;
    for(var i=0;i<CFG.SPAWN_CANDS;i++){
        var px=M+Math.random()*(scene.W-M*2),py=M+Math.random()*(scene.H-M*2);
        /* Bias away from core centre */
        var ccx=sim.coreNet?sim.coreNet.cx:scene.W*0.5;
        var ccy=sim.coreNet?sim.coreNet.cy:scene.H*0.5;
        var cdx=px-ccx, cdy=py-ccy;
        var coreDist=Math.sqrt(cdx*cdx+cdy*cdy);
        if(coreDist<CFG.SIZE_CORE*1.6) continue;   /* too close to core */
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
    if(!scene.canvas){
        scene.canvas=document.createElement('canvas');
        scene.canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:2;';
        scene.layer.appendChild(scene.canvas);
        window.addEventListener('resize',function(){
            _resizeCanvas();
            /* Recentre core cluster */
            if(sim.coreNet){
                var ox=sim.coreNet.cx, oy=sim.coreNet.cy;
                var nx=scene.W*0.5,    ny=scene.H*0.5;
                var ddx=nx-ox, ddy=ny-oy;
                sim.coreNet.cx=nx; sim.coreNet.cy=ny;
                sim.coreNet.devices.forEach(function(d){d.x+=ddx;d.y+=ddy;});
                sim.consensus.rings.forEach(function(r){r.cx=nx;r.cy=ny;});
            }
        });
    }
    _resizeCanvas();

    sim.frame=0; sim.netIdCounter=0; sim.networks=[]; sim.pulses=[]; sim.coreNet=null;
    sim.consensus.arrivals=[]; sim.consensus.rings=[];
    sim.consensus.totalConfirmed=0; sim.consensus.pendingGlow=0;
    sim.consensus.bsvStep=0;

    /* Permanent core at scene centre */
    var core=new Network(scene.W*0.5,scene.H*0.5,true);
    sim.networks.push(core);
    sim.coreNet=core;

    /* Overlay networks — staggered lifecycle offsets */
    var cycle=CFG.FADE_FRAMES*2+CFG.ALIVE_MIN;
    for(var i=0;i<CFG.MAX_OVERLAYS;i++){
        var pt=bestSpawn();
        var net=new Network(pt.x,pt.y,false);
        var off=Math.floor((i/CFG.MAX_OVERLAYS)*cycle);
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

function engineUpdate(){
    sim.frame++;
    sim.networks.forEach(function(n){n.update();});

    /* Remove dead overlays; spawn replacements to hit MAX_OVERLAYS */
    sim.networks=sim.networks.filter(function(n){return n.state!==ST.DEAD;});
    var ovCount=sim.networks.filter(function(n){return !n.isCore;}).length;
    while(ovCount<CFG.MAX_OVERLAYS){
        sim.networks.push(new Network(bestSpawn().x,bestSpawn().y,false));
        ovCount++;
    }

    sim.pulses.forEach(function(p){p.update();});
    sim.pulses=sim.pulses.filter(function(p){return p.alive;});

    /* Advance consensus rings */
    sim.consensus.rings.forEach(function(r){r.t+=CFG.CONSENSUS_RING_SPEED;});
    sim.consensus.rings=sim.consensus.rings.filter(function(r){return r.t<1;});
    if(sim.consensus.pendingGlow>0)
        sim.consensus.pendingGlow=Math.max(0,sim.consensus.pendingGlow-0.012);

    engineTickWAN();
    engineTickLAN();
}

function engineDraw(){
    var ctx=scene.ctx;
    var live=sim.networks.filter(function(n){return n.state!==ST.DEAD;});
    ctx.clearRect(0,0,scene.W,scene.H);

    /* 1 — Core ambient halo (breathes + spikes on consensus) */
    if(sim.coreNet){
        var cGlow=sim.consensus.pendingGlow;
        var breath=0.10+Math.sin(sim.frame*0.018)*0.04+cGlow*0.22;
        _drawGlow(ctx,sim.coreNet.cx,sim.coreNet.cy,CFG.SIZE_CORE*1.85,breath,false);
        _drawGlow(ctx,sim.coreNet.cx,sim.coreNet.cy,CFG.SIZE_CORE*0.70,breath*0.55,true);
    }

    /* 2 — Consensus confirmation rings */
    sim.consensus.rings.forEach(function(ring){
        var r=ring.maxR*smooth(ring.t);
        var a=(1-ring.t)*0.56;
        if(a<0.005||r<1) return;
        ctx.beginPath(); ctx.arc(ring.cx,ring.cy,r,0,Math.PI*2);
        ctx.strokeStyle=col(a,true);
        ctx.lineWidth=1.8*(1-ring.t*0.5); ctx.stroke();
        if(r>20){
            ctx.beginPath(); ctx.arc(ring.cx,ring.cy,r*0.82,0,Math.PI*2);
            ctx.strokeStyle=col(a*0.32,true);
            ctx.lineWidth=0.7; ctx.stroke();
        }
    });

    /* 3 — WAN backbone dashed lines — brighten on active routes,
            gold when line carries a core-bound or core-sourced packet */
    var activeRoutes=[];
    sim.pulses.filter(function(p){return p.isWan;}).forEach(function(p){
        activeRoutes.push({
            fx:p.fx,fy:p.fy,tx:p.tx,ty:p.ty,
            boost:   Math.sin(p.t*Math.PI)*0.55,
            coreEdge:p.toCore||p.fromCore,
        });
    });
    var diag=Math.sqrt(scene.W*scene.W+scene.H*scene.H)||1;

    ctx.setLineDash([3,7]);
    for(var i=0;i<live.length;i++){
        for(var j=i+1;j<live.length;j++){
            var rp1=live[i].primaryGatewayPos(), rp2=live[j].primaryGatewayPos();
            var dx=rp1.x-rp2.x, dy=rp1.y-rp2.y;
            var d=Math.sqrt(dx*dx+dy*dy);
            var baseA=Math.pow(1-d/diag,2.5)*0.32*live[i].alpha*live[j].alpha;
            var routeBoost=0, isCoreEdge=live[i].isCore||live[j].isCore;
            for(var k=0;k<activeRoutes.length;k++){
                var ar=activeRoutes[k];
                var fwd=(Math.abs(ar.fx-rp1.x)<2&&Math.abs(ar.fy-rp1.y)<2&&
                         Math.abs(ar.tx-rp2.x)<2&&Math.abs(ar.ty-rp2.y)<2);
                var rev=(Math.abs(ar.fx-rp2.x)<2&&Math.abs(ar.fy-rp2.y)<2&&
                         Math.abs(ar.tx-rp1.x)<2&&Math.abs(ar.ty-rp1.y)<2);
                if(fwd||rev){
                    routeBoost=Math.max(routeBoost,ar.boost);
                    isCoreEdge=isCoreEdge||ar.coreEdge;
                    break;
                }
            }
            var a=Math.min(0.82,baseA+routeBoost);
            if(a<0.004) continue;
            var lw=routeBoost>0?1.2:0.65;
            ctx.beginPath();
            ctx.strokeStyle=(isCoreEdge&&routeBoost>0)?col(a,true):col(a,false);
            ctx.lineWidth=lw;
            ctx.moveTo(rp1.x,rp1.y); ctx.lineTo(rp2.x,rp2.y);
            ctx.stroke();
        }
    }
    ctx.setLineDash([]);

    /* 4 — LAN edges */
    live.forEach(function(net){
        if(net.alpha<0.004) return;
        net.edges.forEach(function(e){
            var da=net.devices[e.a], db=net.devices[e.b];
            if(!da||!db) return;
            /* Skip any edge touching the floating centre hex (device 0 in core) */
            if(net.isCore && (e.a===0||e.b===0)) return;
            var lw=e.t==='trunk'?1.25:e.t==='uplink'?0.90:0.52;
            var am=e.t==='trunk'?0.60:e.t==='uplink'?0.44:0.28;
            if(net.isCore){lw*=1.25;am*=1.35;}
            var a=net.alpha*am;
            if(a<0.004) return;
            ctx.beginPath();
            ctx.strokeStyle=col(a,false);
            ctx.lineWidth=lw;
            ctx.moveTo(da.x,da.y); ctx.lineTo(db.x,db.y);
            ctx.stroke();
        });
    });

    /* 4.5 — Electric arc force-fields (hex → inner ring nodes) */
    if(sim.coreNet && sim.coreNet.arcTargets && sim.coreNet.devices[0]){
        var hd=sim.coreNet.devices[0];
        sim.coreNet.arcTargets.forEach(function(tIdx){
            var td=sim.coreNet.devices[tIdx];
            if(!td) return;
            _drawElectricArc(ctx,hd.x,hd.y,td.x,td.y,sim.frame,0.46);
        });
    }

    /* 5 — Devices */
    live.forEach(function(net){
        if(net.alpha<0.004) return;
        net.devices.forEach(function(dev){
            drawDevice(ctx,dev,net.alpha,net.isCore);
        });
    });

    /* 6 — WAN packets (large glowing dot; gold near core) */
    sim.pulses.filter(function(p){return p.isWan;}).forEach(function(p){
        var ac=p.toCore||p.fromCore;
        for(var k=0;k<p.trail.length;k++){
            var frac=k/p.trail.length;
            ctx.beginPath();
            ctx.arc(p.trail[k].x,p.trail[k].y,frac*2.4,0,Math.PI*2);
            ctx.fillStyle=col(frac*(ac?0.62:0.55),ac);
            ctx.fill();
        }
        var env=Math.sin(p.t*Math.PI);
        _drawGlow(ctx,p.cx,p.cy,ac?17:13,env*0.75,ac);
        ctx.beginPath(); ctx.arc(p.cx,p.cy,ac?3.1:2.6,0,Math.PI*2);
        ctx.fillStyle=col(env*(ac?0.98:0.92),ac);
        ctx.fill();
    });

    /* 7 — LAN packets (small dot; gold in core) */
    sim.pulses.filter(function(p){return !p.isWan&&!p.isLaser;}).forEach(function(p){
        var na=p.net.alpha; if(na<0.01) return;
        var ac=p.net.isCore;
        for(var k=0;k<p.trail.length;k++){
            var frac=k/p.trail.length;
            ctx.beginPath();
            ctx.arc(p.trail[k].x,p.trail[k].y,frac*1.2,0,Math.PI*2);
            ctx.fillStyle=col(frac*0.38*na,ac);
            ctx.fill();
        }
        var env=Math.sin(p.t*Math.PI);
        _drawGlow(ctx,p.cx,p.cy,7,env*0.48*na,ac);
        ctx.beginPath(); ctx.arc(p.cx,p.cy,1.5,0,Math.PI*2);
        ctx.fillStyle=col(env*0.86*na,ac);
        ctx.fill();
    });

    /* 7.5 — Laser pulses (orange laser beams, BSV hex ↔ gateways) */
    sim.pulses.filter(function(p){return p.isLaser;}).forEach(function(p){
        if(!p.alive) return;
        var env=Math.sin(p.t*Math.PI);
        /* Compute full beam origin and current head */
        var ox=p.fx, oy=p.fy;
        /* Outer glow beam — wide, soft */
        ctx.beginPath();
        ctx.moveTo(ox,oy);
        ctx.lineTo(p.cx,p.cy);
        ctx.strokeStyle=col(env*0.32,true);
        ctx.lineWidth=3.2; ctx.lineCap='round'; ctx.stroke();
        /* Core beam — bright thin */
        ctx.beginPath();
        ctx.moveTo(ox,oy);
        ctx.lineTo(p.cx,p.cy);
        ctx.strokeStyle=col(env*0.88,true);
        ctx.lineWidth=0.9; ctx.stroke();
        /* Leading head glow + dot */
        _drawGlow(ctx,p.cx,p.cy,10,env*0.72,true);
        ctx.beginPath(); ctx.arc(p.cx,p.cy,1.8,0,Math.PI*2);
        ctx.fillStyle=col(env*0.98,true); ctx.fill();
    });

    /* 8 — Easter egg control pulse */
    _ctrlAnimatePulse();

    /* 9 — Network monitor */
    _monitorUpdate();
}

function engineStop(){if(scene.animId){cancelAnimationFrame(scene.animId);scene.animId=null;}}
function engineLoop(){engineUpdate();engineDraw();scene.animId=requestAnimationFrame(engineLoop);}


/* ============================================================
   MONITOR — bottom-left  (Rule 7)
   ─────────────────────────────────────────────────────────
   Shows: core status line, confirmed block count, and per-
   overlay type + draining life bar + state glyph.
   ============================================================ */
var ui={ctrl:null,ctrlPulse:0,monitor:null,monitorRows:[],observer:null};

/* Lifecycle timing helpers (mirrored from particle-bg.js) */
function _netTotalSpan(net){return CFG.FADE_FRAMES+net.aliveDuration+CFG.FADE_FRAMES;}
function _netElapsed(net){
    if(net.state===ST.FADE_IN)  return net.stf;
    if(net.state===ST.ALIVE)    return CFG.FADE_FRAMES+net.stf;
    if(net.state===ST.FADE_OUT) return CFG.FADE_FRAMES+net.aliveDuration+net.stf;
    return _netTotalSpan(net);
}
function _netProgress(net){return Math.min(1,_netElapsed(net)/_netTotalSpan(net));}
function _netRemaining(net){return Math.max(0,(_netTotalSpan(net)-_netElapsed(net))/60);}

function injectMonitor(){
    if(ui.monitor){ui.monitor.remove();ui.monitor=null;}
    ui.monitorRows=[];
    ui.monitor=document.createElement('div');
    ui.monitor.id='pbg-monitor';
    ui.monitor.style.cssText=[
        'position:fixed','bottom:14px','left:16px','z-index:9999',
        'pointer-events:none','display:flex','flex-direction:column',
        'gap:2px','align-items:flex-start',
    ].join(';');
    if(scene.layer) scene.layer.insertAdjacentElement('afterend',ui.monitor);
    else document.body.appendChild(ui.monitor);
}

function _monitorMakeRow(){
    var row=document.createElement('div');
    row.style.cssText='font:10px/1 monospace;letter-spacing:0.04em;white-space:pre;';
    ui.monitor.appendChild(row);
    ui.monitorRows.push(row);
    return row;
}

function _monitorUpdate(){
    if(!ui.monitor) return;
    var cp=col(0.55,true);  /* accent colour for header */
    var pp=col(0.30,false); /* primary for rows */

    /* Header row — always index 0 */
    var ringActive=sim.consensus.rings.length>0;
    var headerTxt='\u2b21 CORE  blocks: '+sim.consensus.totalConfirmed+
                  '  '+(ringActive?'\u25cf':'\u25cb');
    if(!ui.monitorRows[0]) _monitorMakeRow();
    ui.monitorRows[0].textContent=headerTxt;
    ui.monitorRows[0].style.color=cp;

    /* Separator row — always index 1 */
    if(!ui.monitorRows[1]) _monitorMakeRow();
    ui.monitorRows[1].textContent='\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'+
                                  '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'+
                                  '\u2500\u2500\u2500\u2500\u2500\u2500\u2500';
    ui.monitorRows[1].style.color=col(0.14,false);

    var overlays=sim.networks.filter(function(n){return !n.isCore&&n.state!==ST.DEAD;});
    overlays.sort(function(a,b){return _netRemaining(b)-_netRemaining(a);});

    /* Data rows start at index 2 */
    var need=2+overlays.length;
    while(ui.monitorRows.length<need) _monitorMakeRow();
    while(ui.monitorRows.length>need){
        var rm=ui.monitorRows.pop();
        if(rm.parentNode) rm.parentNode.removeChild(rm);
    }

    for(var i=0;i<overlays.length;i++){
        var net=overlays[i];
        var rem =_netRemaining(net);
        var prog=_netProgress(net);
        var filled=Math.round((1-prog)*10);
        var bar='';
        for(var b=0;b<10;b++) bar+=(b<filled?'\u2588':'\u2591');
        var glyph=net.state===ST.FADE_IN?' \u2191':net.state===ST.FADE_OUT?' \u2193':'  ';
        var name=TOPO_NAMES[net.topoType]||'???';
        while(name.length<8) name+=' ';
        var timeStr=net.state===ST.FADE_IN?'  --s':
            (rem<10?'   ':rem<100?'  ':' ')+Math.ceil(rem)+'s';
        ui.monitorRows[2+i].textContent=name+'  '+bar+'  '+timeStr+glyph;
        var alpha=net.state===ST.ALIVE?0.38:net.state===ST.FADE_IN?0.20:0.16;
        ui.monitorRows[2+i].style.color=col(alpha,false);
    }
}


/* ============================================================
   EASTER EGG CONTROL — bottom-right corner
   ─────────────────────────────────────────────────────────
   One row: [◀]  overlays: N  [▶]
   Identical interaction pattern to particle-bg.js v9.2.
   Minimum 3 overlays (Rule 6). Max 12.
   ============================================================ */
var _prefersReducedMotion=(typeof window.matchMedia==='function')&&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function _ctrlCell(text,onClick){
    var el=document.createElement('span');
    el.textContent=text;
    el.style.cssText=[
        'display:inline-block','cursor:pointer','padding:2px 5px',
        'font:11px/1 monospace','letter-spacing:0.05em',
        'user-select:none','-webkit-user-select:none','pointer-events:auto',
    ].join(';');
    el.addEventListener('click',onClick);
    el.addEventListener('mouseenter',function(){el.style.opacity='0.85';});
    el.addEventListener('mouseleave',function(){el.style.opacity='';});
    return el;
}

function _ctrlRow(labelFn,onDec,onInc){
    var row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:4px;justify-content:flex-end;';
    var lbl=document.createElement('span');
    lbl.style.cssText='font:10px/1 monospace;letter-spacing:0.04em;opacity:0.7;';
    lbl.dataset.lbl='1';
    function refresh(){lbl.textContent=labelFn();}
    refresh();
    var dec=_ctrlCell('\u25c4',function(){onDec();refresh();});
    var inc=_ctrlCell('\u25ba',function(){onInc();refresh();});
    dec.dataset.arrow='1'; inc.dataset.arrow='1';
    row.appendChild(lbl); row.appendChild(dec); row.appendChild(inc);
    row._refresh=refresh;
    return row;
}

function _ctrlChangeOverlays(delta){
    var prev=CFG.MAX_OVERLAYS;
    CFG.MAX_OVERLAYS=Math.max(3,Math.min(12,CFG.MAX_OVERLAYS+delta));
    if(delta>0){
        var toAdd=CFG.MAX_OVERLAYS-prev;
        for(var i=0;i<toAdd;i++){
            var pt=bestSpawn();
            sim.networks.push(new Network(pt.x,pt.y,false));
        }
    }
    /* Decrease: let overlays drain naturally */
}

function injectControls(){
    if(ui.ctrl){ui.ctrl.remove();ui.ctrl=null;}
    ui.ctrl=document.createElement('div');
    ui.ctrl.id='pbg-ctrl';
    ui.ctrl.style.cssText=[
        'position:fixed','bottom:14px','right:16px','z-index:9999',
        'pointer-events:none','display:flex','flex-direction:column',
        'gap:3px','align-items:flex-end',
    ].join(';');
    var rowOv=_ctrlRow(
        function(){return 'overlays: '+CFG.MAX_OVERLAYS;},
        function(){_ctrlChangeOverlays(-1);},
        function(){_ctrlChangeOverlays(+1);}
    );
    ui.ctrl.appendChild(rowOv);
    ui.ctrl._rows=[rowOv];
    if(scene.layer) scene.layer.insertAdjacentElement('afterend',ui.ctrl);
    else document.body.appendChild(ui.ctrl);
    _ctrlUpdateColour();
}

function _ctrlUpdateColour(){
    if(!ui.ctrl) return;
    var c='rgba('+colour.pr+','+colour.pg+','+colour.pb+',';
    ui.ctrl.querySelectorAll('[data-lbl]').forEach(function(el){
        el.style.color=c+'0.45)';
    });
    ui.ctrl.querySelectorAll('[data-arrow]').forEach(function(el){
        el.style.color =c+'0.35)';
        el.style.border='1px solid '+c+'0.18)';
    });
}

function _ctrlAnimatePulse(){
    if(!ui.ctrl) return;
    ui.ctrlPulse++;
    var breathe=0.28+Math.sin(ui.ctrlPulse*0.018)*0.10;
    var c='rgba('+colour.pr+','+colour.pg+','+colour.pb+',';
    ui.ctrl.querySelectorAll('[data-arrow]').forEach(function(el){
        if(!el.matches(':hover')) el.style.color=c+breathe+')';
    });
}


/* ============================================================
   startPlugin / stop / destroy
   ============================================================ */
function startPlugin(){
    try{
        if(!scene.layer){
            scene.layer=document.createElement('div');
            scene.layer.id='particle-layer';
            scene.layer.style.cssText=
                'position:fixed;inset:0;width:100%;height:100%;'+
                'z-index:1;pointer-events:none;overflow:hidden;';
            document.body.appendChild(scene.layer);
        }
        scene.layer.style.opacity=CFG.OPACITY;

        if(_prefersReducedMotion){
            CFG.WAN_TRAIL=0; CFG.LAN_TRAIL=0;
            CFG.WAN_INTERVAL=Math.max(CFG.WAN_INTERVAL,600);
            CFG.LAN_INTERVAL=Math.max(CFG.LAN_INTERVAL,600);
        }

        engineStop();
        scene.running=true;
        var mode=document.documentElement.getAttribute('data-crt-mode')||'default';
        setColour(PARTICLE_CRT_COLOURS[mode]||PARTICLE_CRT_COLOURS['default']);
        engineInit();
        engineLoop();
        injectControls();
        injectMonitor();
    }catch(e){/* silent fail */}
}

function particleBgStart(){
    if(scene.animId) return;
    startPlugin();
}

function particleBgStop(){
    scene.running=false;
    engineStop();
    if(scene.layer)   scene.layer.style.opacity=0;
    if(ui.ctrl)       ui.ctrl.style.opacity=0;
    if(ui.monitor)    ui.monitor.style.opacity=0;
}

function particleBgDestroy(){
    engineStop();
    scene.running=false;
    if(scene.layer){ scene.layer.remove(); scene.layer=null; }
    if(ui.ctrl){     ui.ctrl.remove();     ui.ctrl=null; }
    if(ui.monitor){  ui.monitor.remove();  ui.monitor=null; }
    if(ui.observer){ ui.observer.disconnect(); ui.observer=null; }
    scene.canvas=null; scene.ctx=null;
    sim.networks=[]; sim.pulses=[]; sim.frame=0; sim.coreNet=null;
    sim.consensus.arrivals=[]; sim.consensus.rings=[];
    sim.consensus.totalConfirmed=0; sim.consensus.pendingGlow=0;
    sim.consensus.bsvStep=0;
    ui.monitorRows=[];
    _glowCacheInvalidate();
}

function particleBgSetOpacity(v){
    CFG.OPACITY=Math.max(0,Math.min(1,+v||0));
    if(scene.layer) scene.layer.style.opacity=CFG.OPACITY;
}


/* ============================================================
   CRT MODE OBSERVER
   Listens to data-crt-mode attribute changes on <html> and
   updates both colour channels (primary + accent).
   ============================================================ */
(function(){
    function attach(){
        if(typeof MutationObserver==='undefined') return;
        if(ui.observer) ui.observer.disconnect();
        var last=document.documentElement.getAttribute('data-crt-mode')||'default';
        ui.observer=new MutationObserver(function(){
            var now=document.documentElement.getAttribute('data-crt-mode')||'default';
            if(now===last) return; last=now;
            setColour(PARTICLE_CRT_COLOURS[now]||PARTICLE_CRT_COLOURS['default']);
            _ctrlUpdateColour();
        });
        ui.observer.observe(document.documentElement,
            {attributes:true,attributeFilter:['data-crt-mode']});
    }
    if(document.readyState==='loading')
        document.addEventListener('DOMContentLoaded',attach);
    else attach();
})();


/* ── Page Visibility pause ────────────────────────────────── */
document.addEventListener('visibilitychange',function(){
    if(!scene.running) return;
    if(document.hidden){ engineStop(); }
    else { if(!scene.animId) engineLoop(); }
});


/* ── Public API ───────────────────────────────────────────── */
global.CFG                  = CFG;
global.particleBgStart      = particleBgStart;
global.particleBgStop       = particleBgStop;
global.particleBgDestroy    = particleBgDestroy;
global.particleBgSetOpacity = particleBgSetOpacity;

}(window));
