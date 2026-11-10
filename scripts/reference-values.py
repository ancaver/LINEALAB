"""Referencias independientes: Decimal (70 dígitos), sin importar motores JS.
Recrear con: python3 scripts/reference-values.py
No se usa este programa para calcular los resultados mostrados por la aplicación.
"""
from decimal import Decimal as D, getcontext
from pathlib import Path
import json
getcontext().prec = 70
PI = D('3.141592653589793238462643383279502884197169399375105820974944592307816406')
EPS0, MU0 = D('8.8541878188e-12'), D('1.25663706127e-6')
SIGMA, ER, TAN = D('5.8e7'), D('2.1'), D('0.0002')

def root(re, im):
    modulus = (re*re + im*im).sqrt()
    # Evaluación independiente de la raíz principal con precisión decimal alta.
    if re >= 0:
        u = ((modulus+re)/2).sqrt()
        v = im/(2*u) if u else D(0)
    else:
        v = ((modulus-re)/2).sqrt()
        if im < 0: v = -v
        u = im/(2*v) if v else D(0)
    return u, v

def reference(kind, f):
    w, eps = 2*PI*f, EPS0*ER
    rs = (PI*f*MU0/SIGMA).sqrt()
    a, b, distance, width, gap = map(D, ['0.0005','0.002','0.005','0.020','0.001'])
    if kind == 'coaxial':
        h = (b/a).ln(); R = rs/(2*PI)*(1/a+1/b); L = MU0*h/(2*PI); C = 2*PI*eps/h
    elif kind == 'bifilar':
        x = distance/(2*a); h = (x+(x*x-1).sqrt()).ln()
        R = rs/(PI*a); L = MU0*h/PI; C = PI*eps/h
    else:
        R = 2*rs/width; L = MU0*gap/width; C = eps*width/gap
    G = w*C*TAN
    # Producto y cociente complejos evaluados en Decimal, no con secondary.js.
    zr, zi, yr, yi = R, w*L, G, w*C
    denominator = yr*yr+yi*yi
    z0r, z0i = root((zr*yr+zi*yi)/denominator, (zi*yr-zr*yi)/denominator)
    alpha, beta = root(zr*yr-zi*yi, zr*yi+zi*yr)
    values = dict(R=R,L=L,C=C,G=G,Z0Real=z0r,Z0Imaginary=z0i,alpha=alpha,beta=beta,
                  phaseVelocity=w/beta,wavelength=2*PI/beta,alphaDb=D('8.686')*alpha,
                  Z0Magnitude=(z0r*z0r+z0i*z0i).sqrt(),skinDepth=(2/(w*MU0*SIGMA)).sqrt())
    return {key: str(value) for key,value in values.items()}

cases = [dict(type=kind,frequencyHz=int(f),expected=reference(kind,D(f)))
         for kind in ['coaxial','bifilar','placas'] for f in ['1000000','100000000','1000000000']]
root_path = Path(__file__).resolve().parents[1]
(root_path/'tests/fixtures/final-references.json').write_text(json.dumps({
    'method':'Python Decimal, 70 significant decimal digits; no JavaScript engines imported',
    'relativeTolerance':2e-12,'absoluteTolerance':0,
    'constants':{'epsilon0':str(EPS0),'mu0':str(MU0)},
    'materials':{'conductivity':str(SIGMA),'relativePermittivity':str(ER),'lossTangent':str(TAN)},
    'cases':cases},indent=2)+'\n',encoding='utf-8')
print('Referencias independientes generadas:',len(cases))
