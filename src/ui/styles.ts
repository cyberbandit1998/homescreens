// One scoped stylesheet, injected once. Every rule starts with `.fwc` so it
// can never touch the host's own Tailwind classes, and every size is in `em`
// so the host's Text size slider scales the whole module.

export const CSS = `
.fwc{--r:1.1em;position:relative;display:flex;flex-direction:column;min-height:0;font-variant-numeric:tabular-nums;-webkit-tap-highlight-color:transparent;color:var(--fwc-text)}
/* Resets use :where() so they have zero specificity and every component class below wins. */
:where(.fwc) *,:where(.fwc) *::before,:where(.fwc) *::after{box-sizing:border-box}
:where(.fwc) button{font:inherit;color:inherit;background:none;border:0;margin:0;padding:0;cursor:pointer;text-align:inherit;touch-action:manipulation}
:where(.fwc) :is(h1,h2,h3,p){margin:0}
.fwc button:focus-visible,.fwc [tabindex]:focus-visible{outline:.16em solid var(--fwc-focus);outline-offset:.12em}
.fwc-scroll{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--fwc-border) transparent;-webkit-overflow-scrolling:touch}
.fwc-body{flex:1 1 auto;min-height:0;position:relative}
.fwc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* Header */
.fwc-head{display:flex;flex-wrap:wrap;align-items:center;gap:.55em .9em;margin-bottom:.8em}
.fwc-nav{display:flex;align-items:center;gap:.4em}
.fwc-round{width:2.6em;height:2.6em;border-radius:50%;display:grid;place-items:center;background:var(--fwc-tile);color:var(--fwc-text);transition:transform .12s}
.fwc-round:active{transform:scale(.92)}
.fwc-title{flex:1 1 11em;min-width:0;font-size:1.65em;line-height:1.15;font-weight:700;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fwc-today{padding:0 1.15em;min-height:2.6em;border-radius:999px;font-weight:700;background:var(--fwc-accent);color:var(--fwc-on-accent)}
.fwc-today[aria-disabled="true"]{background:var(--fwc-tile);color:var(--fwc-muted);cursor:default}
.fwc-tabs{display:flex;gap:.15em;padding:.25em;border-radius:999px;background:var(--fwc-tile);max-width:100%;overflow-x:auto;scrollbar-width:none}
.fwc-tab{flex:none;padding:0 1em;min-height:2.3em;border-radius:999px;font-weight:600;color:var(--fwc-muted);display:flex;align-items:center;gap:.4em;transition:background .15s}
.fwc-tab[aria-selected="true"]{background:var(--fwc-card);color:var(--fwc-text);box-shadow:var(--fwc-shadow)}

/* Family filter */
.fwc-people{display:flex;gap:.5em;overflow-x:auto;padding:.15em .15em .75em;scrollbar-width:none;flex:none}
.fwc-chip{flex:none;display:flex;align-items:center;gap:.5em;padding:.3em 1em .3em .3em;min-height:2.5em;border-radius:999px;background:var(--fwc-tile);font-weight:600}
.fwc-chip[aria-pressed="true"]{background:var(--fwc-card);box-shadow:inset 0 0 0 .15em var(--chip,var(--fwc-accent)),var(--fwc-shadow)}
.fwc-avatar{flex:none;width:1.95em;height:1.95em;border-radius:50%;display:grid;place-items:center;font-size:.85em;font-weight:700;background:var(--chip);color:var(--chip-fg);line-height:1;overflow:hidden}
.fwc-avatar-sm{font-size:.8em}
.fwc-allpeople{padding-left:1em}

/* Event cards */
.fwc-ev{display:block;width:100%;margin:0 0 .4em;padding:.45em .6em .45em .8em;border-radius:.75em;background:var(--ev-bg);color:var(--ev-fg);box-shadow:inset .28em 0 0 var(--ev-bar);font-size:.9em;line-height:1.25;min-height:2.4em;text-align:left}
/* Finished events fade by losing color, not opacity, so the text keeps its contrast. */
.fwc-ev[data-past="true"]{filter:saturate(.35)}
.fwc-ev[data-allday="true"]{background:var(--ev-bar);color:var(--ev-on);box-shadow:none}
.fwc-ev-t{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-weight:700;overflow-wrap:anywhere}
.fwc-ev-s{display:block;margin-top:.1em;font-size:.84em;font-weight:600;color:var(--ev-sub);overflow-wrap:anywhere}
.fwc-slot .fwc-ev-s{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fwc-ev[data-allday="true"] .fwc-ev-s{color:inherit;opacity:.9}
.fwc-ev[data-now="true"]{box-shadow:inset .28em 0 0 var(--ev-bar),0 0 0 .14em var(--ev-bar)}

/* Week */
.fwc-week{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:.55em;min-height:100%}
.fwc-week[data-stack="true"]{grid-template-columns:minmax(0,1fr)}
/* A real border (not an inset shadow) so the sticky day header cannot paint over the today ring. */
.fwc-col{display:flex;flex-direction:column;min-width:0;border:.14em solid transparent;border-radius:var(--r);background:var(--fwc-tile);padding:0 .45em .35em}
.fwc-col[data-today="true"]{background:var(--fwc-today);border-color:var(--fwc-accent)}
.fwc-colhead{position:sticky;top:0;z-index:2;display:flex;flex-direction:column;align-items:center;gap:.1em;padding:.65em .2em .5em;margin:0 -.45em .3em;border-radius:var(--r) var(--r) 0 0;background:inherit}
.fwc-colhead[data-row="true"]{flex-direction:row;justify-content:flex-start;gap:.7em;padding-left:.8em}
.fwc-dow{font-size:.76em;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--fwc-muted)}
.fwc-dnum{min-width:2em;height:2em;padding:0 .2em;border-radius:999px;display:grid;place-items:center;font-size:1.15em;font-weight:700}
.fwc-col[data-today="true"] .fwc-dnum{background:var(--fwc-accent);color:var(--fwc-on-accent)}
.fwc-empty-col{padding:.5em .3em;font-size:.82em;text-align:center;color:var(--fwc-muted)}
.fwc-allday-gap{height:.15em}

/* Day timeline */
.fwc-allday{display:flex;flex-wrap:wrap;gap:.4em;padding:0 0 .6em 4em;flex:none}
.fwc-allday .fwc-ev{width:auto;max-width:100%;margin:0}
.fwc-tl{position:relative;display:grid;grid-template-columns:3.6em minmax(0,1fr);min-height:100%}
.fwc-hours{position:relative}
.fwc-hour{position:absolute;right:.7em;transform:translateY(-50%);line-height:1}
.fwc-hour span{font-size:.78em;font-weight:600;color:var(--fwc-muted);white-space:nowrap}
.fwc-hour[data-first="true"]{transform:translateY(0)}
.fwc-grid{position:relative;border-left:1px solid var(--fwc-border)}
.fwc-line{position:absolute;left:0;right:0;border-top:1px solid var(--fwc-border)}
.fwc-slot{position:absolute;padding:0 .15em .12em 0}
.fwc-slot .fwc-ev{height:100%;margin:0;overflow:hidden;padding:.3em .55em .3em .75em}
.fwc-now{position:absolute;left:-.4em;right:0;border-top:.15em solid var(--fwc-accent);z-index:3;pointer-events:none}
.fwc-now::before{content:'';position:absolute;left:-.12em;top:-.43em;width:.7em;height:.7em;border-radius:50%;background:var(--fwc-accent)}

/* Month */
.fwc-month{display:flex;flex-direction:column;height:100%;min-height:0}
.fwc-mhead{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:.4em;padding-bottom:.4em;flex:none}
.fwc-mdow{text-align:center;font-size:.76em;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--fwc-muted)}
.fwc-mgrid{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-auto-rows:minmax(0,1fr);gap:.4em}
.fwc-cell{position:relative;display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;border-radius:.85em;background:var(--fwc-tile);padding:.35em .4em .3em}
.fwc-cell[data-today="true"]{background:var(--fwc-today);box-shadow:inset 0 0 0 .14em var(--fwc-accent)}
.fwc-cell[data-out="true"]>*:not(.fwc-hit){opacity:.62}
.fwc-hit{position:absolute;inset:0;z-index:0;border-radius:inherit}
.fwc-cnum{position:relative;z-index:1;align-self:flex-start;min-width:1.7em;height:1.7em;padding:0 .2em;display:grid;place-items:center;border-radius:999px;font-size:.92em;font-weight:700;pointer-events:none}
.fwc-cell[data-today="true"] .fwc-cnum{background:var(--fwc-accent);color:var(--fwc-on-accent)}
/* 2.1em at .76em type is about 25px: WCAG 2.2 asks for touch targets of at least 24px. */
.fwc-mev{position:relative;z-index:1;display:block;width:100%;min-width:0;min-height:2.1em;margin-top:.16em;padding:.1em .4em .1em .6em;border-radius:.5em;background:var(--ev-bg);color:var(--ev-fg);box-shadow:inset .22em 0 0 var(--ev-bar);font-size:.76em;font-weight:700;line-height:1.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}
.fwc-mev[data-allday="true"]{background:var(--ev-bar);color:var(--ev-on);box-shadow:none}
.fwc-more{position:relative;z-index:1;display:flex;align-items:center;min-height:2.2em;margin-top:.12em;padding:0 .3em;font-size:.74em;font-weight:700;color:var(--fwc-muted);text-align:left}
.fwc-dots{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:.25em;margin-top:.3em;pointer-events:none}
.fwc-dot{width:.55em;height:.55em;border-radius:50%;background:var(--bar)}

/* Schedule */
.fwc-sched{display:flex;flex-direction:column;gap:.8em;padding-bottom:.5em}
.fwc-sday{display:grid;grid-template-columns:7em minmax(0,1fr);gap:.8em;align-items:start}
.fwc-sdate{padding-top:.5em}
.fwc-srel{font-size:1.05em;font-weight:700}
.fwc-sdate[data-today="true"] .fwc-srel{color:var(--fwc-accent-text)}
.fwc-sd{font-size:.85em;font-weight:600;color:var(--fwc-muted)}
.fwc-slist{background:var(--fwc-tile);border-radius:var(--r);padding:.5em .5em .1em}
.fwc-srow{display:grid;grid-template-columns:5.6em minmax(0,1fr);gap:.5em;align-items:start}
.fwc-stime{padding-top:.55em;font-size:.84em;font-weight:700;color:var(--fwc-muted);text-align:right}
.fwc-snone{padding:.3em .3em .6em;font-size:.88em;color:var(--fwc-muted)}
.fwc-sched[data-narrow="true"] .fwc-sday{grid-template-columns:minmax(0,1fr);gap:.2em}
.fwc-sched[data-narrow="true"] .fwc-sdate{display:flex;gap:.6em;align-items:baseline;padding-top:0}

/* Sheet */
.fwc-scrim{position:absolute;inset:0;z-index:20;display:flex;align-items:flex-end;justify-content:center;background:rgba(10,15,25,.45);animation:fwc-fade .18s ease-out}
.fwc-sheet{width:min(34em,100%);max-height:88%;overflow:auto;background:var(--fwc-card);color:var(--fwc-text);border-radius:1.4em 1.4em 0 0;padding:1.1em 1.3em 1.5em;box-shadow:0 -.5em 2em rgba(0,0,0,.3);animation:fwc-rise .22s ease-out}
.fwc-sheet-bar{height:.5em;width:100%;border-radius:999px;background:var(--bar);margin-bottom:.9em}
.fwc-sheet-top{display:flex;align-items:flex-start;gap:.8em}
.fwc-sheet-title{flex:1;min-width:0;font-size:1.45em;line-height:1.2;font-weight:700;overflow-wrap:anywhere}
.fwc-sheet-when{margin-top:.5em;font-size:1.02em;font-weight:600;color:var(--fwc-muted)}
.fwc-sheet-row{display:flex;gap:.7em;align-items:flex-start;margin-top:.85em;font-size:1em;line-height:1.35}
.fwc-sheet-label{flex:none;width:4.6em;font-size:.8em;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--fwc-muted);padding-top:.2em}
.fwc-sheet-val{min-width:0;overflow-wrap:anywhere;white-space:pre-wrap}
.fwc-who{display:flex;flex-wrap:wrap;gap:.4em}
.fwc-who span{display:flex;align-items:center;gap:.4em}

/* Chores */
.fwc-chores{display:grid;grid-template-columns:repeat(auto-fit,minmax(15em,1fr));gap:.8em;align-items:start;padding-bottom:.4em}
.fwc-ccard{background:var(--fwc-tile);border-radius:var(--r);padding:.85em}
.fwc-chead{display:flex;align-items:center;gap:.7em;margin-bottom:.4em}
.fwc-chead .fwc-avatar{font-size:1.1em}
.fwc-cname{flex:1;min-width:0;font-size:1.15em;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fwc-csub{font-size:.8em;font-weight:600;color:var(--fwc-muted)}
.fwc-ring{flex:none;width:3em;height:3em;position:relative;display:grid;place-items:center;font-size:.8em;font-weight:700}
.fwc-ring svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.fwc-group{margin:.8em 0 .35em .2em;font-size:.74em;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--fwc-muted)}
.fwc-chore{display:flex;align-items:center;gap:.7em;width:100%;min-height:3.2em;padding:.35em .7em .35em .4em;margin-bottom:.35em;border-radius:.9em;background:var(--fwc-card);box-shadow:var(--fwc-shadow);transition:transform .1s}
button.fwc-chore:active{transform:scale(.985)}
.fwc-chore[aria-readonly="true"]{cursor:default}
.fwc-check{flex:none;width:2.2em;height:2.2em;border-radius:50%;border:.16em solid var(--ring);display:grid;place-items:center;color:var(--chip-fg)}
.fwc-chore[aria-checked="true"] .fwc-check{background:var(--ring);border-color:var(--ring)}
.fwc-cn{flex:1;min-width:0;font-weight:600;line-height:1.25;overflow-wrap:anywhere}
.fwc-chore[aria-checked="true"] .fwc-cn{text-decoration:line-through;color:var(--fwc-muted)}
.fwc-pts{flex:none;display:flex;align-items:center;gap:.25em;font-size:.85em;font-weight:700;color:var(--fwc-muted)}
.fwc-celebrate{display:flex;align-items:center;gap:.5em;margin-top:.3em;padding:.5em .7em;border-radius:.9em;background:var(--chip);color:var(--chip-fg);font-weight:700}
.fwc-bonus{grid-column:1/-1}
.fwc-list{list-style:none;margin:0;padding:0}
.fwc-note{margin-top:.6em;font-size:.85em;color:var(--fwc-muted)}

/* States */
.fwc-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.6em;height:100%;padding:1.5em;text-align:center}
.fwc-state h2{font-size:1.3em;font-weight:700}
.fwc-state p{max-width:28em;color:var(--fwc-muted);line-height:1.45}
.fwc-state-icon{display:grid;place-items:center;width:3.4em;height:3.4em;border-radius:50%;background:var(--fwc-accent-soft);color:var(--fwc-accent-text)}
.fwc-banner{display:flex;align-items:center;gap:.5em;margin-top:.5em;padding:.45em .8em;border-radius:.8em;background:var(--fwc-tile);color:var(--fwc-muted);font-size:.85em;font-weight:600;flex:none}
.fwc-skel{border-radius:.8em;background:linear-gradient(90deg,var(--fwc-tile),var(--fwc-border),var(--fwc-tile));background-size:200% 100%;animation:fwc-shimmer 1.4s linear infinite}
.fwc-toast{position:absolute;left:50%;bottom:1em;transform:translateX(-50%);z-index:30;padding:.6em 1.1em;border-radius:999px;background:var(--fwc-text);color:var(--fwc-bg);font-weight:600;font-size:.9em;box-shadow:0 .3em 1em rgba(0,0,0,.3)}

@keyframes fwc-fade{from{opacity:0}to{opacity:1}}
@keyframes fwc-rise{from{transform:translateY(1.5em);opacity:.4}to{transform:none;opacity:1}}
@keyframes fwc-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.fwc *,.fwc *::before,.fwc *::after{animation:none!important;transition:none!important}}
`;
