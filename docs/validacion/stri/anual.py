import sys
exec(open(sys.argv[3]).read().split("comun = sorted")[0])
comun = sorted(h for h in M if h in E)
dd = defaultdict(lambda: [0, 0, 0])
for h in comun:
    k = (h - dt.timedelta(hours=1)).date(); dd[k][0] += M[h]; dd[k][1] += E[h]; dd[k][2] += 1
dias = {k: v for k, v in dd.items() if v[2] == 24}
for nom, f in (('LI-COR hasta 13/06/2016', lambda k: k < dt.date(2016,6,14)), ('Kipp 14/06/2016 a 30/07/2018', lambda k: dt.date(2016,6,14) <= k < dt.date(2018,7,31)), ('Kipp desde 31/07/2018', lambda k: k >= dt.date(2018,7,31))):
    v = [x for k, x in dias.items() if f(k)]
    a = sum(x[0] for x in v); b = sum(x[1] for x in v)
    print('%-30s n=%4d  ERA5 %+5.1f %%' % (nom, len(v), 100*(b/a-1)))
