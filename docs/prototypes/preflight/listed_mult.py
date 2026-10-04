import sys, math
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import preflight_model as pm
src=open(__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), 'frozen_wash.py')).read()
exec(src.split("rng = pm.R")[0].split("from collections import Counter")[1])
rng = pm.R(pm.SEED)
for tn in ('north','arid'):
    cl=[]
    for d in range(40): cl += pm.gen_district(tn, rng)
    held=[c for c in cl if c['held']]
    fw = 0.4 if tn=='north' else 0.0
    rows=[]
    for c in held:
        med,_=pm.claim_stats(c)
        if med<=0: continue
        w=pm.listing_weight(ref_econ_fw(c,fw))
        rows.append((med,w))
    def wmed(rs):
        rs=sorted(rs); tot=sum(w for _,w in rs); acc=0
        for g,w in rs:
            acc+=w
            if acc>=tot/2: return g
    def wsd(rs):
        tot=sum(w for _,w in rs); mu=sum(w*math.log(g) for g,w in rs)/tot
        return math.sqrt(sum(w*(math.log(g)-mu)**2 for g,w in rs)/tot), mu
    hm=wmed([(g,1) for g,_ in rows]); lm=wmed(rows)
    hs,hmu=wsd([(g,1) for g,_ in rows]); ls,lmu=wsd(rows)
    print(tn, 'held median', round(hm,5), 'pool median', round(lm,5), 'ratio', round(lm/hm,3), 'geo-mean ratio', round(math.exp(lmu-hmu),3), 'ln-sd held', round(hs,3), 'pool', round(ls,3), 'var diff', round(ls**2-hs**2,4))
