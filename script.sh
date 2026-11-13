# 1. Register (a conflict is expected if the account already exists).
curl -sS --max-time 10 -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 2. Log in and capture the token.
TOKEN=$(curl -fsS --max-time 10 -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')
echo "Token: $TOKEN"

# 3. Create a workspace with the token returned by this login.
curl -i --max-time 15 -X POST http://localhost:3000/workspaces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Trip","memberIds":["anna","ben"],"yourMemberId":"anna"}'
