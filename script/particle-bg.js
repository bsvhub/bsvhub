/* ============================================================
   PARTICLE NETWORK PLUGIN — particle-bg.js  v9.0
   ============================================================
   Blockchain network diagram background animation.

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
   CONFIG — ALL TUNABLE VALUES ARE HERE
   ██████████████████████████████████████████████████████████

   TIME NOTE: at 60fps —   60 frames =  1s
                           300 frames =  5s
                          1200 frames = 20s
                          3600 frames = 60s
   ============================================================ */
var CFG = {

    /* ── How many LAN diagrams on screen at once ─────────── */
    MAX_NETWORKS:     8,   /* total simultaneous networks             */

    /* ── Topology mix ────────────────────────────────────── */
    /* Small / Medium each get a fixed share; Large fills the rest  */
    /* Medium splits evenly between ring and tree                   */
    /* Large splits evenly across 5 geometric variants              */
    PROB_SMALL:      0.20,  /* probability a network is small/SOHO     */
    PROB_MEDIUM:     0.35,  /* probability a network is medium          */
                            /* remainder = large geometric mesh         */

    /* ── Physical radius of each topology (px) ──────────── */
    SIZE_SMALL:       85,   /* radius of small  (SOHO) network         */
    SIZE_MEDIUM:     125,   /* radius of medium (office) network       */
    SIZE_LARGE:      180,   /* radius of large  (enterprise) network   */

    /* ── Node counts per topology ───────────────────────── */
    PC_SMALL_MIN:     2,    /* computers in a small star               */
    PC_SMALL_MAX:     5,

    PC_MED_MIN:       5,    /* nodes in a medium ring (excl. router)   */
    PC_MED_MAX:       9,

    MESH_NODES_MIN:  10,    /* total nodes in organic mesh (excl. router) */
    MESH_NODES_MAX:  18,
    MESH_SRV_MIN:     1,    /* servers scattered in the mesh           */
    MESH_SRV_MAX:     3,
    MESH_LINKS:       2,    /* extra cross-links per node beyond MST   */

    /* ── Hex grid topology ───────────────────────────────── */
    HEX_RINGS:        3,    /* rings of hexagons around centre (2=19n, 3=37n) */

    /* ── Double ring topology ────────────────────────────── */
    DRING_INNER:      6,    /* nodes on the inner ring                 */
    DRING_OUTER:     10,    /* nodes on the outer ring                 */

    /* ── Radial arms topology ────────────────────────────── */
    RADIAL_ARMS:      6,    /* number of radiating arms                */
    RADIAL_LEN:       3,    /* nodes per arm                           */

    /* ── Fat tree topology ───────────────────────────────── */
    FATTREE_CORE:     3,    /* fully-connected core nodes              */
    FATTREE_AGG:      5,    /* aggregate nodes (each links 2 core)     */
    FATTREE_EDGE:     3,    /* edge nodes hanging off each aggregate   */

    /* ── Device shape sizes (px) ────────────────────────── */
    SZ_COMPUTER:      2.0,  /* half-width of computer square           */
    SZ_SERVER:        3.0,  /* half-width of server square             */
    SZ_ROUTER:        4.0,  /* radius of router circle                 */
    SZ_SWITCH:        3.5,  /* half-span of switch diamond             */
    SZ_MINER:         4.0,  /* circumradius of miner hexagon           */
    SZ_VALIDATOR:     3.8,  /* circumradius of validator triangle      */
    SZ_IOT:           2.5,  /* arm half-length of IoT cross            */

    /* ── WAN packets (router → router) ──────────────────── */
    WAN_INTERVAL:    140,   /* frames between WAN packet spawns (~2.3s)*/
    WAN_SPEED:       300,   /* frames to cross from router to router   */
    WAN_TRAIL:        16,   /* trail length (frames)                   */
    BACKBONE_DIST:   540,   /* max px router-to-router for a WAN link  */

    /* ── LAN packets (node → node within same network) ───── */
    LAN_INTERVAL:    240,   /* frames between LAN packet spawns (~3s)  */
    LAN_SPEED:       400,   /* frames to travel one LAN edge           */
    LAN_TRAIL:        10,   /* trail length (frames)                   */

    /* ── Node flash decay ────────────────────────────────── */
    FLASH_DECAY:     0.030,

    /* ── Lifecycle timing ────────────────────────────────── */
    FADE_FRAMES:     240,
    ALIVE_MIN:      2400,
    ALIVE_MAX:      5400,

    /* ── Placement ───────────────────────────────────────── */
    MARGIN:          160,
    SPAWN_CANDS:      80,

    /* ── Visibility ─────────────────────────────────────── */
    OPACITY:         0.8,
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

    var rnd = Math.random();
    if (rnd < CFG.PROB_SMALL) {
        this._buildSmall();
    } else if (rnd < CFG.PROB_SMALL + CFG.PROB_MEDIUM) {
        /* Medium: coin-flip between ring and tree */
        if (Math.random() < 0.5) this._buildMediumRing();
        else                      this._buildMediumTree();
    } else {
        /* Large: 5 geometric variants chosen equally */
        var v = Math.floor(Math.random()*5);
        if      (v===0) this._buildHexGrid();
        else if (v===1) this._buildDoubleRing();
        else if (v===2) this._buildRadialArms();
        else if (v===3) this._buildFatTree();
        else            this._buildMesh();
    }
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
Network.prototype.canSend   =function(){return this.state===ST.ALIVE;};
Network.prototype.routerPos =function(){
    var r=this.devices[this.routerIdx];
    return r?{x:r.x,y:r.y}:{x:this.cx,y:this.cy};
};


/* ============================================================
   WAN PULSE — large glowing dot, router → router
   ============================================================ */
function WanPulse(fromNet, toNet) {
    var fp=fromNet.routerPos(), tp=toNet.routerPos();
    this.fromNet=fromNet; this.toNet=toNet;
    this.fx=fp.x; this.fy=fp.y; this.tx=tp.x; this.ty=tp.y;
    this.t=0; this.speed=1/CFG.WAN_SPEED;
    this.alive=true; this.cx=this.fx; this.cy=this.fy;
    this.trail=[]; this.isWan=true;
}
WanPulse.prototype.update=function(){
    if(this.t>0){
        this.trail.push({x:this.cx,y:this.cy});
        if(this.trail.length>CFG.WAN_TRAIL) this.trail.shift();
    }
    this.t+=this.speed;
    if(this.t>=1){
        this.alive=false;
        var r=this.toNet.devices[this.toNet.routerIdx];
        if(r) r.flash=1.0;
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

function engineUpdate(){
    _frame++;
    _networks.forEach(function(n){n.update();});

    /* Replace dead networks */
    var dead=false;
    _networks=_networks.filter(function(n){
        if(n.state===ST.DEAD){dead=true;return false;}
        return true;
    });
    if(dead){
        var pt=bestSpawn();
        _networks.push(new Network(pt.x,pt.y));
    }

    _pulses.forEach(function(p){p.update();});
    _pulses=_pulses.filter(function(p){return p.alive;});

    /* ── WAN packets ──────────────────────────────────── */
    if(_frame%CFG.WAN_INTERVAL===0){
        var senders  =_networks.filter(function(n){return n.canSend();});
        var receivers=_networks.filter(function(n){return n.canReceive();});
        var pairs=[];
        senders.forEach(function(s){
            receivers.forEach(function(r){
                if(s===r) return;
                var sp=s.routerPos(),rp=r.routerPos();
                var dx=sp.x-rp.x,dy=sp.y-rp.y;
                if(Math.sqrt(dx*dx+dy*dy)<CFG.BACKBONE_DIST) pairs.push({s:s,r:r});
            });
        });
        if(pairs.length>0){
            var pair=pairs[Math.floor(Math.random()*pairs.length)];
            _pulses.push(new WanPulse(pair.s,pair.r));
        }
    }

    /* ── LAN packets — one per network on its own timer ─ */
    _networks.forEach(function(net){
        if(net.state!==ST.ALIVE&&net.state!==ST.FADE_IN) return;
        if(net.edges.length===0) return;
        net.lanTimer=(net.lanTimer||0)+1;
        if(net.lanTimer>=CFG.LAN_INTERVAL){
            net.lanTimer=0;
            var eIdx=Math.floor(Math.random()*net.edges.length);
            var fwd =Math.random()<0.5;
            _pulses.push(new LanPulse(net,eIdx,fwd));
        }
    });
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
   LAYER INJECTION & START
   ============================================================ */
function startPlugin(){
    try {
        if(!_layer){
            _layer=document.createElement('div');
            _layer.id='particle-layer';
            _layer.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;overflow:hidden;';
            var bg=document.getElementById('background-layer');
            if(!bg) return;
            bg.insertAdjacentElement('afterend',_layer);
        }
        _layer.style.opacity=CFG.OPACITY;
        engineStop();
        var mode=document.documentElement.getAttribute('data-crt-mode')||'default';
        setColour(PARTICLE_CRT_COLOURS[mode]||PARTICLE_CRT_COLOURS['default']);
        engineInit();
        engineLoop();
    } catch(e){ /* silent fail */ }
}

/* PUBLIC START / STOP — called externally (e.g. from about-section show/hide) */
function particleBgStart(){
    if(_animId) return;  /* already running */
    startPlugin();
}
function particleBgStop(){
    engineStop();
    if(_layer) _layer.style.opacity=0;
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
        }).observe(document.documentElement,{attributes:true,attributeFilter:['data-crt-mode']});
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',attach);
    else attach();
})();



