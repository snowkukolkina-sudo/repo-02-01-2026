# EDO / Diadoc Environment Template

Create a `.env` file in the project root (never commit it) and populate the variables below:

```env
PORT=8080

# PostgreSQL connection
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=dandy
DB_PASS=secret
DB_NAME=dandy

# Diadoc configuration
DIADOC_API_URL=https://diadoc-api.kontur.ru
DIADOC_API_TOKEN=put-your-token-here
DIADOC_API_CLIENT_ID=optional-if-using-authenticate
DIADOC_BOX_ID=2BM-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX

# Optional CryptoPro/Cloud signature proxy
CRYPTO_AGENT_URL=http://localhost:8081/sign

# Access control / audit
EDO_ALLOWED_ROLES=admin,accountant
EDO_AUDIT_DISABLED=false
```

Keep the real values in a secure secret store (Vault, AWS Secrets Manager, etc.) and only load them during deployment.

