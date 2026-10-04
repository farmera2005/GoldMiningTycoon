import sys, math, random
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import preflight_model as pm
exec(open(__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), 'frozen_wash.py')).read().split("rng = pm.R")[0].split("from collections import Counter")[1])
def cdv_fw(claim, fw):
    tpl = pm.TEMPLATES[claim['tpl']]; ref = tpl['ref']; net=[]; revs=[]
    for b in claim['blocks']:
        if b['mined']: continue
        R = sum(b['mix'][k]*pm.SLUICE_CAP[k] for k in range(4))*(1-0.15*b['clay'])
        payBcy=(b['T']+b['B'])*pm.BCY_PER_ACRE_FT
        rev=payBcy*b['g']*R*b['fin']*pm.SPOT*pm.PAYABLE_REF
        cost=(b['ob']*pm.BCY_PER_ACRE_FT*ref['strip']*(1+0.6*b['perm']+0.5*b['cem'])+payBcy*ref['wash']*(1+0.3*b['bould']+0.3*b['clay']+fw*b['perm']))
        if rev>cost: net.append(rev-cost); revs.append(rev)
    return sum(net)-ref['devBase']-ref['devPerAcre']*len(net)
rng = pm.R(pm.SEED); north=[]
for d in range(12): north += pm.gen_district('north', rng)
north=[c for c in north if c['acres']==20 and c['dep']=='creek' and any(b['f']>=0.4 for b in c['blocks'])]
r=random.Random(5)
targets={'uneconomic':-75e3,'marginal':300e3,'good':1.2e6,'excellent':4.0e6}
ratios={t:[] for t in targets}; perm=[]
for trial in range(300):
    parts=[r.choice(north) for _ in range(3)]
    blocks=[dict(b, mined=False) for c in parts for b in c['blocks']]
    ps=sorted([b for b in blocks if b['f']>=0.4], key=lambda b:-b['g'])
    for b in ps[:7]: b['mined']=True
    for b in ps[7:]: b['g']*=0.9
    claim=dict(tpl='north', blocks=blocks); base=[b['g'] for b in blocks]
    perm.append(sum(b['perm'] for b in blocks)/len(blocks))
    for t,tg in targets.items():
        ks=[]
        for fw in (0.0,0.4):
            lo,hi=0.25,4.0
            for _ in range(20):
                k=math.sqrt(lo*hi)
                for b,g0 in zip(blocks,base): b['g']=g0*k
                if cdv_fw(claim,fw)<tg: lo=k
                else: hi=k
            ks.append(k)
        if 0.26<ks[0]<3.9 and 0.26<ks[1]<3.9: ratios[t].append(ks[1]/ks[0])
for t in targets:
    v=sorted(ratios[t]); print(t, len(v), 'median k ratio', round(v[len(v)//2],3), 'p10', round(v[len(v)//10],3), 'p90', round(v[9*len(v)//10],3))
print('mean perm', sum(perm)/len(perm))
