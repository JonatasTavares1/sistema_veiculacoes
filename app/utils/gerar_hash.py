from passlib.context import CryptContext

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

senha = input("Senha: ").strip()

# bcrypt: limite 72 bytes
if len(senha.encode("utf-8")) > 72:
    raise ValueError("Senha > 72 bytes. Use uma senha menor (bcrypt limita em 72 bytes).")

print(pwd.hash(senha))