import sys
src = open(sys.argv[3]).read().split("comun = sorted")[0]
exec(src)
comun = sorted(h for h in M if h in E and h.date() >= dt.date(2018,7,31))
dd = defaultdict(lambda: [0, 0, 0])
for h in comun:
    k = (h - dt.timedelta(hours=1)).date(); dd[k][0] += M[h]; dd[k][1] += E[h]; dd[k][2] += 1
dias = {k: v for k, v in dd.items() if v[2] == 24}
for nom, ms in (('ene-feb',(1,2)),('mar-abr',(3,4)),('may-nov',range(5,12)),('dic',(12,))):
    v=[x for k,x in dias.items() if k.month in ms]; a=sum(x[0] for x in v); b=sum(x[1] for x in v)
    print('%-8s n=%4d medido %.2f ERA5 %.2f kWh/m2 dia  %+5.1f %%'%(nom,len(v),a/len(v)/1000,b/len(v)/1000,100*(b/a-1)))
for hh in (9,11,13,15,17):
    v=[(M[h],E[h]) for h in comun if h.hour==hh]; print('%02d:00 medido %.0f ERA5 %.0f'%(hh,st.mean(x[0] for x in v),st.mean(x[1] for x in v)))
