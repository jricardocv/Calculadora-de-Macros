# Security Specification: Calculadora de Macros

## 1. Data Invariants
- **Alimentos**: Cada alimento registrado deve conter um nome não-vazio com comprimento máximo de 150 caracteres, e valores numéricos válidos e não-negativos para `kcal100g`, `carbo100g`, `prot100g` e `gord100g`. A leitura é pública para permitir consulta dos alimentos do banco, e a inserção é permitida para alimentos com campos validados.
- **Refeições (Planilha)**: Cada registro de refeição deve conter data, hora (gerados automaticamente), tipo de refeição válido (`Café da manhã`, `Lanche da manhã`, `Almoço`, `Lanche da tarde`, `Jantar`, `Ceia`), além dos valores totais numéricos de macronutrientes (`totalKcal`, `totalCarbo`, `totalProt`, `totalGord`) e a lista de itens. Se o usuário estiver autenticado, apenas o próprio usuário pode visualizar ou excluir suas próprias refeições; se anônimo/público, registros vinculados ao UID da sessão são isolados.

## 2. The "Dirty Dozen" Payloads
1. **Payload 1 (Ghost Fields Injection on Alimento)**: Objeto com campos arbitrários como `admin: true` ou `systemOverride: true`. Deve ser rejeitado.
2. **Payload 2 (Negative Nutrients on Alimento)**: Objeto com `kcal100g: -50`. Deve ser rejeitado.
3. **Payload 3 (Oversized Food Name)**: Nome com mais de 150 caracteres. Deve ser rejeitado.
4. **Payload 4 (Non-numeric Carbo/Prot/Gord)**: Campo `carbo100g: "cem"`. Deve ser rejeitado.
5. **Payload 5 (Meal with Invalid Meal Type)**: Refeição com `refeicao: "Brunch Invalido 999"`. Deve ser rejeitado.
6. **Payload 6 (Meal with Missing Date/Hora)**: Refeição sem `data` ou sem `hora`. Deve ser rejeitado.
7. **Payload 7 (Meal with Negative Kcal)**: Refeição com `totalKcal: -100`. Deve ser rejeitado.
8. **Payload 8 (Meal Impersonation / Identity Spoofing)**: Usuário A tentando gravar `userId: "user_B"`. Deve ser rejeitado.
9. **Payload 9 (Oversized Document ID)**: Tentativa de injetar document ID com mais de 128 caracteres ou caracteres ilegais. Deve ser rejeitado.
10. **Payload 10 (Delete Meal of Another User)**: Usuário A tentando deletar refeição pertencente ao Usuário B. Deve ser rejeitado.
11. **Payload 11 (Unbounded Array Injection in Items)**: Tentativa de injetar array com mais de 50 itens gigantescos. Deve ser rejeitado.
12. **Payload 12 (Direct Mutation of Immutable Fields)**: Modificação de `createdAt` ou `userId` original. Deve ser rejeitado.

## 3. Test Runner Design
O arquivo `firestore.rules.test.ts` valida as negações dos 12 cenários adversários garantindo PERMISSION_DENIED.
