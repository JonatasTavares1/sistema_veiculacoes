from app.database import SessionLocal
from app.models import PI

session = SessionLocal()

print("\n🔍 Verificando PIs marcados como matriz...\n")

pis_matriz = session.query(PI).filter(PI.eh_matriz == True).all()

if not pis_matriz:
    print("⚠️ Nenhum PI marcado como matriz encontrado.")
else:
    for pi_matriz in pis_matriz:
        print(f"📌 PI MATRIZ: {pi_matriz.numero_pi}")
        print("📎 PIs vinculados:")
        for filho in pi_matriz.filhos:
            print(f"   ➤ {filho.numero_pi}")
        print("-" * 40)

session.close()
