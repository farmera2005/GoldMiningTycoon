import sys, math
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import preflight_model as pm
from collections import Counter

def ref_econ_fw(claim, fw):
    tpl = pm.TEMPLATES[claim['tpl']]; ref = tpl['ref']
    net=[]; revs=[]
    for b in claim['blocks']:
        if b['mined']: continue
        R = sum(b['mix'][k]*pm.SLUICE_CAP[k] for k in range(4))*(1-0.15*b['clay'])
        payBcy=(b['T']+b['B'])*pm.BCY_PER_ACRE_FT
        rev=payBcy*b['g']*R*b['fin']*pm.SPOT*pm.PAYABLE_REF
        cost=(b['ob']*pm.BCY_PER_ACRE_FT*ref['strip']*(1+0.6*b['perm']+0.5*b['cem'])
              + payBcy*ref['wash']*(1+0.3*b['bould']+0.3*b['clay']+fw*b['perm']))
        if rev>cost: net.append(rev-cost); revs.append(rev)
    M=len(net); cdv=sum(net)-ref['devBase']-ref['devPerAcre']*M
    margin=sum(net)/sum(revs) if revs else 0.0
    if cdv<=0: cls='uneconomic'
    elif cdv>=3.0e6 and margin>=0.60: cls='excellent'
    elif cdv>=0.75e6 and margin>=0.40: cls='good'
    else: cls='marginal'
    return cls

rng = pm.R(pm.SEED)
world = {}
for tn in ('north','arid'):
    cl=[]
    for d in range(40): cl += pm.gen_district(tn, rng)
    world[tn]=cl
C=pm.CLASSES
for fw in (0.0, 0.40):
    for tn in ('north','arid'):
        cl=world[tn]
        cAll,cHeld,cOpen,cPool=Counter(),Counter(),Counter(),Counter()
        for c in cl:
            k=ref_econ_fw(c,fw); c['k']=k
            cAll[k]+=1; (cHeld if c['held'] else cOpen)[k]+=1
            if c['held']: cPool[k]+=pm.listing_weight(k)
        def sh(cc):
            t=sum(cc.values()); return ' / '.join(f"{100*cc[k]/t:.1f}" for k in C)
        print(f"fw={fw} {tn}: all {sh(cAll)} | held {sh(cHeld)} | open {sh(cOpen)} | POOL {sh(cPool)}")

print('---- stats north')
def econ_blocks(c, fw):
    tpl = pm.TEMPLATES[c['tpl']]; ref=tpl['ref']; out=[]
    for b in c['blocks']:
        if b['mined']: continue
        R = sum(b['mix'][k]*pm.SLUICE_CAP[k] for k in range(4))*(1-0.15*b['clay'])
        payBcy=(b['T']+b['B'])*pm.BCY_PER_ACRE_FT
        rev=payBcy*b['g']*R*b['fin']*pm.SPOT*pm.PAYABLE_REF
        cost=(b['ob']*pm.BCY_PER_ACRE_FT*ref['strip']*(1+0.6*b['perm']+0.5*b['cem'])+payBcy*ref['wash']*(1+0.3*b['bould']+0.3*b['clay']+fw*b['perm']))
        if rev>cost: out.append(b)
    return out
for fw in (0.0,0.4):
    cl=world['north']
    mg=[];mw=[];msr=[];oz={'marginal':[],'good':[],'excellent':[]}
    over=[0,0]; creekopen=[0,0]; bysize={}
    for c in cl:
        k=ref_econ_fw(c,fw)
        if c['held']:
            bysize.setdefault(c['acres'],[0,0]); bysize[c['acres']][0]+=1; bysize[c['acres']][1]+= (k=='uneconomic')
            if k!='uneconomic':
                eb=econ_blocks(c,fw)
                for b in eb:
                    mg.append(b['g']); mw.append((b['T']+b['B'])*pm.BCY_PER_ACRE_FT); msr.append(b['ob']/(b['T']+b['B']))
                oz[k].append(sum(b['g']*(b['T']+b['B'])*pm.BCY_PER_ACRE_FT for b in eb))
        else:
            if c['dep'] in ('bench','deepMuck'): over[0]+=1; over[1]+=(k!='uneconomic')
            elif c['dep']=='creek': creekopen[0]+=1; creekopen[1]+=(k!='uneconomic')
    def wq(q):
        pairs=sorted(zip(mg,mw)); tot=sum(mw); acc=0
        for g,wt in pairs:
            acc+=wt
            if acc>=q*tot: return g
    print(fw, 'mined g', [round(wq(q),4) for q in (.1,.5,.9,.99)], 'strip mined', [round(pm.pct(msr,q),2) for q in (.1,.5,.9)],
          'oz', [round(pm.pct(oz[k],.5)) for k in oz], 'overlooked econ', round(over[1]/over[0],3), 'creek open econ', round(creekopen[1]/creekopen[0],3),
          'unecon by size', {a: round(v[1]/v[0],3) for a,v in sorted(bysize.items())})
