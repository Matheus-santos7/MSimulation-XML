"""PKG-3: um parser estrito (expat, o mesmo do proxy de validação) recusa \\x01 no texto."""
import xml.parsers.expat as expat

parser = expat.ParserCreate()
try:
    parser.Parse(b"<prod><xProd>Camiseta\x01Azul</xProd></prod>", True)
    print("VEREDITO: Refutado (expat aceitou)")
except expat.ExpatError as exc:
    print(f"expat recusou: {exc}")
    print("VEREDITO: Confirmado")
